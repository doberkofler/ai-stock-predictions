import {describe, it, expect, vi, beforeEach} from 'vitest';
import * as tf from '@tensorflow/tfjs';
import {ModelPersistence} from '../../../src/compute/persistence.ts';
import {FsUtils} from '../../../src/cli/utils/fs.ts';
import {LstmModel} from '../../../src/compute/lstm-model.ts';
import {EnsembleModel} from '../../../src/compute/ensemble.ts';

vi.mock('@tensorflow/tfjs', () => ({
	loadLayersModel: vi.fn().mockResolvedValue({
		compile: vi.fn(),
		save: vi.fn().mockResolvedValue({}),
	}),
	train: {
		adam: vi.fn().mockReturnValue({}),
	},
}));

vi.mock('../../../src/cli/utils/fs.ts', () => ({
	FsUtils: {
		recreateDir: vi.fn(),
		deletePath: vi.fn(),
		exists: vi.fn(),
		readJson: vi.fn(),
		writeJson: vi.fn(),
		ensureDir: vi.fn(),
	},
}));

vi.mock('../../../src/compute/lstm-model.ts', () => {
	const LstmModel = vi.fn();
	LstmModel.prototype.setModel = vi.fn();
	LstmModel.prototype.getModel = vi.fn();
	LstmModel.prototype.getMetadata = vi.fn();
	return {LstmModel};
});

vi.mock('../../../src/compute/ensemble.ts', () => {
	const EnsembleModel = vi.fn();
	EnsembleModel.prototype.getModels = vi.fn().mockReturnValue([]);
	EnsembleModel.prototype.getWeights = vi.fn().mockReturnValue([]);
	return {EnsembleModel};
});

describe('ModelPersistence', () => {
	const modelsPath = '/mock/models';
	let persistence: ModelPersistence;
	const mockConfig = {
		model: {learningRate: 0.001},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		persistence = new ModelPersistence(modelsPath);
	});

	it('should delete all models', async () => {
		await persistence.deleteAllModels();
		expect(FsUtils.recreateDir).toHaveBeenCalledWith(modelsPath);
	});

	it('should delete model for a symbol', async () => {
		await persistence.deleteModel('AAPL');
		expect(FsUtils.deletePath).toHaveBeenCalledWith(expect.stringContaining('AAPL'));
	});

	it('should get model metadata', async () => {
		const mockMetadata = {
			symbol: 'AAPL',
			trainedAt: '2024-01-01T00:00:00.000Z',
			version: '1.0.0',
			loss: 0.1,
			windowSize: 10,
			dataPoints: 100,
			metrics: {finalLoss: 0.1, meanAbsoluteError: 0.05},
			featureConfig: {enabled: false, windowSize: 10, includeMarketContext: false, includeVix: false, useLogReturns: false},
		};
		vi.mocked(FsUtils.exists).mockReturnValue(true);
		vi.mocked(FsUtils.readJson).mockResolvedValue(mockMetadata);

		const result = await persistence.getModelMetadata('AAPL');
		expect(result?.symbol).toBe('AAPL');
		expect(result?.trainedAt).toBeInstanceOf(Date);
	});

	it('should return null if metadata does not exist', async () => {
		vi.mocked(FsUtils.exists).mockReturnValue(false);
		const result = await persistence.getModelMetadata('AAPL');
		expect(result).toBeNull();
	});

	it('should load a single model', async () => {
		vi.mocked(FsUtils.exists).mockImplementation((path: string) => !path.includes('ensemble.json'));
		vi.mocked(FsUtils.readJson).mockResolvedValue({
			symbol: 'AAPL',
			trainedAt: '2024-01-01T00:00:00.000Z',
			version: '1.0.0',
			loss: 0.1,
			windowSize: 10,
			dataPoints: 100,
			metrics: {finalLoss: 0.1, meanAbsoluteError: 0.05},
			featureConfig: {enabled: false, windowSize: 10, includeMarketContext: false, includeVix: false, useLogReturns: false},
		});

		const result = await persistence.loadModel('AAPL', mockConfig as any);
		expect(result).toBeInstanceOf(LstmModel);
		expect(tf.loadLayersModel).toHaveBeenCalled();
	});

	it('should load an ensemble model with sub-models', async () => {
		vi.mocked(FsUtils.exists).mockImplementation(
			(path: string) => path.includes('ensemble.json') || path.includes('metadata.json') || path.includes('model.json'),
		);
		vi.mocked(FsUtils.readJson).mockImplementation(async (path: string) => {
			if (path.includes('ensemble.json')) {
				return {
					architectures: ['lstm', 'gru'],
					timestamp: '2024-01-01T00:00:00.000Z',
					weights: [0.6, 0.4],
				};
			}
			return {
				symbol: 'AAPL',
				trainedAt: '2024-01-01T00:00:00.000Z',
				version: '1.0.0',
				loss: 0.1,
				windowSize: 10,
				dataPoints: 100,
				metrics: {finalLoss: 0.1, meanAbsoluteError: 0.05},
				featureConfig: {enabled: false, windowSize: 10, includeMarketContext: false, includeVix: false, useLogReturns: false},
				modelArchitecture: 'lstm',
			};
		});

		const result = await persistence.loadModel('AAPL', mockConfig as any);
		expect(result).toBeInstanceOf(EnsembleModel);
		expect(tf.loadLayersModel).toHaveBeenCalledTimes(2);
	});

	it('should check if model exists', () => {
		vi.mocked(FsUtils.exists).mockReturnValue(true);
		expect(persistence.modelExists('AAPL')).toBe(true);
	});

	it('should save a single model', async () => {
		const mockModel = new LstmModel({} as any, {} as any);
		const mockTfModel = {save: vi.fn()} as any;
		vi.mocked(mockModel.getModel).mockReturnValue(mockTfModel);
		vi.mocked(mockModel.getMetadata).mockReturnValue({symbol: 'AAPL'} as any);

		await persistence.saveModel('AAPL', mockModel, {loss: 0.1} as any);
		expect(mockTfModel.save).toHaveBeenCalled();
		expect(FsUtils.writeJson).toHaveBeenCalled();
	});

	it('should save an ensemble model with sub-models', async () => {
		const mockEnsemble = new EnsembleModel(mockConfig as any);
		const mockSubModel = new LstmModel({} as any, {} as any);
		const mockTfModel = {save: vi.fn()} as any;

		vi.spyOn(mockSubModel, 'getModel').mockReturnValue(mockTfModel);
		vi.spyOn(mockSubModel, 'getMetadata').mockReturnValue({modelArchitecture: 'lstm'} as any);
		vi.spyOn(mockEnsemble, 'getModels').mockReturnValue([mockSubModel]);
		vi.spyOn(mockEnsemble, 'getWeights').mockReturnValue([1.0]);

		await persistence.saveModel('AAPL', mockEnsemble, {loss: 0.1, dataPoints: 100, windowSize: 30, accuracy: 0.9} as any);

		expect(mockTfModel.save).toHaveBeenCalled();
		expect(FsUtils.writeJson).toHaveBeenCalledWith(expect.stringContaining('ensemble.json'), expect.anything());
		expect(FsUtils.writeJson).toHaveBeenCalledWith(expect.stringContaining('metadata.json'), expect.anything());
	});
});
