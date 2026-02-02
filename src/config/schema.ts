/**
 * Configuration schema definitions using Zod for runtime validation
 * All external data boundaries must be validated through these schemas
 */

import {z} from 'zod';

/**
 * Prediction configuration schema
 */
const PredictionSchema = z.object({
	days: z
		.number()
		.min(1, 'Prediction days must be at least 1')
		.max(365, 'Prediction days cannot exceed 365')
		.default(30)
		.describe('Number of future days to forecast'),
	historyChartDays: z.number().min(30).max(10000).default(1825).describe('Number of days shown in the full history chart (5 years)'),
	contextDays: z.number().min(5).max(100).default(15).describe('Actual historical days shown in the prediction chart for context'),
	directory: z.string().min(1, 'Output directory cannot be empty').default('output').describe('Destination directory for HTML reports'),
	buyThreshold: z.number().min(0).max(1).default(0.05).describe('Price increase threshold to trigger a BUY signal'),
	sellThreshold: z.number().min(-1).max(0).default(-0.05).describe('Price decrease threshold to trigger a SELL signal'),
	minConfidence: z.number().min(0.5).max(1).default(0.6).describe('Minimum required model confidence for a valid signal'),
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
	timeout: z.number().min(1000).max(60000).default(10000).describe('Network timeout in milliseconds'),
	retries: z.number().min(1).max(10).default(3).describe('Number of retry attempts for failed requests'),
	rateLimit: z.number().min(100).max(10000).default(1000).describe('Delay in milliseconds between requests to avoid rate limits'),
});

/**
 * Machine Learning Model configuration schema
 */
const ModelSchema = z.object({
	windowSize: z.number().min(10).max(100).default(30).describe('How many past days the model uses to predict the next day'),
	epochs: z.number().min(10).max(200).default(50).describe('Maximum number of training cycles'),
	learningRate: z.number().min(0.0001).max(0.1).default(0.001).describe('Speed at which the model learns during training'),
	batchSize: z.number().min(1).max(512).default(128).describe('Number of samples processed before updating model weights'),
});

/**
 * Main configuration schema
 * This is the root schema for validating the entire config.yaml file
 */
export const ConfigSchema = z.object({
	dataSource: DataSourceSchema,
	training: TrainingSchema,
	model: ModelSchema,
	prediction: PredictionSchema,
});

/**
 * Type inference from the configuration schema
 * Use this type throughout the application for type-safe configuration access
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 * These are used when initializing a new config.yaml file
 */
export const DefaultConfig: Config = {
	dataSource: {
		timeout: 10000,
		retries: 3,
		rateLimit: 1000,
	},
	training: {
		minNewDataPoints: 50,
	},
	model: {
		windowSize: 30,
		epochs: 50,
		learningRate: 0.001,
		batchSize: 128,
	},
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
