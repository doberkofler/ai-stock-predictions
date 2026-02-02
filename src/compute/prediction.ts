/**
 * Prediction engine
 * Handles generating future price predictions using trained LSTM models
 */

import {PredictionError, ErrorHandler} from '../cli/utils/errors.ts';
import type {LstmModel} from './lstm-model.ts';
import type {Config} from '../config/schema.ts';
import type {StockDataPoint, PredictionResult, TradingSignal} from '../types/index.ts';

/**
 * Prediction engine class
 */
export class PredictionEngine {
	/**
	 * Generate price prediction for a specific symbol
	 * @param model - Trained LSTM model
	 * @param historicalData - Recent historical data for context
	 * @param appConfig - Application configuration
	 * @returns Prediction results
	 */
	public async predict(model: LstmModel, historicalData: StockDataPoint[], appConfig: Config): Promise<PredictionResult> {
		const metadata = model.getMetadata();
		const symbol = metadata?.symbol ?? 'UNKNOWN';

		const context = {
			operation: 'generate-prediction',
			symbol,
			step: 'data-preparation',
		};

		return ErrorHandler.wrapAsync(async () => {
			if (!model.isTrained()) {
				throw new PredictionError('Model not trained', symbol);
			}

			if (historicalData.length < appConfig.model.windowSize) {
				throw new PredictionError(`Insufficient data for prediction. Need at least ${appConfig.model.windowSize} points.`, symbol);
			}

			// Prepare the latest window of data
			context.step = 'model-inference';
			const recentData = historicalData.slice(-appConfig.model.windowSize * 2);

			// Multi-step prediction
			const predictedPrices = await model.predict(recentData, appConfig.prediction.days);

			const lastPrice = historicalData.at(-1)?.close ?? 0;
			const targetPrice = predictedPrices.at(-1) ?? 0;
			const priceChange = targetPrice - lastPrice;
			const percentChange = lastPrice === 0 ? 0 : priceChange / lastPrice;

			return {
				symbol,
				currentPrice: lastPrice,
				predictedPrice: targetPrice,
				priceChange,
				percentChange,
				predictionDate: new Date(),
				days: appConfig.prediction.days,
				historicalData: recentData,
				fullHistory: historicalData,
				predictedData: predictedPrices.map((price, i) => {
					const date = new Date();
					date.setDate(date.getDate() + i + 1);
					return {
						date: date.toISOString().split('T')[0] ?? '',
						price,
					};
				}),
				predictedPrices,
				confidence: 0.8, // Placeholder
				meanAbsoluteError: metadata?.metrics.meanAbsoluteError ?? 0,
			};
		}, context);
	}

	/**
	 * Generate a trading signal based on prediction results
	 * @param prediction - Prediction results
	 * @param predictionConfig - Prediction and trading configuration
	 * @returns Trading signal
	 */
	public generateSignal(prediction: PredictionResult, predictionConfig: Config['prediction']): TradingSignal {
		let action: TradingSignal['action'] = 'HOLD';
		const confidence = Math.min(0.95, Math.max(0.1, 0.5 + prediction.percentChange * 2)); // Dynamic confidence

		if (prediction.percentChange >= predictionConfig.buyThreshold && confidence >= predictionConfig.minConfidence) {
			action = 'BUY';
		} else if (prediction.percentChange <= predictionConfig.sellThreshold && confidence >= predictionConfig.minConfidence) {
			action = 'SELL';
		}

		return {
			symbol: prediction.symbol,
			action,
			confidence,
			delta: prediction.percentChange,
			reason: action === 'HOLD' ? 'Neutral trend or low confidence' : `${action} signal based on ${prediction.percentChange.toFixed(2)}% expected change`,
			timestamp: new Date(),
		};
	}
}
