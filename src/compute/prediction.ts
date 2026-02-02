/**
 * Prediction engine
 * Handles generating future price predictions using trained LSTM models
 */

import type {Config} from '../config/schema.ts';
import type {PredictionResult, StockDataPoint, TradingSignal} from '../types/index.ts';
import type {LstmModel} from './lstm-model.ts';

import {DateUtils} from '../cli/utils/date.ts';
import {ErrorHandler, PredictionError} from '../cli/utils/errors.ts';

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
			step: 'data-preparation',
			symbol,
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

			const lastActualPoint = historicalData.at(-1);
			const lastPrice = lastActualPoint?.close ?? 0;
			const targetPrice = predictedPrices.at(-1) ?? 0;
			const priceChange = targetPrice - lastPrice;
			const percentChange = lastPrice === 0 ? 0 : priceChange / lastPrice;

			// Generate future dates starting from the last actual point's date
			const baseDate = lastActualPoint ? new Date(lastActualPoint.date) : new Date();
			const futureDates = DateUtils.generateSequence(baseDate, appConfig.prediction.days);

			return {
				confidence: 0.8, // Placeholder
				currentPrice: lastPrice,
				days: appConfig.prediction.days,
				fullHistory: historicalData,
				historicalData: recentData,
				meanAbsoluteError: metadata?.metrics.meanAbsoluteError ?? 0,
				percentChange,
				priceChange,
				predictedData: predictedPrices.map((price, i) => {
					const date = futureDates.at(i) ?? '';
					return {
						date,
						price,
					};
				}),
				predictedPrice: targetPrice,
				predictedPrices,
				predictionDate: new Date(),
				symbol,
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
			action,
			confidence,
			delta: prediction.percentChange,
			reason: action === 'HOLD' ? 'Neutral trend or low confidence' : `${action} signal based on ${prediction.percentChange.toFixed(2)}% expected change`,
			symbol: prediction.symbol,
			timestamp: new Date(),
		};
	}
}
