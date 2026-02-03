/**
 * Configuration schema definitions using Zod for runtime validation
 * All external data boundaries must be validated through these schemas
 */

import {z} from 'zod';

import {FeatureConfigSchema} from '../types/index.ts';

/**
 * Prediction configuration schema
 */
const PredictionSchema = z.object({
	buyThreshold: z.number().min(0).max(1).default(0.05).describe('Price increase threshold to trigger a BUY signal'),
	contextDays: z.number().min(5).max(100).default(15).describe('Actual historical days shown in the prediction chart for context'),
	days: z
		.number()
		.min(1, 'Prediction days must be at least 1')
		.max(365, 'Prediction days cannot exceed 365')
		.default(30)
		.describe('Number of future days to forecast'),
	directory: z.string().min(1, 'Output directory cannot be empty').default('output').describe('Destination directory for HTML reports'),
	historyChartDays: z.number().min(30).max(10000).default(1825).describe('Number of days shown in the full history chart (5 years)'),
	minConfidence: z.number().min(0.5).max(1).default(0.6).describe('Minimum required model confidence for a valid signal'),
	sellThreshold: z.number().min(-1).max(0).default(-0.05).describe('Price decrease threshold to trigger a SELL signal'),
});

/**
 * Training configuration schema
 */
const TrainingSchema = z.object({
	minNewDataPoints: z.number().min(10).max(1000).default(50).describe('Minimum new data points required before retraining a model'),
});

/**
 * Data Source configuration schema
 */
const DataSourceSchema = z.object({
	rateLimit: z.number().min(100).max(10000).default(1000).describe('Delay in milliseconds between requests to avoid rate limits'),
	retries: z.number().min(1).max(10).default(3).describe('Number of retry attempts for failed requests'),
	timeout: z.number().min(1000).max(60000).default(10000).describe('Network timeout in milliseconds'),
});

/**
 * Machine Learning Model configuration schema
 */
const ModelSchema = z.object({
	batchSize: z.number().min(1).max(512).default(128).describe('Number of samples processed before updating model weights'),
	epochs: z.number().min(10).max(200).default(50).describe('Maximum number of training cycles'),
	learningRate: z.number().min(0.0001).max(0.1).default(0.001).describe('Speed at which the model learns during training'),
	windowSize: z.number().min(10).max(100).default(30).describe('How many past days the model uses to predict the next day'),
});

/**
 * Market configuration schema
 */
const MarketSchema = z.object({
	featureConfig: FeatureConfigSchema.default({
		enabled: true,
		includeBeta: true,
		includeCorrelation: true,
		includeDistanceFromMA: true,
		includeMarketReturn: true,
		includeRegime: true,
		includeRelativeReturn: true,
		includeVix: true,
		includeVolatilitySpread: true,
	}),
	primaryIndex: z.string().min(1).default('^GSPC').describe('Primary market index for feature calculations (e.g., ^GSPC, ^FTSE, ^N225)'),
	volatilityIndex: z.string().min(1).default('^VIX').describe('Volatility index for market fear gauge (standard: ^VIX)'),
});

/**
 * A/B Testing configuration schema
 */
const ABTestingSchema = z.object({
	baselineModelPath: z.string().optional().describe('Path to baseline model for comparison'),
	enabled: z.boolean().default(false).describe('Enable A/B testing with baseline model'),
});

/**
 * Main configuration schema
 * This is the root schema for validating the entire config.jsonc file
 */
export const ConfigSchema = z.object({
	aBTesting: ABTestingSchema,
	dataSource: DataSourceSchema,
	market: MarketSchema,
	model: ModelSchema,
	prediction: PredictionSchema,
	training: TrainingSchema,
});

/**
 * Type inference from the configuration schema
 * Use this type throughout the application for type-safe configuration access
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 * These are used when initializing a new config.jsonc file
 */
export const DefaultConfig: Config = {
	aBTesting: {
		baselineModelPath: undefined,
		enabled: false,
	},
	dataSource: {
		rateLimit: 1000,
		retries: 3,
		timeout: 10000,
	},
	market: {
		featureConfig: {
			enabled: true,
			includeBeta: true,
			includeCorrelation: true,
			includeDistanceFromMA: true,
			includeMarketReturn: true,
			includeRegime: true,
			includeRelativeReturn: true,
			includeVix: true,
			includeVolatilitySpread: true,
		},
		primaryIndex: '^GSPC',
		volatilityIndex: '^VIX',
	},
	model: {
		batchSize: 128,
		epochs: 50,
		learningRate: 0.001,
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
	training: {
		minNewDataPoints: 50,
	},
};
