import {describe, it, expect, vi, beforeEach} from 'vitest';
import {ModelPersistence} from '../../../src/compute/persistence.ts';
import {LstmModel} from '../../../src/compute/lstm-model.ts';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import {join} from 'node:path';
import * as tf from '@tensorflow/tfjs';

vi.mock('node:fs', () => ({
	existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	rm: vi.fn().mockResolvedValue(undefined),
	readFile: vi.fn().mockResolvedValue(''),
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
			getMetadata: vi.fn().mockReturnValue({version: '1.0.0', trainedAt: new Date(), symbol: 'AAPL'}),
			getModel: vi.fn().mockReturnValue(mockTfModel),
		} as unknown as LstmModel;

		await persistence.saveModel('AAPL', mockModel, {
			loss: 0.01,
			accuracy: 0.9,
			isValid: true,
			dataPoints: 100,
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

		await expect(persistence.saveModel('AAPL', mockModel, {} as any)).rejects.toThrow('Model not initialized');
	});

	it('should throw error if metadata not available on save', async () => {
		const mockModel = {
			getModel: vi.fn().mockReturnValue({save: vi.fn()}),
			getMetadata: vi.fn().mockReturnValue(null),
		} as unknown as LstmModel;

		await expect(persistence.saveModel('AAPL', mockModel, {} as any)).rejects.toThrow('Model metadata not available');
	});

	it('should load a model', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fsPromises.readFile).mockResolvedValue(
			JSON.stringify({
				version: '1.0.0',
				trainedAt: new Date().toISOString(),
				metrics: {},
				symbol: 'AAPL',
				dataPoints: 100,
				loss: 0.01,
				windowSize: 30,
			}),
		);
		vi.mocked(tf.loadLayersModel).mockResolvedValue({
			compile: vi.fn(),
		} as any);

		const model = await persistence.loadModel('AAPL', {model: {windowSize: 30, learningRate: 0.001}} as any);
		expect(model).not.toBeNull();
		expect(tf.loadLayersModel).toHaveBeenCalled();
	});

	it('should return null if metadata or model file not found on load', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		const model = await persistence.loadModel('AAPL', {} as any);
		expect(model).toBeNull();
	});

	it('should get model metadata', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fsPromises.readFile).mockResolvedValue(
			JSON.stringify({
				version: '1.0.0',
				trainedAt: new Date().toISOString(),
				metrics: {},
				symbol: 'AAPL',
				dataPoints: 100,
				loss: 0.01,
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
