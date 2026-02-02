import {describe, it, expect, vi, beforeEach} from 'vitest';
import {ModelPersistence} from '../../../src/compute/persistence.ts';
import {LstmModel} from '../../../src/compute/lstm-model.ts';
import * as fs from 'node:fs';
import {remove, ensureDir} from 'fs-extra';
import {join} from 'node:path';
import * as tf from '@tensorflow/tfjs';

vi.mock('node:fs', () => ({
	writeFileSync: vi.fn(),
	readFileSync: vi.fn(),
	existsSync: vi.fn(),
	writeFile: vi.fn(),
	readFile: vi.fn(),
}));

vi.mock('fs-extra', () => ({
	ensureDir: vi.fn().mockResolvedValue(undefined),
	remove: vi.fn().mockResolvedValue(undefined),
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

		// Mock the fs.writeFile to prevent hanging
		vi.mocked(fs.writeFile as any).mockImplementation((_path: any, _data: any, _opts: any, cb: any) => {
			if (typeof _opts === 'function') _opts(null);
			else if (typeof cb === 'function') cb(null);
		});

		await persistence.saveModel('AAPL', mockModel, {
			loss: 0.01,
			accuracy: 0.9,
			isValid: true,
			dataPoints: 100,
			modelType: 'lstm',
			windowSize: 30,
		});

		expect(ensureDir).toHaveBeenCalled();
		expect(mockTfModel.save).toHaveBeenCalled();
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
		vi.mocked(fs.readFile as any).mockImplementation((_path: string, _opts: any, cb: any) => {
			cb(
				null,
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
		});
		vi.mocked(tf.loadLayersModel).mockResolvedValue({
			compile: vi.fn(),
		} as any);

		const model = await persistence.loadModel('AAPL', {ml: {windowSize: 30, learningRate: 0.001}} as any);
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
		vi.mocked(fs.readFile as any).mockImplementation((_path: string, _opts: any, cb: any) => {
			cb(
				null,
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
		});

		const metadata = await persistence.getModelMetadata('AAPL');
		expect(metadata).not.toBeNull();
		expect(metadata?.symbol).toBe('AAPL');
	});

	it('should delete a model', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		await persistence.deleteModel('AAPL');
		expect(remove).toHaveBeenCalledWith(join(mockPath, 'AAPL'));
	});

	it('should delete all models', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		await persistence.deleteAllModels();
		expect(remove).toHaveBeenCalledWith(mockPath);
		expect(ensureDir).toHaveBeenCalledWith(mockPath);
	});
});
