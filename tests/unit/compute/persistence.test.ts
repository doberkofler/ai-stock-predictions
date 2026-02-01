import {describe, it, expect, vi, beforeEach} from 'vitest';
import {ModelPersistence} from '@/compute/persistence.ts';
import {LstmModel} from '@/compute/lstm-model.ts';
import * as tf from '@tensorflow/tfjs';
import * as fs from 'node:fs';
import {ensureDir} from 'fs-extra';

vi.mock('fs-extra', () => ({
	ensureDir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
	readFile: vi.fn(),
	writeFile: vi.fn(),
}));

vi.mock('@tensorflow/tfjs', () => {
	return {
		loadLayersModel: vi.fn().mockResolvedValue({
			compile: vi.fn(),
		}),
		train: {
			adam: vi.fn(),
		},
	};
});

vi.mock('node:util', () => ({
	promisify: (fn: any) => {
		return (...args: any[]) => {
			return new Promise((resolve, reject) => {
				fn(...args, (err: any, result: any) => {
					if (err) reject(err);
					else resolve(result);
				});
			});
		};
	},
}));

describe('ModelPersistence', () => {
	let persistence: ModelPersistence;
	const mockModelsPath = './test-models';

	beforeEach(() => {
		vi.clearAllMocks();
		persistence = new ModelPersistence(mockModelsPath);
	});

	it('should check if model exists', () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		expect(persistence.modelExists('AAPL')).toBe(true);
	});

	it('should get model metadata', async () => {
		const mockMetadata = {
			symbol: 'AAPL',
			version: '1.0.0',
			trainedAt: '2023-01-01T00:00:00.000Z',
			dataPoints: 100,
			loss: 0.01,
			windowSize: 30,
			metrics: {mae: 0.05},
		};
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFile).mockImplementation((_path, _options, callback: any) => {
			callback(null, JSON.stringify(mockMetadata));
		});

		const result = await persistence.getModelMetadata('AAPL');
		expect(result?.symbol).toBe('AAPL');
		expect(result?.trainedAt).toBeInstanceOf(Date);
	});

	it('should save model and metadata', async () => {
		const mockTfModel = {
			save: vi.fn().mockResolvedValue({}),
		};
		const mockLstmModel = {
			getMetadata: vi.fn().mockReturnValue({symbol: 'AAPL', trainedAt: new Date()}),
			getModel: vi.fn().mockReturnValue(mockTfModel),
		};
		const mockPerformance = {
			loss: 0.01,
			accuracy: 0.9,
			meanAbsoluteError: 0.05,
			rootMeanSquaredError: 0.02,
			epochs: 50,
			trainingTime: 1000,
			isValid: true,
			dataPoints: 100,
			modelType: 'lstm',
			windowSize: 30,
		};

		vi.mocked(fs.writeFile).mockImplementation((_path, _data, _options, callback: any) => {
			callback(null);
		});

		await persistence.saveModel('AAPL', mockLstmModel as any, mockPerformance);

		expect(ensureDir).toHaveBeenCalled();
		expect(mockTfModel.save).toHaveBeenCalled();
		expect(fs.writeFile).toHaveBeenCalled();
	});

	it('should throw error if saving untrained model', async () => {
		const mockLstmModel = {
			getMetadata: vi.fn().mockReturnValue(null),
		};
		await expect(persistence.saveModel('AAPL', mockLstmModel as any, {} as any)).rejects.toThrow(/Cannot save untrained model/);
	});

	it('should throw error if underlying tf model is missing during save', async () => {
		const mockLstmModel = {
			getMetadata: vi.fn().mockReturnValue({symbol: 'AAPL'}),
			getModel: vi.fn().mockReturnValue(null),
		};
		await expect(persistence.saveModel('AAPL', mockLstmModel as any, {} as any)).rejects.toThrow(/Underlying TensorFlow model is missing/);
	});

	it('should load model and metadata', async () => {
		const mockAppConfig = {ml: {windowSize: 30, learningRate: 0.001}};
		const mockMetadata = {
			version: '1.0.0',
			trainedAt: '2023-01-01T00:00:00.000Z',
			dataPoints: 100,
			loss: 0.01,
			windowSize: 30,
			metrics: {mae: 0.05},
			symbol: 'AAPL',
		};

		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFile).mockImplementation((_path, _options, callback: any) => {
			callback(null, JSON.stringify(mockMetadata));
		});

		const result = await persistence.loadModel('AAPL', mockAppConfig as any);
		expect(result).toBeDefined();
		expect(tf.loadLayersModel).toHaveBeenCalled();
	});

	it('should throw ModelError if metadata loading fails', async () => {
		const mockAppConfig = {ml: {windowSize: 30}};
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFile).mockImplementation((_path, _options, callback: any) => {
			callback(new Error('Read error'));
		});

		await expect(persistence.loadModel('AAPL', mockAppConfig as any)).rejects.toThrow(/Failed to load model/);
	});

	it('should return null if metadata does not exist in getModelMetadata', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		const result = await persistence.getModelMetadata('AAPL');
		expect(result).toBeNull();
	});

	it('should load model and metadata even if trainedAt is already a Date', async () => {
		const mockAppConfig = {ml: {windowSize: 30, learningRate: 0.001}};
		const mockMetadata = {
			version: '1.0.0',
			trainedAt: new Date('2023-01-01T00:00:00.000Z'),
			dataPoints: 100,
			loss: 0.01,
			windowSize: 30,
			metrics: {mae: 0.05},
			symbol: 'AAPL',
		};

		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFile).mockImplementation((_path, _options, callback: any) => {
			callback(null, JSON.stringify(mockMetadata));
		});

		const result = await persistence.loadModel('AAPL', mockAppConfig as any);
		expect(result).toBeDefined();
	});
});
