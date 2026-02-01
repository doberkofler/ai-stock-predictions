/**
 * Prediction engine for generating trading signals
 * Combines ML predictions with trading logic
 */

import {PredictionError, ErrorHandler} from '../cli/utils/errors.ts';
import type {Config} from '../config/schema.ts';
import type {ModelMetadata} from '../compute/lstm-model.ts';
import type {TradingSignal, TradingConfig, StockDataPoint, PredictionResult} from '../types/index.ts';
import type {LstmModel} from './lstm-model.ts';

/**
 * Prediction engine class
 */
export class PredictionEngine {
	/**
	 * Generate predictions using trained model
	 * @param {LstmModel} model - Trained model instance
	 * @param {StockDataPoint[]} data - Historical stock data
	 * @param {Config} appConfig - Application configuration
	 * @returns {Promise<PredictionResult>} Prediction results
	 */
	public async predict(model: LstmModel, data: StockDataPoint[], appConfig: Config): Promise<PredictionResult> {
		const context = {
			operation: 'generate-prediction',
			step: 'model-inference',
		};

		return ErrorHandler.wrapAsync(async () => {
			if (!model.isTrained()) {
				throw new PredictionError('Model must be trained before prediction');
			}

			if (data.length < appConfig.ml.windowSize) {
				throw new PredictionError(`Insufficient data: need at least ${appConfig.ml.windowSize} points`);
			}

			// Get current price
			const lastPoint = data.at(-1);
			if (!lastPoint) {
				throw new PredictionError('No data points available for current price');
			}
			const currentPrice = lastPoint.close;

			// Generate predictions
			const predictedPrices = await model.predict(data, appConfig);

			// Calculate confidence based on model performance
			const metadata = model.getMetadata();
			const confidence = this.calculateConfidence(metadata);

			return {
				currentPrice,
				predictedPrices,
				confidence,
				meanAbsoluteError: metadata?.metrics.meanAbsoluteError ?? 0,
			};
		}, context);
	}

	/**
	 * Generate trading signal from prediction
	 * @param {PredictionResult} prediction - Prediction result
	 * @param {TradingConfig} config - Trading configuration
	 * @returns {TradingSignal} Trading signal
	 */
	public generateSignal(prediction: PredictionResult, config: TradingConfig): TradingSignal {
		const firstPredicted = prediction.predictedPrices[0];
		const delta = firstPredicted === undefined ? 0 : (firstPredicted - prediction.currentPrice) / prediction.currentPrice;

		let action: 'BUY' | 'SELL' | 'HOLD';
		let reason: string;

		if (prediction.confidence >= config.minConfidence) {
			if (delta > config.buyThreshold) {
				action = 'BUY';
				reason = `Expected +${(delta * 100).toFixed(2)}% gain`;
			} else if (delta < config.sellThreshold) {
				action = 'SELL';
				reason = `Expected ${(delta * 100).toFixed(2)}% loss`;
			} else {
				action = 'HOLD';
				reason = 'Neutral signal - within thresholds';
			}
		} else {
			action = 'HOLD';
			reason = `Low confidence: ${(prediction.confidence * 100).toFixed(0)}%`;
		}

		return {
			action,
			confidence: prediction.confidence,
			delta,
			reason,
		};
	}

	/**
	 * Calculate confidence score based on model performance
	 * @param {ModelMetadata | null} metadata - Model metadata
	 * @returns {number} Confidence score (0-1)
	 */
	private calculateConfidence(metadata: ModelMetadata | null): number {
		if (metadata) {
			const loss = metadata.loss || 1;
			const meanAbsoluteError = metadata.metrics.meanAbsoluteError ?? 0.1;
			const dataPoints = metadata.dataPoints || 100;

			// Base confidence from loss (lower loss = higher confidence)
			const lossConfidence = Math.max(0, Math.min(1, 1 - loss));

			// Adjust based on MAE (lower MAE = higher confidence)
			const maeConfidence = Math.max(0, Math.min(1, 1 - meanAbsoluteError * 10));

			// Adjust based on data amount (more data = higher confidence)
			const dataConfidence = Math.min(1, dataPoints / 1000);

			// Weighted average
			return lossConfidence * 0.5 + maeConfidence * 0.3 + dataConfidence * 0.2;
		}

		return 0.5; // Default confidence
	}
}
