import {describe, it, expect} from 'vitest';
import {ConfigSchema} from '@/config/schema.ts';

describe('ConfigSchema', () => {
	it('should validate a correct configuration', () => {
		const validConfig = {
			symbols: [{symbol: 'AAPL', name: 'Apple Inc.'}],
			prediction: {days: 30, trainSplit: 0.8},
			training: {incremental: true, retrain: false, minNewDataPoints: 50},
			trading: {buyThreshold: 0.05, sellThreshold: -0.05, minConfidence: 0.6},
			api: {timeout: 10000, retries: 3, rateLimit: 1000},
			output: {directory: 'output', template: 'default', includeCharts: true, chartsType: 'both'},
			ml: {modelType: 'lstm', windowSize: 30, epochs: 50, learningRate: 0.001, batchSize: 32},
		};

		const result = ConfigSchema.safeParse(validConfig);
		expect(result.success).toBe(true);
	});

	it('should fail on invalid symbols', () => {
		const invalidConfig = {
			symbols: [], // At least one symbol required
		};

		const result = ConfigSchema.safeParse(invalidConfig);
		expect(result.success).toBe(false);
	});

	it('should fail on invalid trading thresholds', () => {
		const invalidConfig = {
			trading: {
				buyThreshold: -0.1, // Cannot be negative
			},
		};

		const result = ConfigSchema.safeParse(invalidConfig);
		expect(result.success).toBe(false);
	});
});
