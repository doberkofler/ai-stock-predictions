import {describe, expect, it} from 'vitest';

import {ConfigSchema} from '../../../src/config/schema.ts';

describe('ConfigSchema', () => {
	it('should validate a correct configuration', () => {
		const validConfig = {
			aBTesting: {
				enabled: false,
			},
			dataSource: {rateLimit: 1000, retries: 3, timeout: 10000},
			market: {
				featureConfig: {
					enabled: true,
					includeBeta: true,
					includeCorrelation: true,
					includeRegime: true,
					includeVix: true,
				},
				indices: ['^GSPC', '^DJI', '^IXIC', '^VIX', '^FTSE', '^GDAXI', '^N225'],
			},
			model: {batchSize: 128, epochs: 50, learningRate: 0.001, windowSize: 30},
			prediction: {
				buyThreshold: 0.05,
				contextDays: 15,
				days: 30,
				directory: 'output',
				historyChartDays: 1825,
				minConfidence: 0.6,
				sellThreshold: -0.05,
			},
			training: {minNewDataPoints: 50},
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
