import {describe, it, expect} from 'vitest';
import {ConfigSchema} from '../../../src/config/schema.ts';

describe('ConfigSchema', () => {
	it('should validate a correct configuration', () => {
		const validConfig = {
			dataSource: {timeout: 10000, retries: 3, rateLimit: 1000},
			training: {minNewDataPoints: 50},
			model: {windowSize: 30, epochs: 50, learningRate: 0.001, batchSize: 128},
			prediction: {
				days: 30,
				historyChartDays: 1825,
				contextDays: 15,
				directory: 'output',
				buyThreshold: 0.05,
				sellThreshold: -0.05,
				minConfidence: 0.6,
			},
		};

		const result = ConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
	});

	it('should fail on invalid trading thresholds', () => {
		const invalidConfig = {
			prediction: {
				buyThreshold: -0.1, // Cannot be negative
			},
		};

		const result = ConfigSchema.safeParse(invalidConfig);
		expect(result.success).toBe(false);
	});
});
