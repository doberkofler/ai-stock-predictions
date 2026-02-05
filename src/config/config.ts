/**
 * Configuration management with file operations and validation
 * Handles loading, saving, and validating config.json files
 */

import chalk from 'chalk';
import {parse} from 'jsonc-parser';
import {join} from 'node:path';

import type {Config} from './schema.ts';

import {FsUtils} from '../cli/utils/fs.ts';
import {getMarketIndices} from '../constants/defaults-loader.ts';
import {ConfigSchema, DefaultConfig} from './schema.ts';

/**
 * Check if configuration file exists
 * @param [configPath] - Optional custom path
 * @returns True if configuration file exists
 */
export function configExists(configPath?: string): boolean {
	return FsUtils.exists(getConfigFilePath(configPath));
}

/**
 * Get configuration file path
 * @param [configPath] - Optional custom path
 * @returns Resolved configuration file path
 */
export function getConfigFilePath(configPath?: string): string {
	return join(process.cwd(), configPath ?? 'config.jsonc');
}

/**
 * Get default configuration
 * Dynamically reads market indices from defaults.jsonc to populate primaryIndex and volatilityIndex
 * @returns Default configuration object
 */
export function getDefaultConfig(): Config {
	const marketIndices = getMarketIndices();
	const primaryIndex = marketIndices.find((idx) => idx.type === 'INDEX' && idx.priority === 1);
	const volatilityIndex = marketIndices.find((idx) => idx.type === 'VOLATILITY');

	return {
		...DefaultConfig,
		market: {
			...DefaultConfig.market,
			primaryIndex: primaryIndex?.symbol ?? '^GSPC',
			volatilityIndex: volatilityIndex?.symbol ?? '^VIX',
		},
	};
}

/**
 * Load and validate configuration from file
 * @param [configPath] - Optional custom path
 * @throws {Error} If configuration file doesn't exist or is invalid
 * @returns Validated configuration object
 */
export function loadConfig(configPath?: string): Config {
	const resolvedPath = getConfigFilePath(configPath);
	if (!FsUtils.exists(resolvedPath)) {
		throw new Error(
			`${chalk.red('Configuration file not found')}: ${resolvedPath}\n` + `Run ${chalk.cyan('ai-stock-predictions init')} to create a configuration file.`,
		);
	}

	try {
		const content = FsUtils.readTextSync(resolvedPath);
		const rawConfig = parse(content) as unknown;
		return ConfigSchema.parse(rawConfig);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(
				`${chalk.red('Invalid configuration file')}: ${resolvedPath}\n` +
					`Error: ${error.message}\n` +
					`Run ${chalk.cyan('ai-stock-predictions init')} to create a new configuration file.`,
			);
		}
		throw error;
	}
}

/**
 * Save configuration to file with validation and comprehensive comments
 * @param config - Configuration object to save
 * @param [configPath] - Optional custom path
 * @throws {Error} If configuration is invalid or file cannot be written
 */
export async function saveConfig(config: Config, configPath?: string): Promise<void> {
	const resolvedPath = getConfigFilePath(configPath);
	try {
		const validatedConfig = ConfigSchema.parse(config);

		// Generate commented JSONC content using template
		const jsoncContent = generateCommentedConfig(validatedConfig);
		await FsUtils.writeText(resolvedPath, jsoncContent);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`${chalk.red('Failed to save configuration file')}: ${resolvedPath}\n` + `Error: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Generate config.jsonc content with comprehensive comments for user guidance
 * @param config - Validated configuration object
 * @returns JSONC string with embedded comments
 */
function generateCommentedConfig(config: Config): string {
	const baselinePathComment =
		config.aBTesting.baselineModelPath === undefined
			? '\t\t// "baselineModelPath": "path/to/baseline/model.json"'
			: `\t\t"baselineModelPath": "${config.aBTesting.baselineModelPath}"`;

	return `{
	// ============================================================================
	// A/B TESTING CONFIGURATION
	// ============================================================================
	// Enable experimental model comparison to measure improvements
	
	"aBTesting": {
		// Enable A/B testing to compare new model against baseline
		"enabled": ${config.aBTesting.enabled},
		
		// Path to baseline model for comparison (optional)
${baselinePathComment}
	},
	
	// ============================================================================
	// BACKTESTING CONFIGURATION
	// ============================================================================
	// Control historical simulation parameters
	
	"backtest": {
		// Enable backtesting simulation for predictions
		"enabled": ${config.backtest.enabled},

		// Starting cash for the simulation (e.g., 10000)
		"initialCapital": ${config.backtest.initialCapital},

		// Transaction cost per trade (0.001 = 0.1%)
		"transactionCost": ${config.backtest.transactionCost}
	},
	
	// ============================================================================
	// DATA SOURCE CONFIGURATION (Yahoo Finance API)
	// ============================================================================
\t// Control API rate limiting and error handling
\t
\t"dataSource": {
\t\t// Delay between Yahoo Finance API requests (milliseconds)
\t\t// Increase to 2000-3000 if you get rate limit errors
\t\t"rateLimit": ${config.dataSource.rateLimit},
\t\t
\t\t// Number of retry attempts for failed requests
\t\t// Higher = more resilient to network issues but slower on persistent failures
\t\t"retries": ${config.dataSource.retries},
\t\t
\t\t// Network timeout in milliseconds
\t\t// Slow connection? Increase to 30000 (30s); fast connection: 5000 (5s)
\t\t"timeout": ${config.dataSource.timeout}
\t},
\t
\t// ============================================================================
\t// MARKET CONFIGURATION
\t// ============================================================================
\t// Configure which market indices to use for feature calculations
\t
\t"market": {
\t\t// Primary market index for beta, correlation, regime detection, market returns
\t\t// Regional options: ^GSPC (US/S&P 500), ^FTSE (UK), ^N225 (Japan), ^GDAXI (Germany)
\t\t"primaryIndex": "${config.market.primaryIndex}",
\t\t
\t\t// Volatility index for fear gauge and volatility spread calculations
\t\t// Standard: ^VIX (CBOE Volatility Index for US markets)
\t\t"volatilityIndex": "${config.market.volatilityIndex}",
\t\t
\t\t// Market Feature Toggles - Control which features are calculated and used in models
\t\t"featureConfig": {
\t\t\t// Master toggle: Enable/disable ALL market features
\t\t\t// Disable for pure price-based predictions or if training is slow
\t\t\t"enabled": ${config.market.featureConfig.enabled},
\t\t\t
\t\t\t// Include 30-day rolling beta (stock sensitivity to market movements)
\t\t\t"includeBeta": ${config.market.featureConfig.includeBeta},
\t\t\t
\t\t\t// Include 20-day rolling correlation with market index
\t\t\t"includeCorrelation": ${config.market.featureConfig.includeCorrelation},
\t\t\t
\t\t\t// Include market index % distance from 200-day moving average
\t\t\t// Useful for mean reversion strategies
\t\t\t"includeDistanceFromMA": ${config.market.featureConfig.includeDistanceFromMA},
\t\t\t
\t\t\t// Include daily percentage change of market index
\t\t\t// Captures overall market direction
\t\t\t"includeMarketReturn": ${config.market.featureConfig.includeMarketReturn},
\t\t\t
\t\t\t// Include market regime classification (BULL/BEAR/NEUTRAL based on MAs)
\t\t\t// Some strategies perform differently in bull vs bear markets
\t\t\t"includeRegime": ${config.market.featureConfig.includeRegime},
\t\t\t
\t\t\t// Include stock return minus market return (outperformance indicator)
\t\t\t// Identifies alpha (excess returns beyond market)
\t\t\t"includeRelativeReturn": ${config.market.featureConfig.includeRelativeReturn},
\t\t\t
\t\t\t// Include current VIX level (market fear/volatility)
\t\t\t// High VIX periods have different price behavior
\t\t\t"includeVix": ${config.market.featureConfig.includeVix},
\t\t\t
\t\t\t// Include stock volatility minus market volatility
\t\t\t// Identifies stocks more/less volatile than the market
\t\t\t"includeVolatilitySpread": ${config.market.featureConfig.includeVolatilitySpread}
\t\t}
\t},
\t
\t// ============================================================================
\t// MACHINE LEARNING MODEL CONFIGURATION
\t// ============================================================================
\t// Hyperparameters that control LSTM neural network training
\t
	"model": {
		// Number of samples processed before updating weights (1-512)
		// Smaller (32-64) = slower but more stable; Larger (256-512) = faster but might overfit
		"batchSize": ${config.model.batchSize},

		// Dropout rate for preventing overfitting (0.0 to 1.0)
		"dropout": ${config.model.dropout},
		
		// Maximum number of training cycles (10-200)
		// More epochs = longer training but potentially better fit; watch for overfitting after ~100
		"epochs": ${config.model.epochs},

		// L1 kernel regularization factor (0.0 to 0.1)
		"l1Regularization": ${config.model.l1Regularization},

		// L2 kernel regularization factor (0.0 to 0.1)
		"l2Regularization": ${config.model.l2Regularization},
		
		// Learning rate: Speed of weight adjustments (0.0001-0.1)
		// Lower (0.0001) = slower, more stable; Higher (0.01) = faster but might miss optimal solution
		"learningRate": ${config.model.learningRate},

		// Recurrent dropout rate for LSTM layers (0.0 to 1.0)
		"recurrentDropout": ${config.model.recurrentDropout},
		
		// Number of past days used to predict the next day (10-100)
		// Short-term traders: 10-20; Medium-term: 30 (default); Long-term: 60-100
		"windowSize": ${config.model.windowSize}
	},
\t
\t// ============================================================================
\t// PREDICTION CONFIGURATION
\t// ============================================================================
\t// Control trading signals and prediction output
\t
\t"prediction": {
\t\t// Predicted price increase % to trigger BUY signal (0-1, where 0.05 = 5% gain)
\t\t// Conservative: 0.10+; Moderate: 0.05; Aggressive: 0.02-0.03
\t\t"buyThreshold": ${config.prediction.buyThreshold},
\t\t
\t\t// Historical days shown before predictions in chart for visual context (5-100)
\t\t"contextDays": ${config.prediction.contextDays},
\t\t
\t\t// Number of future days to forecast (1-365)
\t\t// Day traders: 1-7; Swing traders: 14-30; Long-term: 90-365
\t\t"days": ${config.prediction.days},
\t\t
\t\t// Output directory for HTML prediction reports
\t\t"directory": "${config.prediction.directory}",
\t\t
\t\t// Total days shown in full historical chart (30-10000)
\t\t// 1825 = 5 years (default); Short-term: 365 (1 year); Long-term: 3650 (10 years)
\t\t"historyChartDays": ${config.prediction.historyChartDays},
\t\t
\t\t// Minimum model confidence required for valid signal (0.5-1.0)
\t\t// Higher (0.8) = fewer but more confident signals; Lower (0.5) = more signals but less certain
\t\t"minConfidence": ${config.prediction.minConfidence},
\t\t
		// Predicted price decrease % to trigger SELL signal (-1 to 0, where -0.05 = 5% loss)
		// Tight stop-loss: -0.02; Moderate: -0.05; Long-term: -0.10 or lower
		"sellThreshold": ${config.prediction.sellThreshold},

		// Number of Monte Carlo Dropout iterations for uncertainty estimation (10-100)
		// Higher = smoother confidence intervals but slower prediction
		"uncertaintyIterations": ${config.prediction.uncertaintyIterations}
	},
	
	// ============================================================================
	// TRAINING CONFIGURATION
	// ============================================================================
	// Control when models should be retrained
	
	"training": {
		// Minimum new data points required before automatically retraining model (10-1000)
		// Lower (10-20) = retrain often, always fresh but slower
		// Higher (100-200) = retrain rarely, faster but potentially stale
		"minNewDataPoints": ${config.training.minNewDataPoints},

		// Minimum data quality score required to train a model (0-100)
		"minQualityScore": ${config.training.minQualityScore}
	},

	// ============================================================================
	// HYPERPARAMETER TUNING CONFIGURATION
	// ============================================================================
	// Optimize model performance by searching for best parameters
	
	"tuning": {
		// Enable hyperparameter tuning before training
		// WARNING: Significantly increases training time
		"enabled": ${config.tuning.enabled},

		// Maximum number of trials to run
		"maxTrials": ${config.tuning.maxTrials},

		// Number of time-series splits for cross-validation
		"validationSplits": ${config.tuning.validationSplits},

		// Architectures to search
		"architecture": ${JSON.stringify(config.tuning.architecture)},

		// Batch sizes to search
		"batchSize": ${JSON.stringify(config.tuning.batchSize)},

		// Epoch counts to search
		"epochs": ${JSON.stringify(config.tuning.epochs)},

		// Learning rates to search
		"learningRate": ${JSON.stringify(config.tuning.learningRate)},

		// Window sizes to search
		"windowSize": ${JSON.stringify(config.tuning.windowSize)}
	}
}
`;
}
