import {describe, it, expect, beforeEach, vi} from 'vitest';
import {PredictionEngine} from '../../../src/compute/prediction.ts';
import type {TradingConfig, StockDataPoint} from '../../../src/types/index.ts';
import type {Config} from '../../../src/config/schema.ts';

describe('PredictionEngine', () => {
	let engine: PredictionEngine;
	const mockTradingConfig: TradingConfig = {
		buyThreshold: 0.05,
		sellThreshold: -0.05,
		minConfidence: 0.6,
	};

	const mockAppConfig: Config = {
		dataSource: {timeout: 5000, retries: 3, rateLimit: 100},
		training: {minNewDataPoints: 5},
		model: {windowSize: 10, epochs: 2, learningRate: 0.001, batchSize: 32},
		prediction: {
			days: 1,
			historyChartDays: 1825,
			contextDays: 15,
			directory: 'output',
			buyThreshold: 0.05,
			sellThreshold: -0.05,
			minConfidence: 0.6,
		},
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
					symbol: 'AAPL',
					loss: 0.01,
					metrics: {meanAbsoluteError: 0.02},
					dataPoints: 100,
				}),
			};

			const result = await engine.predict(mockModel as any, mockData, mockAppConfig);

			expect(result.currentPrice).toBe(102 + 19);
			expect(result.predictedPrices).toEqual([110]);
			expect(result.confidence).toBeGreaterThan(0);
			expect(result.fullHistory).toBeDefined();
		});

		it('should throw error if model is not trained', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(false),
				getMetadata: vi.fn().mockReturnValue({symbol: 'AAPL'}),
			};

			await expect(engine.predict(mockModel as any, mockData, mockAppConfig)).rejects.toThrow(/not trained/);
		});

		it('should throw error if data is insufficient', async () => {
			const mockModel = {
				isTrained: vi.fn().mockReturnValue(true),
				getMetadata: vi.fn().mockReturnValue({symbol: 'AAPL'}),
			};
			const smallData = mockData.slice(0, 5);

			await expect(engine.predict(mockModel as any, smallData, mockAppConfig)).rejects.toThrow(/Insufficient data/);
		});
	});

	describe('generateSignal', () => {
		it('should generate BUY signal when expected gain exceeds threshold', () => {
			const prediction: any = {
				symbol: 'AAPL',
				currentPrice: 100,
				predictedPrice: 110,
				percentChange: 0.1,
			};

			const signal = engine.generateSignal(prediction, {...mockAppConfig.prediction, minConfidence: 0.1});
			expect(signal.action).toBe('BUY');
			expect(signal.delta).toBeCloseTo(0.1);
		});

		it('should generate SELL signal when expected loss exceeds threshold', () => {
			const prediction: any = {
				symbol: 'AAPL',
				currentPrice: 100,
				predictedPrice: 90,
				percentChange: -0.1,
			};

			const signal = engine.generateSignal(prediction, {...mockAppConfig.prediction, minConfidence: 0.1});
			expect(signal.action).toBe('SELL');
			expect(signal.delta).toBeCloseTo(-0.1);
		});

		it('should generate HOLD signal when confidence is too low', () => {
			const prediction: any = {
				symbol: 'AAPL',
				currentPrice: 100,
				predictedPrice: 120,
				percentChange: 0.2,
			};

			const signal = engine.generateSignal(prediction, {...mockAppConfig.prediction, minConfidence: 0.99});
			expect(signal.action).toBe('HOLD');
		});

		it('should generate HOLD signal when change is below threshold', () => {
			const prediction: any = {
				symbol: 'AAPL',
				currentPrice: 100,
				predictedPrice: 101,
				percentChange: 0.01,
			};

			const signal = engine.generateSignal(prediction, mockAppConfig.prediction);
			expect(signal.action).toBe('HOLD');
		});
	});
});
