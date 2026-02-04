import {describe, expect, it} from 'vitest';

import {ConfigSchema} from '../../../src/config/schema.ts';

describe('ConfigSchema', () => {
	it('should validate a correct configuration', () => {
		const validConfig = {
			aBTesting: {
				enabled: false,
			},
			backtest: {
				enabled: true,
				initialCapital: 10000,
				transactionCost: 0.001,
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
				primaryIndex: '^GSPC',
				volatilityIndex: '^VIX',
			},
			model: {
				batchSize: 128,
				dropout: 0.2,
				epochs: 50,
				l1Regularization: 0.001,
				l2Regularization: 0.001,
				learningRate: 0.001,
				recurrentDropout: 0.1,
				windowSize: 30,
			},
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
