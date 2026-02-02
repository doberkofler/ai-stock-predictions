import {describe, it, expect, vi, beforeEach} from 'vitest';
import {ModelPersistence} from '@/compute/persistence.ts';
import * as fs from 'node:fs';
import {remove, ensureDir} from 'fs-extra';
import {join} from 'node:path';

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

	it('should return null if metadata not found', async () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		const metadata = await persistence.getModelMetadata('AAPL');
		expect(metadata).toBeNull();
	});
});
