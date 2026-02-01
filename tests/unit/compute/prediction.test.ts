import {describe, it, expect, beforeEach, vi} from 'vitest';
import {PredictionEngine} from '@/compute/prediction';
import type {PredictionResult} from '@/types';
import type {TradingConfig, StockDataPoint} from '@/types';
import type {Config} from '@/config/schema';

describe('PredictionEngine', () => {
	let engine: PredictionEngine;
	const mockTradingConfig: TradingConfig = {
		buyThreshold: 0.05,
		sellThreshold: -0.05,
		minConfidence: 0.6,
	};

	const mockAppConfig: Config = {
		symbols: [{symbol: 'AAPL', name: 'Apple Inc.'}],
		prediction: {days: 1, trainSplit: 0.8},
		training: {incremental: true, retrain: false, minNewDataPoints: 5},
		trading: mockTradingConfig,
		api: {timeout: 5000, retries: 3, rateLimit: 100},
		output: {directory: 'output', template: 'default', includeCharts: true, chartsType: 'both'},
		ml: {modelType: 'lstm', windowSize: 10, epochs: 2, learningRate: 0.001, batchSize: 32},
	};

	const mockData: StockDataPoint[] = Array.from({length: 20}, (_, i) => ({
		date: `2023-01-${String(i + 1).padStart(2, '0')}`,
		open: 100 + i,
		high: 105 + i,
		low: 95 + i,
		close: 102 + i,
		volume: 1000,
		adjClose: 102 + i,
	}));

	beforeEach(() => {
		engine = new PredictionEngine();
	});

	describe('predict', () => {
		it('should generate prediction result if model is trained and data is sufficient', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(true),
				predict: vi.fn().mockResolvedValue([110]),
				getMetadata: vi.fn().mockReturnValue({
					loss: 0.01,
					metrics: {meanAbsoluteError: 0.02},
					dataPoints: 100,
				}),
			};

			const result = await engine.predict(mockModel as any, mockData, mockAppConfig);

			expect(result.currentPrice).toBe(102 + 19);
			expect(result.predictedPrices).toEqual([110]);
			expect(result.confidence).toBeGreaterThan(0);
		});

		it('should throw error if model is not trained', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(false),
			};

			await expect(engine.predict(mockModel as any, mockData, mockAppConfig)).rejects.toThrow(/Model must be trained/);
		});

		it('should throw error if data is insufficient', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(true),
			};
			const smallData = mockData.slice(0, 5);

			await expect(engine.predict(mockModel as any, smallData, mockAppConfig)).rejects.toThrow(/Insufficient data/);
		});

		it('should throw error if no data points provided even if windowSize is 0', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(true),
			};
			const configWithZeroWindow = {...mockAppConfig, ml: {...mockAppConfig.ml, windowSize: 0}};
			await expect(engine.predict(mockModel as any, [], configWithZeroWindow as any)).rejects.toThrow(/No data points available/);
		});
	});

	describe('generateSignal', () => {
		it('should generate BUY signal when expected gain exceeds threshold', () => {
			const prediction: PredictionResult = {
				currentPrice: 100,
				predictedPrices: [110, 115], // 10% gain
				confidence: 0.8,
				meanAbsoluteError: 0.01,
			};

			const signal = engine.generateSignal(prediction, mockTradingConfig);
			expect(signal.action).toBe('BUY');
			expect(signal.delta).toBeCloseTo(0.1);
		});

		it('should generate SELL signal when expected loss exceeds threshold', () => {
			const prediction: PredictionResult = {
				currentPrice: 100,
				predictedPrices: [90, 85], // 10% loss
				confidence: 0.8,
				meanAbsoluteError: 0.01,
			};

			const signal = engine.generateSignal(prediction, mockTradingConfig);
			expect(signal.action).toBe('SELL');
			expect(signal.delta).toBeCloseTo(-0.1);
		});

		it('should generate HOLD signal when confidence is too low', () => {
			const prediction: PredictionResult = {
				currentPrice: 100,
				predictedPrices: [120], // 20% gain but...
				confidence: 0.4, // ...low confidence
				meanAbsoluteError: 0.01,
			};

			const signal = engine.generateSignal(prediction, mockTradingConfig);
			expect(signal.action).toBe('HOLD');
			expect(signal.reason).toContain('Low confidence');
		});

		it('should generate HOLD signal when change is within thresholds', () => {
			const prediction: PredictionResult = {
				currentPrice: 100,
				predictedPrices: [102], // 2% gain
				confidence: 0.8,
				meanAbsoluteError: 0.01,
			};

			const signal = engine.generateSignal(prediction, mockTradingConfig);
			expect(signal.action).toBe('HOLD');
			expect(signal.reason).toContain('Neutral');
		});

		it('should handle undefined predicted prices', () => {
			const prediction: PredictionResult = {
				currentPrice: 100,
				predictedPrices: [],
				confidence: 0.8,
				meanAbsoluteError: 0.01,
			};

			const signal = engine.generateSignal(prediction, mockTradingConfig);
			expect(signal.action).toBe('HOLD');
			expect(signal.delta).toBe(0);
		});
	});

	describe('calculateConfidence', () => {
		it('should return 0.5 if metadata is null', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(true),
				predict: vi.fn().mockResolvedValue([110]),
				getMetadata: vi.fn().mockReturnValue(null),
			};

			const result = await engine.predict(mockModel as any, mockData, mockAppConfig);
			expect(result.confidence).toBe(0.5);
		});

		it('should calculate confidence based on loss and MAE', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(true),
				predict: vi.fn().mockResolvedValue([110]),
				getMetadata: vi.fn().mockReturnValue({
					loss: 0.05,
					metrics: {meanAbsoluteError: 0.01},
					dataPoints: 500,
				}),
			};

			const result = await engine.predict(mockModel as any, mockData, mockAppConfig);
			expect(result.confidence).toBeGreaterThan(0.5);
		});
	});
});
