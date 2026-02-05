import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {Config} from '../../../src/config/schema.ts';
import type {MarketFeatures, StockDataPoint} from '../../../src/types/index.ts';

import {HyperparameterTuner} from '../../../src/compute/tuner.ts';

// Mock LstmModel to avoid actual training overhead
const mockTrain = vi.fn().mockResolvedValue({
	loss: 0.1,
	mape: 0.05,
	isValid: true,
});

const mockEvaluate = vi.fn().mockReturnValue({
	loss: 0.1,
	mape: 0.05,
	isValid: true,
});

const mockDispose = vi.fn();

vi.mock('../../../src/compute/lstm-model.ts', () => {
	return {
		LstmModel: class {
			public train = mockTrain;
			public evaluate = mockEvaluate;
			public getModel = vi.fn().mockReturnValue({
				dispose: mockDispose,
			});
		},
	};
});

describe('HyperparameterTuner', () => {
	const mockConfig: Config = {
		aBTesting: {enabled: false},
		backtest: {enabled: true, initialCapital: 10000, transactionCost: 0.001},
		dataSource: {rateLimit: 1000, retries: 3, timeout: 10000},
		market: {
			featureConfig: {
				enabled: true,
				includeBeta: true,
				includeCorrelation: true,
				includeDistanceFromMA: true,
				includeMarketReturn: true,
				includeRegime: true,
				includeRelativeReturn: true,
				includeVix: true,
				includeVolatilitySpread: true,
			},
			primaryIndex: '^GSPC',
			volatilityIndex: '^VIX',
		},
		model: {
			architecture: 'lstm',
			batchSize: 128,
			dropout: 0.2,
			epochs: 50,
			l1Regularization: 0.001,
			l2Regularization: 0.001,
			learningRate: 0.001,
			recurrentDropout: 0.1,
			windowSize: 30,
		},
		prediction: {
			buyThreshold: 0.05,
			contextDays: 15,
			days: 30,
			directory: 'output',
			historyChartDays: 1825,
			minConfidence: 0.6,
			sellThreshold: -0.05,
			uncertaintyIterations: 10,
		},
		training: {
			minNewDataPoints: 50,
			minQualityScore: 60,
		},
		tuning: {
			architecture: ['lstm'],
			batchSize: [32, 64],
			enabled: true,
			epochs: [10],
			learningRate: [0.001],
			maxTrials: 5,
			validationSplits: 2,
			windowSize: [10],
		},
	};

	const mockData: StockDataPoint[] = Array.from({length: 100}, (_, i) => ({
		adjClose: 100 + i,
		close: 100 + i,
		date: `2023-01-${String(i + 1).padStart(2, '0')}`,
		high: 105 + i,
		low: 95 + i,
		open: 100 + i,
		volume: 1000,
	}));

	const mockMarketFeatures: MarketFeatures[] = [];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should generate a grid and run trials', async () => {
		const tuner = new HyperparameterTuner(mockConfig);
		const onProgress = vi.fn();

		const result = await tuner.tune('AAPL', mockData, mockMarketFeatures, onProgress);

		expect(result).toBeDefined();
		expect(result.params).toBeDefined();
		// 1 architecture * 2 batchSizes * 1 epoch * 1 learningRate * 1 windowSize = 2 combinations
		expect(onProgress).toHaveBeenCalledTimes(2);
		expect(mockTrain).toHaveBeenCalled();
		expect(mockEvaluate).toHaveBeenCalled();
	});

	it('should respect maxTrials limit', async () => {
		const limitedConfig = {
			...mockConfig,
			tuning: {
				...mockConfig.tuning,
				maxTrials: 1,
			},
		};
		const tuner = new HyperparameterTuner(limitedConfig);
		const onProgress = vi.fn();

		await tuner.tune('AAPL', mockData, mockMarketFeatures, onProgress);

		expect(onProgress).toHaveBeenCalledTimes(1);
	});

	it('should fallback to single split if data is insufficient for CV', async () => {
		const smallData = mockData.slice(0, 40); // Not enough for 2 splits + window
		const tuner = new HyperparameterTuner(mockConfig);

		await tuner.tune('AAPL', smallData, mockMarketFeatures);

		// Should still run, but maybe use evaluateSingleSplit internally
		// We can't easily spy on private methods, but we can verify it succeeded
		expect(mockTrain).toHaveBeenCalled();
	});

	it('should throw error if tuning fails to produce results', async () => {
		const tuner = new HyperparameterTuner({
			...mockConfig,
			tuning: {
				...mockConfig.tuning,
				maxTrials: 0, // Should result in no trials
			},
		});

		await expect(tuner.tune('AAPL', mockData, mockMarketFeatures)).rejects.toThrow('Tuning failed');
	});
});
