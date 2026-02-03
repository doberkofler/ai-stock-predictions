import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import type {Config} from '../../../src/config/schema.ts';
import type {StockDataPoint} from '../../../src/types/index.ts';

import {LstmModel} from '../../../src/compute/lstm-model.ts';
import {initializeEnvironment} from '../../../src/env.ts';

describe('LstmModel', () => {
	beforeAll(async () => {
		await initializeEnvironment();
	});

	const mockMlConfig = {
		batchSize: 2,
		epochs: 1,
		learningRate: 0.01,
		modelType: 'lstm' as const,
		windowSize: 5,
	};

	const mockAppConfig: Config = {
		aBTesting: {enabled: false},
		dataSource: {rateLimit: 100, retries: 3, timeout: 5000},
		market: {
			featureConfig: {
				enabled: true,
				includeBeta: true,
				includeCorrelation: true,
				includeRegime: true,
				includeVix: true,
			},
			indices: [],
		},
		model: mockMlConfig,
		prediction: {
			buyThreshold: 0.05,
			contextDays: 5,
			days: 1,
			directory: 'output',
			historyChartDays: 10,
			minConfidence: 0.6,
			sellThreshold: -0.05,
		},
		training: {minNewDataPoints: 5},
	};

	const mockData: StockDataPoint[] = Array.from({length: 15}, (_, i) => ({
		adjClose: 102 + i,
		close: 102 + i,
		date: `2023-01-${(i + 1).toString().padStart(2, '0')}`,
		high: 105 + i,
		low: 95 + i,
		open: 100 + i,
		volume: 1000 * (i + 1),
	}));

	let model: LstmModel;

	beforeEach(() => {
		model = new LstmModel(mockMlConfig);
	});

	it('should initialize with correct config', () => {
		expect(model).toBeDefined();
		expect(model.isTrained()).toBe(false);
	});

	it('should train the model', async () => {
		const metrics = await model.train(mockData, mockAppConfig);
		expect(metrics).toBeDefined();
		expect(metrics.loss).toBeDefined();
		expect(model.isTrained()).toBe(true);
		expect(model.getMetadata()).toBeDefined();
		expect(model.getMetadata()?.symbol).toBe('UNKNOWN');
	}, 30000);

	it('should throw error if data is insufficient', async () => {
		const smallData = mockData.slice(0, 5);
		await expect(model.train(smallData, mockAppConfig)).rejects.toThrow('Insufficient data');
	});

	it('should evaluate the model', async () => {
		await model.train(mockData, mockAppConfig);
		const performance = await model.evaluate(mockData, mockAppConfig);
		expect(performance).toBeDefined();
		expect(performance.loss).toBeGreaterThanOrEqual(0);
	}, 30000);

	it('should predict future prices', async () => {
		await model.train(mockData, mockAppConfig);
		const predictions = await model.predict(mockData, 3);
		expect(predictions).toHaveLength(3);
		expect(predictions.every((p) => typeof p === 'number')).toBe(true);
	}, 30000);

	it('should get internal model', async () => {
		await model.train(mockData, mockAppConfig);
		expect(model.getModel()).not.toBeNull();
	}, 30000);

	it('should set internal model', async () => {
		await model.train(mockData, mockAppConfig);
		const tfModel = model.getModel();
		const metadata = model.getMetadata();
		if (tfModel && metadata) {
			const newModel = new LstmModel(mockMlConfig);
			newModel.setModel(tfModel, metadata);
			expect(newModel.isTrained()).toBe(true);
		}
	}, 30000);
});
