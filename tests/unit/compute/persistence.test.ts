import * as tf from '@tensorflow/tfjs';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import {join} from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {Config} from '../../../src/config/schema.ts';

import {LstmModel, type PerformanceMetrics} from '../../../src/compute/lstm-model.ts';
import {ModelPersistence} from '../../../src/compute/persistence.ts';

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(''),
	rm: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tensorflow/tfjs', () => ({
	loadLayersModel: vi.fn(),
	train: {
		adam: vi.fn(),
	},
}));

describe('ModelPersistence', () => {
	const mockPath = '/test/models';
	let persistence: ModelPersistence;

	beforeEach(() => {
		vi.clearAllMocks();
		persistence = new ModelPersistence(mockPath);
	});

	it('should check if model exists', () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		expect(persistence.modelExists('AAPL')).toBe(true);
		expect(fs.existsSync).toHaveBeenCalledWith(join(mockPath, 'AAPL', 'metadata.json'));
	});

	it('should save a model', async () => {
		const mockTfModel = {
			save: vi.fn().mockResolvedValue({}),
		};
		const mockModel = {
			getMetadata: vi.fn().mockReturnValue({symbol: 'AAPL', trainedAt: new Date(), version: '1.0.0'}),
			getModel: vi.fn().mockReturnValue(mockTfModel),
		} as unknown as LstmModel;

		await persistence.saveModel('AAPL', mockModel, {
			accuracy: 0.9,
			dataPoints: 100,
			isValid: true,
			loss: 0.01,
			windowSize: 30,
		});

		expect(fsPromises.mkdir).toHaveBeenCalled();
		expect(mockTfModel.save).toHaveBeenCalled();
		expect(fsPromises.writeFile).toHaveBeenCalled();
	});

	it('should throw error if model not initialized on save', async () => {
		const mockModel = {
			getModel: vi.fn().mockReturnValue(null),
		} as unknown as LstmModel;

		await expect(persistence.saveModel('AAPL', mockModel, {} as PerformanceMetrics)).rejects.toThrow('Model not initialized');
	});

	it('should throw error if metadata not available on save', async () => {
		const mockModel = {
			getMetadata: vi.fn().mockReturnValue(null),
			getModel: vi.fn().mockReturnValue({save: vi.fn()}),
		} as unknown as LstmModel;

		await expect(persistence.saveModel('AAPL', mockModel, {} as PerformanceMetrics)).rejects.toThrow('Model metadata not available');
	});

	it('should load a model', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fsPromises.readFile).mockResolvedValue(
			JSON.stringify({
				dataPoints: 100,
				loss: 0.01,
				metrics: {},
				symbol: 'AAPL',
				trainedAt: new Date().toISOString(),
				version: '1.0.0',
				windowSize: 30,
			}),
		);
		vi.mocked(tf.loadLayersModel).mockResolvedValue({
			compile: vi.fn(),
		} as unknown as tf.LayersModel);

		const model = await persistence.loadModel('AAPL', {model: {learningRate: 0.001, windowSize: 30}} as Config);
		expect(model).not.toBeNull();
		expect(tf.loadLayersModel).toHaveBeenCalled();
	});

	it('should return null if metadata or model file not found on load', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		const model = await persistence.loadModel('AAPL', {} as Config);
		expect(model).toBeNull();
	});

	it('should get model metadata', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fsPromises.readFile).mockResolvedValue(
			JSON.stringify({
				dataPoints: 100,
				loss: 0.01,
				metrics: {},
				symbol: 'AAPL',
				trainedAt: new Date().toISOString(),
				version: '1.0.0',
				windowSize: 30,
			}),
		);

		const metadata = await persistence.getModelMetadata('AAPL');
		expect(metadata).not.toBeNull();
		expect(metadata?.symbol).toBe('AAPL');
	});

	it('should delete a model', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		await persistence.deleteModel('AAPL');
		expect(fsPromises.rm).toHaveBeenCalledWith(join(mockPath, 'AAPL'), {force: true, recursive: true});
	});

	it('should delete all models', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		await persistence.deleteAllModels();
		expect(fsPromises.rm).toHaveBeenCalledWith(mockPath, {force: true, recursive: true});
		expect(fsPromises.mkdir).toHaveBeenCalledWith(mockPath, {recursive: true});
	});
});
