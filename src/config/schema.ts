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
	uncertaintyIterations: z.number().min(10).max(100).default(30).describe('Number of Monte Carlo Dropout iterations for uncertainty estimation'),
});

/**
 * Training configuration schema
 */
const TrainingSchema = z.object({
	minNewDataPoints: z.number().min(10).max(1000).default(50).describe('Minimum new data points required before retraining a model'),
	minQualityScore: z.number().min(0).max(100).default(40).describe('Minimum data quality score (0-100) required to train a model'),
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
	architecture: z.enum(['lstm', 'gru', 'attention-lstm']).default('lstm').describe('The neural network architecture to use'),
	batchSize: z.number().min(1).max(512).default(128).describe('Number of samples processed before updating model weights'),
	dropout: z.number().min(0).max(1).default(0.2).describe('Dropout rate for preventing overfitting'),
	epochs: z.number().min(10).max(200).default(50).describe('Maximum number of training cycles'),
	l1Regularization: z.number().min(0).max(0.1).default(0.001).describe('L1 kernel regularization factor'),
	l2Regularization: z.number().min(0).max(0.1).default(0.001).describe('L2 kernel regularization factor'),
	learningRate: z.number().min(0.0001).max(0.1).default(0.001).describe('Speed at which the model learns during training'),
	recurrentDropout: z.number().min(0).max(1).default(0.1).describe('Recurrent dropout rate for LSTM layers'),
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
 * Backtesting configuration schema
 */
const BacktestSchema = z.object({
	enabled: z.boolean().default(true).describe('Enable backtesting simulation for predictions'),
	initialCapital: z.number().min(100).default(10000).describe('Starting cash for the simulation'),
	transactionCost: z.number().min(0).max(0.05).default(0.001).describe('Transaction cost per trade (0.001 = 0.1%)'),
});

/**
 * Hyperparameter Tuning configuration schema
 */
const TuningSchema = z.object({
	architecture: z
		.array(z.enum(['lstm', 'gru', 'attention-lstm']))
		.default(['lstm', 'gru', 'attention-lstm'])
		.describe('Architectures to search'),
	batchSize: z.array(z.number()).default([64, 128, 256]).describe('Batch sizes to search'),
	enabled: z.boolean().default(false).describe('Enable hyperparameter tuning before training'),
	epochs: z.array(z.number()).default([30, 50, 100]).describe('Epoch counts to search'),
	learningRate: z.array(z.number()).default([0.001, 0.0005]).describe('Learning rates to search'),
	maxTrials: z.number().min(1).max(100).default(20).describe('Maximum number of trials to run'),
	validationSplits: z.number().min(2).max(10).default(3).describe('Number of time-series splits for cross-validation'),
	windowSize: z.array(z.number()).default([20, 30, 60]).describe('Window sizes to search'),
});

/**
 * Main configuration schema
 * This is the root schema for validating the entire config.jsonc file
 */
export const ConfigSchema = z.object({
	aBTesting: ABTestingSchema,
	backtest: BacktestSchema,
	dataSource: DataSourceSchema,
	market: MarketSchema,
	model: ModelSchema,
	prediction: PredictionSchema,
	training: TrainingSchema,
	tuning: TuningSchema,
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
	backtest: {
		enabled: true,
		initialCapital: 10000,
		transactionCost: 0.001,
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
		architecture: 'lstm',
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
		uncertaintyIterations: 20,
	},
	training: {
		minNewDataPoints: 50,
		minQualityScore: 40,
	},
	tuning: {
		architecture: ['lstm', 'gru', 'attention-lstm'],
		batchSize: [64, 128, 256],
		enabled: false,
		epochs: [30, 50, 100],
		learningRate: [0.001, 0.0005],
		maxTrials: 20,
		validationSplits: 3,
		windowSize: [20, 30, 60],
	},
};
