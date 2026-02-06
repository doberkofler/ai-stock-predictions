import {describe, it, expect, vi, beforeEach} from 'vitest';
import {EnsembleModel} from '../../src/compute/ensemble.ts';
import {LstmModel} from '../../src/compute/lstm-model.ts';
import type {Config} from '../../src/config/schema.ts';

vi.mock('../../src/compute/lstm-model.ts', () => {
	const LstmModel = vi.fn();
	LstmModel.prototype.train = vi.fn().mockResolvedValue({
		accuracy: 0.9,
		dataPoints: 100,
		isValid: true,
		loss: 0.1,
		mape: 0.05,
		windowSize: 10,
	});
	LstmModel.prototype.predict = vi.fn().mockResolvedValue([100, 101, 102]);
	LstmModel.prototype.getMetadata = vi.fn().mockReturnValue({
		modelArchitecture: 'lstm',
		trainedAt: '2024-01-01',
		version: '1.0.0',
	});
	LstmModel.prototype.isTrained = vi.fn().mockReturnValue(true);
	return {LstmModel};
});

describe('EnsembleModel', () => {
	const mockConfig = {
		model: {
			windowSize: 10,
			architecture: 'lstm',
		},
		tuning: {
			architecture: ['lstm', 'gru'],
		},
		market: {
			featureConfig: {
				enabled: false,
			},
		},
	} as unknown as Config;

	let ensemble: EnsembleModel;

	beforeEach(() => {
		vi.clearAllMocks();
		ensemble = new EnsembleModel(mockConfig);
	});

	it('should initialize with config', () => {
		expect(ensemble).toBeDefined();
		expect(ensemble.isTrained()).toBe(false);
	});

	it('should train all models in the ensemble', async () => {
		const data = Array(50).fill({close: 100, date: '2024-01-01'});
		const metrics = await ensemble.train(data);

		expect(LstmModel).toHaveBeenCalledTimes(2);
		expect(ensemble.getModels().length).toBe(2);
		expect(ensemble.getWeights().length).toBe(2);
		expect(ensemble.isTrained()).toBe(true);
		expect(metrics.loss).toBe(0.1);
	});

	it('should calculate weights correctly based on loss', async () => {
		const data = Array(50).fill({close: 100, date: '2024-01-01'});

		// Setup different losses for the two models
		vi.spyOn(LstmModel.prototype, 'train')
			.mockResolvedValueOnce({loss: 0.1, mape: 0.05, accuracy: 0.9, dataPoints: 100, isValid: true, windowSize: 10})
			.mockResolvedValueOnce({loss: 0.2, mape: 0.1, accuracy: 0.8, dataPoints: 100, isValid: true, windowSize: 10});

		await ensemble.train(data);
		const weights = ensemble.getWeights();

		// Model 1 (loss 0.1) should have higher weight than Model 2 (loss 0.2)
		expect(weights[0]).toBeDefined();
		expect(weights[1]).toBeDefined();
		expect(weights[0]!).toBeGreaterThan(weights[1]!);
		expect(weights[0]! + weights[1]!).toBeCloseTo(1);
	});

	it('should predict using weighted average', async () => {
		const data = Array(50).fill({close: 100, date: '2024-01-01'});

		// Mock same loss for equal weights
		vi.spyOn(LstmModel.prototype, 'train').mockResolvedValue({
			loss: 0.1,
			accuracy: 0.9,
			dataPoints: 100,
			isValid: true,
			windowSize: 10,
		});

		// Mock different predictions
		vi.spyOn(LstmModel.prototype, 'predict').mockResolvedValueOnce([100, 110]).mockResolvedValueOnce([120, 130]);

		await ensemble.train(data);
		const predictions = await ensemble.predict(data, 2);

		// Equal weights (same loss), so average should be (100+120)/2 = 110 and (110+130)/2 = 120
		expect(predictions[0]).toBeCloseTo(110);
		expect(predictions[1]).toBeCloseTo(120);
	});

	it('should throw error if predicting without training', async () => {
		await expect(ensemble.predict([], 5)).rejects.toThrow('Ensemble not trained or loaded');
	});

	it('should return combined metadata', async () => {
		const data = Array(50).fill({close: 100, date: '2024-01-01'});
		await ensemble.train(data);

		const metadata = ensemble.getMetadata();
		expect(metadata).not.toBeNull();
		if (metadata) {
			expect(metadata.modelArchitecture).toBe('ensemble');
		}
	});
});
