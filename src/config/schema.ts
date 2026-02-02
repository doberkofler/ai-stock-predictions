/**
 * Configuration schema definitions using Zod for runtime validation
 * All external data boundaries must be validated through these schemas
 */

import {z} from 'zod';

/**
 * Prediction configuration schema
 */
const PredictionSchema = z.object({
	days: z.number().min(1, 'Prediction days must be at least 1').max(365, 'Prediction days cannot exceed 365').default(30),
});

/**
 * Training configuration schema
 */
const TrainingSchema = z.object({
	minNewDataPoints: z.number().min(10, 'Minimum new data points must be at least 10').max(1000, 'Minimum new data points cannot exceed 1000').default(50),
});

/**
 * Trading configuration schema
 */
const TradingSchema = z.object({
	buyThreshold: z.number().min(0, 'Buy threshold cannot be negative').max(1, 'Buy threshold cannot exceed 100%').default(0.05),
	sellThreshold: z.number().min(-1, 'Sell threshold cannot be less than -100%').max(0, 'Sell threshold cannot be positive').default(-0.05),
	minConfidence: z.number().min(0.5, 'Minimum confidence must be at least 50%').max(1, 'Minimum confidence cannot exceed 100%').default(0.6),
});

/**
 * API configuration schema
 */
const ApiSchema = z.object({
	timeout: z.number().min(1000, 'API timeout must be at least 1000ms').max(60000, 'API timeout cannot exceed 60000ms').default(10000),
	retries: z.number().min(1, 'API retries must be at least 1').max(10, 'API retries cannot exceed 10').default(3),
	rateLimit: z.number().min(100, 'API rate limit must be at least 100ms').max(10000, 'API rate limit cannot exceed 10000ms').default(1000),
});

/**
 * Output configuration schema
 */
const OutputSchema = z.object({
	directory: z.string().min(1, 'Output directory cannot be empty').default('output'),
});

/**
 * Machine Learning configuration schema
 */
const MlSchema = z.object({
	windowSize: z.number().min(10, 'ML window size must be at least 10').max(100, 'ML window size cannot exceed 100').default(30),
	epochs: z.number().min(10, 'ML epochs must be at least 10').max(200, 'ML epochs cannot exceed 200').default(50),
	learningRate: z.number().min(0.0001, 'ML learning rate must be at least 0.0001').max(0.1, 'ML learning rate cannot exceed 0.1').default(0.001),
	batchSize: z.number().min(1, 'ML batch size must be at least 1').max(512, 'ML batch size cannot exceed 512').default(128),
});

/**
 * Main configuration schema
 * This is the root schema for validating the entire config.json file
 */
export const ConfigSchema = z.object({
	prediction: PredictionSchema,
	training: TrainingSchema,
	trading: TradingSchema,
	api: ApiSchema,
	output: OutputSchema,
	ml: MlSchema,
});

/**
 * Type inference from the configuration schema
 * Use this type throughout the application for type-safe configuration access
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 * These are used when initializing a new config.json file
 */
export const DefaultConfig: Config = {
	prediction: {
		days: 30,
	},
	training: {
		minNewDataPoints: 50,
	},
	trading: {
		buyThreshold: 0.05,
		sellThreshold: -0.05,
		minConfidence: 0.6,
	},
	api: {
		timeout: 10000,
		retries: 3,
		rateLimit: 1000,
	},
	output: {
		directory: 'output',
	},
	ml: {
		windowSize: 30,
		epochs: 50,
		learningRate: 0.001,
		batchSize: 128,
	},
};
