/**
 * Initialize command - Creates default configuration file
 * Sets up project structure and creates config.json with default values
 */

import chalk from 'chalk';
import ora from 'ora';
import {ensureDir} from 'fs-extra';
import {join} from 'node:path';
import {getDefaultConfig, configExists, getConfigFilePath} from '../../config/config.ts';
import {ProgressTracker} from '../utils/progress.ts';

/**
 * Initialize command implementation
 * Creates configuration file and necessary directories
 * @param {string} configPath - Path to the configuration file
 */
export async function initCommand(configPath: string): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Initialization ==='));
	console.log(chalk.dim('Setting up project structure and creating the default configuration file.\n'));
	const startTime = Date.now();
	const spinner = ora('Initializing AI Stock Predictions CLI').start();

	try {
		// Check if config already exists
		if (configExists(configPath)) {
			const resolvedPath = getConfigFilePath(configPath);
			spinner.warn('Configuration file already exists');
			console.log(chalk.yellow(`Configuration file found at: ${resolvedPath}`));
			console.log(chalk.blue('To reinitialize, remove the existing config file first.'));
			return;
		}

		// Create necessary directories
		spinner.text = 'Creating directory structure...';
		const directories = [join(process.cwd(), 'data'), join(process.cwd(), 'data', 'models'), join(process.cwd(), 'output')];

		for (const dir of directories) {
			await ensureDir(dir);
		}

		// Save default configuration
		spinner.text = 'Creating configuration file...';
		const defaultConfig = getDefaultConfig();
		const resolvedPath = getConfigFilePath(configPath);

		// Use manual string construction to add comprehensive comments to config.yaml
		const yamlContent = `# ==========================================
# AI Stock Predictions Configuration
# ==========================================

# Data Source: Controls how market data is fetched
dataSource:
  timeout: ${defaultConfig.dataSource.timeout}   # Timeout in milliseconds for API requests
  retries: ${defaultConfig.dataSource.retries}       # Number of attempts for failed network calls
  rateLimit: ${defaultConfig.dataSource.rateLimit}  # Delay (ms) between symbols to avoid rate limiting

# Training: Controls the synchronization and skip logic
training:
  minNewDataPoints: ${defaultConfig.training.minNewDataPoints} # Only retrain if at least this many new points are available

# Model: Neural network architecture and hyperparameters
model:
  windowSize: ${defaultConfig.model.windowSize}   # How many past days the model uses to predict the next day
  epochs: ${defaultConfig.model.epochs}       # Maximum number of training cycles
  learningRate: ${defaultConfig.model.learningRate}
  batchSize: ${defaultConfig.model.batchSize}   # Larger batch size improves training speed on modern CPUs

# Prediction & Reporting: Controls forecasts and visual output
prediction:
  days: ${defaultConfig.prediction.days}                  # Number of future days to forecast
  historyChartDays: ${defaultConfig.prediction.historyChartDays}    # Days shown in the full history chart (5 years)
  contextDays: ${defaultConfig.prediction.contextDays}           # Actual days shown in the prediction chart for context
  directory: "${defaultConfig.prediction.directory}"       # Destination directory for HTML reports
  buyThreshold: ${defaultConfig.prediction.buyThreshold}        # Price increase threshold to trigger a BUY signal
  sellThreshold: ${defaultConfig.prediction.sellThreshold}      # Price decrease threshold to trigger a SELL signal
  minConfidence: ${defaultConfig.prediction.minConfidence}        # Minimum required model confidence for a valid signal
`;

		const {writeFile} = await import('node:fs/promises');
		await writeFile(resolvedPath, yamlContent, 'utf8');

		spinner.succeed('Initialization complete!');

		// Display success message
		console.log('\n' + chalk.green('✅ AI Stock Predictions CLI initialized successfully!'));
		console.log('\n' + chalk.bold('Configuration file created:'));
		console.log(chalk.cyan(`  ${resolvedPath}`));

		console.log('\n' + chalk.bold('Default settings:'));
		console.log(chalk.white(`  • ${defaultConfig.prediction.days} days prediction window`));
		console.log(chalk.white(`  • ${defaultConfig.model.windowSize} day LSTM window`));
		console.log(chalk.white(`  • Output directory: ${defaultConfig.prediction.directory}`));

		console.log('\n' + chalk.bold('Next steps:'));
		console.log(chalk.cyan('  1. Review configuration in config.yaml'));
		console.log(chalk.cyan('  2. Run: ai-stock-predictions portfolio --add-defaults'));
		console.log(chalk.cyan('  3. Run: ai-stock-predictions gather'));
		console.log(chalk.cyan('  4. Run: ai-stock-predictions train'));
		console.log(chalk.cyan('  5. Run: ai-stock-predictions predict'));

		console.log('\n' + chalk.dim(`Process completed in ${ProgressTracker.formatDuration(Date.now() - startTime)}.`));
		console.log('\n' + chalk.dim('Edit config.yaml to customize symbols, thresholds, and other options.'));
	} catch (error) {
		spinner.fail('Initialization failed');
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
			process.exit(1);
		} else {
			console.error(chalk.red('Unknown error occurred during initialization'));
			process.exit(1);
		}
	}
}
