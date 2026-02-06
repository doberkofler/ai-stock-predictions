import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {Config} from '../../../src/config/schema.ts';
import {DefaultConfig} from '../../../src/config/schema.ts';
import type {PredictionResult, StockDataPoint} from '../../../src/types/index.ts';

import {LstmModel} from '../../../src/compute/lstm-model.ts';
import {PredictionEngine} from '../../../src/compute/prediction.ts';

describe('PredictionEngine', () => {
	let engine: PredictionEngine;

	const mockAppConfig: Config = {
		...DefaultConfig,
		dataSource: {rateLimit: 100, retries: 3, timeout: 5000},
		model: {
			...DefaultConfig.model,
			batchSize: 32,
			epochs: 2,
			windowSize: 10,
		},
		prediction: {
			...DefaultConfig.prediction,
			contextDays: 15,
			days: 1,
			uncertaintyIterations: 1,
		},
		training: {maxHistoricalYears: 3, minNewDataPoints: 5, minQualityScore: 60},
	};

	const mockData: StockDataPoint[] = Array.from({length: 20}, (_, i) => ({
		adjClose: 102 + i,
		close: 102 + i,
		date: `2023-01-${String(i + 1).padStart(2, '0')}`,
		high: 105 + i,
		low: 95 + i,
		open: 100 + i,
		volume: 1000,
	}));

	beforeEach(() => {
		engine = new PredictionEngine();
	});

	describe('predict', () => {
		it('should generate prediction result if model is trained and data is sufficient', async () => {
			const mockModel = {
				getMetadata: vi.fn().mockReturnValue({
					dataPoints: 100,
					loss: 0.01,
					metrics: {mape: 0.05, meanAbsoluteError: 0.02},
					symbol: 'AAPL',
				}),
				isTrained: vi.fn().mockReturnValue(true),
				predict: vi.fn().mockReturnValue([110]), // Changed to sync to match current implementation
			};

			const result = await engine.predict(mockModel as unknown as LstmModel, mockData, mockAppConfig);

			expect(result.currentPrice).toBe(102 + 19);
			expect(result.predictedPrices).toEqual([110]);
			expect(result.confidence).toBeGreaterThan(0);
			expect(result.fullHistory).toBeDefined();
		});

		it('should calculate prediction intervals with Monte Carlo Dropout', async () => {
			// Mock model that returns slightly different predictions each iteration
			let callCount = 0;
			const mockModel = {
				getMetadata: vi.fn().mockReturnValue({
					dataPoints: 100,
					loss: 0.01,
					mape: 0.05,
					metrics: {mape: 0.05, meanAbsoluteError: 0.02},
					symbol: 'AAPL',
				}),
				isTrained: vi.fn().mockReturnValue(true),
				predict: vi.fn().mockImplementation(() => {
					// Return different values to simulate Monte Carlo Dropout
					callCount++;
					return [110 + callCount * 0.5]; // Slight variation each time
				}),
			};

			// Use more iterations to test Monte Carlo Dropout
			const configWithMoreIterations = {
				...mockAppConfig,
				prediction: {
					...mockAppConfig.prediction,
					uncertaintyIterations: 10,
				},
			};

			const result = await engine.predict(mockModel as unknown as LstmModel, mockData, configWithMoreIterations);

			// Verify prediction intervals are present
			expect(result.lowerBound).toBeDefined();
			expect(result.upperBound).toBeDefined();
			expect(result.predictedData[0]?.lowerBound).toBeDefined();
			expect(result.predictedData[0]?.upperBound).toBeDefined();

			// Verify bounds make sense
			expect(result.lowerBound).toBeLessThan(result.predictedPrice);
			expect(result.upperBound).toBeGreaterThan(result.predictedPrice);

			// Verify Monte Carlo iterations were called
			expect(mockModel.predict).toHaveBeenCalledTimes(10);

			// Verify the last argument includes training: true for Monte Carlo Dropout
			const lastCall = mockModel.predict.mock.calls.at(-1);
			expect(lastCall?.at(-1)).toEqual({training: true});
		});

		it('should throw error if model is not trained', async () => {
			const mockModel = {
				getMetadata: vi.fn().mockReturnValue({symbol: 'AAPL'}),
				isTrained: vi.fn().mockReturnValue(false),
			};

			await expect(engine.predict(mockModel as unknown as LstmModel, mockData, mockAppConfig)).rejects.toThrow(/not trained/);
		});

		it('should throw error if data is insufficient', async () => {
			const mockModel = {
				getMetadata: vi.fn().mockReturnValue({symbol: 'AAPL'}),
				isTrained: vi.fn().mockReturnValue(true),
			};
			const smallData = mockData.slice(0, 5);

			await expect(engine.predict(mockModel as unknown as LstmModel, smallData, mockAppConfig)).rejects.toThrow(/Insufficient data/);
		});
	});

	describe('generateSignal', () => {
		const basePrediction: PredictionResult = {
			confidence: 0.8,
			currentPrice: 100,
			days: 5,
			fullHistory: [],
			historicalData: [],
			meanAbsoluteError: 0.05,
			percentChange: 0.1,
			predictedData: [],
			predictedPrice: 110,
			predictedPrices: [110],
			predictionDate: new Date(),
			priceChange: 10,
			symbol: 'AAPL',
		};

		it('should generate BUY signal when expected gain exceeds threshold', () => {
			const prediction: PredictionResult = {
				...basePrediction,
				currentPrice: 100,
				percentChange: 0.1,
				predictedPrices: [110],
			};

			const signal = engine.generateSignal(prediction, {...mockAppConfig.prediction, minConfidence: 0.1});
			expect(signal.action).toBe('BUY');
			expect(signal.delta).toBeCloseTo(0.1);
		});

		it('should generate SELL signal when expected loss exceeds threshold', () => {
			const prediction: PredictionResult = {
				...basePrediction,
				currentPrice: 100,
				percentChange: -0.1,
				predictedPrices: [90],
			};

			const signal = engine.generateSignal(prediction, {...mockAppConfig.prediction, minConfidence: 0.1});
			expect(signal.action).toBe('SELL');
			expect(signal.delta).toBeCloseTo(-0.1);
		});

		it('should generate HOLD signal when confidence is too low', () => {
			const prediction: PredictionResult = {
				...basePrediction,
				confidence: 0.5,
				currentPrice: 100,
				percentChange: 0.2,
				predictedPrices: [120],
			};

			const signal = engine.generateSignal(prediction, {...mockAppConfig.prediction, minConfidence: 0.99});
			expect(signal.action).toBe('HOLD');
		});

		it('should generate HOLD signal when change is below threshold', () => {
			const prediction: PredictionResult = {
				...basePrediction,
				confidence: 0.8,
				currentPrice: 100,
				percentChange: 0.01,
				predictedPrices: [101],
			};

			const signal = engine.generateSignal(prediction, mockAppConfig.prediction);
			expect(signal.action).toBe('HOLD');
		});
	});
});
