import {describe, it, expect, vi, beforeEach} from 'vitest';
import {LstmModel} from '@/compute/lstm-model.ts';
import * as tf from '@tensorflow/tfjs';
import type {StockDataPoint} from '@/types/index.ts';
import type {Config} from '@/config/schema.ts';

vi.mock('@tensorflow/tfjs', async () => {
	const original = await vi.importActual<any>('@tensorflow/tfjs');
	return {
		...original,
		sequential: vi.fn().mockReturnValue({
			add: vi.fn(),
			compile: vi.fn(),
			fit: vi.fn().mockResolvedValue({
				history: {
					loss: [0.1, 0.05],
					val_loss: [0.12, 0.06],
					mae: [0.08, 0.04],
				},
			}),
			evaluate: vi.fn().mockReturnValue([{dataSync: () => [0.05]}, {dataSync: () => [0.04]}]),
			predict: vi.fn().mockReturnValue({
				array: vi.fn().mockResolvedValue([[0.5]]),
				dispose: vi.fn(),
			}),
			save: vi.fn().mockResolvedValue({}),
			dispose: vi.fn(),
		}),
		layers: {
			dense: vi.fn(),
			reshape: vi.fn(),
			lstm: vi.fn(),
		},
		train: {
			adam: vi.fn(),
		},
		tensor2d: vi.fn().mockReturnValue({
			dispose: vi.fn(),
			expandDims: vi.fn().mockReturnThis(),
			array: vi.fn().mockResolvedValue([[0.5]]),
		}),
	};
});

describe('LstmModel', () => {
	let model: LstmModel;
	const mockMlConfig = {
		modelType: 'lstm' as const,
		windowSize: 10,
		epochs: 2,
		learningRate: 0.001,
		batchSize: 32,
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

	const mockAppConfig: Config = {
		prediction: {days: 1, trainSplit: 0.8},
		training: {incremental: true, retrain: false, minNewDataPoints: 5},
		trading: {buyThreshold: 0.05, sellThreshold: -0.05, minConfidence: 0.6},
		api: {timeout: 5000, retries: 3, rateLimit: 100},
		output: {directory: 'output', template: 'default', includeCharts: true, chartsType: 'both'},
		ml: mockMlConfig,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		model = new LstmModel(mockMlConfig);
	});

	it('should initialize with correct config', () => {
		expect(model).toBeDefined();
		expect(model.isTrained()).toBe(false);
	});

	it('should train the model', async () => {
		const progressCallback = vi.fn();
		await model.train(mockData, mockAppConfig, progressCallback);

		expect(tf.sequential).toHaveBeenCalled();
		expect(model.isTrained()).toBe(true);
		expect(model.getMetadata()).toBeDefined();
		expect(model.getMetadata()?.symbol).toBe('UNKNOWN');
	});

	it('should throw error if insufficient data for training', async () => {
		const smallData = mockData.slice(0, 5);
		await expect(model.train(smallData, mockAppConfig)).rejects.toThrow(/Insufficient data/);
	});

	it('should evaluate the model', async () => {
		await model.train(mockData, mockAppConfig);
		const result = await model.evaluate(mockData, mockAppConfig);

		expect(result).toBeDefined();
		expect(result.loss).toBeTypeOf('number');
		expect(result.accuracy).toBeGreaterThanOrEqual(0);
	});

	it('should predict future prices', async () => {
		await model.train(mockData, mockAppConfig);
		const predictions = await model.predict(mockData, mockAppConfig);

		expect(predictions).toHaveLength(mockAppConfig.prediction.days);
		expect(predictions[0]).toBeTypeOf('number');
	});

	it('should use existing model if already created', async () => {
		await model.train(mockData, mockAppConfig);
		const initialModel = model.getModel();
		await model.train(mockData, mockAppConfig);
		expect(model.getModel()).toBe(initialModel);
	});

	it('should throw error if insufficient data for evaluation', async () => {
		await model.train(mockData, mockAppConfig);
		const smallData = mockData.slice(0, 5);
		await expect(model.evaluate(smallData, mockAppConfig)).rejects.toThrow(/Insufficient data for evaluation/);
	});

	it('should throw error if model not trained before prediction', async () => {
		await expect(model.predict(mockData, mockAppConfig)).rejects.toThrow(/Model must be trained before prediction/);
	});

	it('should throw error if insufficient data for prediction', async () => {
		await model.train(mockData, mockAppConfig);
		const smallData = mockData.slice(0, 5);
		await expect(model.predict(smallData, mockAppConfig)).rejects.toThrow(/Insufficient data for prediction/);
	});

	it('should train with missing validation metrics', async () => {
		vi.mocked(tf.sequential().fit).mockResolvedValueOnce({
			history: {
				loss: [0.1],
				// missing val_loss and mae
			},
		} as any);
		await model.train(mockData, mockAppConfig);
		const metadata = model.getMetadata();
		expect(metadata?.metrics['finalLoss']).toBe(0.1);
	});

	it('should throw error if model not trained before evaluation', async () => {
		await expect(model.evaluate(mockData, mockAppConfig)).rejects.toThrow(/Model must be trained before evaluation/);
	});
});
