/**
 * Prediction engine
 * Handles generating future price predictions using trained LSTM models
 */

import type {Config} from '../config/schema.ts';
import type {MarketFeatures, PredictionResult, StockDataPoint, TradingSignal} from '../types/index.ts';
import type {LstmModel} from './lstm-model.ts';
import type {EnsembleModel} from './ensemble.ts';

import {DateUtils} from '../cli/utils/date.ts';
import {ErrorHandler, PredictionError} from '../cli/utils/errors.ts';

/**
 * Prediction engine class
 */
export class PredictionEngine {
	/**
	 * Generate a trading signal based on prediction results
	 * @param prediction - Prediction results
	 * @param predictionConfig - Prediction and trading configuration
	 * @returns Trading signal
	 */
	public generateSignal(prediction: PredictionResult, predictionConfig: Config['prediction']): TradingSignal {
		let action: TradingSignal['action'] = 'HOLD';
		const confidence = prediction.confidence;

		if (prediction.percentChange >= predictionConfig.buyThreshold && confidence >= predictionConfig.minConfidence) {
			action = 'BUY';
		} else if (prediction.percentChange <= predictionConfig.sellThreshold && confidence >= predictionConfig.minConfidence) {
			action = 'SELL';
		}

		return {
			action,
			confidence,
			delta: prediction.percentChange,
			reason:
				action === 'HOLD'
					? `Neutral trend (change: ${(prediction.percentChange * 100).toFixed(2)}%) or low confidence (${(confidence * 100).toFixed(1)}%)`
					: `${action} signal based on ${prediction.percentChange.toFixed(2)}% expected change with ${(confidence * 100).toFixed(1)}% confidence`,
			symbol: prediction.symbol,
			timestamp: new Date(),
		};
	}

	/**
	 * Generate price prediction for a specific symbol
	 * @param model - Trained LSTM model
	 * @param historicalData - Recent historical data for context
	 * @param appConfig - Application configuration
	 * @param marketFeatures - Optional market context features
	 * @returns Prediction results
	 */
	public async predict(
		model: LstmModel | EnsembleModel,
		historicalData: StockDataPoint[],
		appConfig: Config,
		marketFeatures?: MarketFeatures[],
	): Promise<PredictionResult> {
		const metadata = model.getMetadata();
		const symbol = metadata?.symbol ?? 'UNKNOWN';

		const context = {
			operation: 'generate-prediction',
			step: 'data-preparation',
			symbol,
		};

		return ErrorHandler.wrapAsync(async () => {
			// Ensure it returns a Promise and has an await
			await Promise.resolve();
			if (!model.isTrained()) {
				throw new PredictionError('Model not trained', symbol);
			}

			if (historicalData.length < appConfig.model.windowSize) {
				throw new PredictionError(`Insufficient data for prediction. Need at least ${appConfig.model.windowSize} points.`, symbol);
			}

			// Multi-step prediction with Monte Carlo Dropout for Uncertainty Quantification
			context.step = 'model-inference';
			const recentData = historicalData.slice(-appConfig.model.windowSize * 2);
			const recentFeatures = marketFeatures ? marketFeatures.slice(-appConfig.model.windowSize * 2) : undefined;

			const iterations = appConfig.prediction.uncertaintyIterations;
			const allPredictions: number[][] = [];

			// Run multiple iterations with dropout enabled (Monte Carlo Dropout)
			// This generates a distribution of predictions to estimate uncertainty
			for (let i = 0; i < iterations; i++) {
				const runPredictions = model.predict(recentData, appConfig.prediction.days, recentFeatures, {training: true});
				allPredictions.push(runPredictions);
			}

			// Calculate statistics for each day (Mean, StdDev, Confidence Intervals)
			const predictedPrices: number[] = [];
			const lowerBounds: number[] = [];
			const upperBounds: number[] = [];

			for (let day = 0; day < appConfig.prediction.days; day++) {
				const dayPrices = allPredictions.map((p) => p[day] ?? 0);

				// Calculate Mean
				const mean = dayPrices.reduce((sum, val) => sum + val, 0) / dayPrices.length;
				predictedPrices.push(mean);

				// Calculate Standard Deviation
				const variance = dayPrices.reduce((sum, val) => sum + (val - mean) ** 2, 0) / dayPrices.length;
				const stdDev = Math.sqrt(variance);

				// Calculate 95% Confidence Interval (Mean ± 1.96 * StdDev)
				lowerBounds.push(mean - 1.96 * stdDev);
				upperBounds.push(mean + 1.96 * stdDev);
			}

			const lastActualPoint = historicalData.at(-1);
			const lastPrice = lastActualPoint?.close ?? 0;
			const targetPrice = predictedPrices.at(-1) ?? 0;
			const priceChange = targetPrice - lastPrice;
			const percentChange = lastPrice === 0 ? 0 : priceChange / lastPrice;

			// Generate future dates starting from the last actual point's date
			const baseDate = lastActualPoint ? new Date(lastActualPoint.date) : new Date();
			const futureDates = DateUtils.generateSequence(baseDate, appConfig.prediction.days);

			// Calculate real confidence based on MAPE (Mean Absolute Percentage Error)
			// Formula: confidence = max(0.1, min(0.95, 1 - mape))
			const mape = metadata?.mape ?? 0.2; // Default to 20% error if not available
			const confidence = Math.max(0.1, Math.min(0.95, 1 - mape));

			// Safe access for bounds with fallbacks (though they should exist given the loop above)
			const finalLowerBound = lowerBounds.at(-1) ?? predictedPrices.at(-1) ?? 0;
			const finalUpperBound = upperBounds.at(-1) ?? predictedPrices.at(-1) ?? 0;

			return {
				confidence,
				currentPrice: lastPrice,
				days: appConfig.prediction.days,
				fullHistory: historicalData,
				historicalData: recentData,
				lowerBound: finalLowerBound,
				meanAbsoluteError: metadata?.metrics.meanAbsoluteError ?? 0,
				percentChange,
				predictedData: predictedPrices.map((price, i) => {
					const date = futureDates.at(i) ?? '';
					return {
						date,
						lowerBound: lowerBounds[i] ?? price,
						price,
						upperBound: upperBounds[i] ?? price,
					};
				}),
				predictedPrice: targetPrice,
				predictedPrices,
				predictionDate: new Date(),
				priceChange,
				symbol,
				upperBound: finalUpperBound,
			};
		}, context);
	}
}
