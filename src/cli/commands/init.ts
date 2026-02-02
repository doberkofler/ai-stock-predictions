/**
 * Initialize command - Creates default configuration file and resets data
 */

import chalk from 'chalk';
import {ensureDir, remove} from 'fs-extra';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {getDefaultConfig, configExists, getConfigFilePath} from '../../config/config.ts';
import {ui} from '../utils/ui.ts';
import {initializeEnvironment} from '../../env.ts';

/**
 * Initialize command implementation
 * Creates configuration file and necessary directories
 * @param {string} configPath - Path to the configuration file
 * @param {boolean} force - Whether to overwrite existing config and wipe all data
 */
export async function initCommand(configPath: string, force = false): Promise<void> {
	await initializeEnvironment();

	ui.log(chalk.bold.blue('\n=== AI Stock Predictions: Initialization ==='));
	ui.log(chalk.dim('Setting up project structure and creating the default configuration file.\n'));

	const startTime = Date.now();
	const spinner = ui.spinner('Initializing AI Stock Predictions CLI').start();

	try {
		if (force) {
			spinner.text = 'Wiping existing data and models...';
			await remove(join(process.cwd(), 'data'));
			await remove(join(process.cwd(), 'output'));
			spinner.text = 'Data wiped successfully.';
		} else if (configExists(configPath)) {
			const resolvedPath = getConfigFilePath(configPath);
			spinner.warn('Configuration file already exists');
			ui.log(chalk.yellow(`Configuration file found at: ${resolvedPath}`));
			ui.log(chalk.blue('To reinitialize and wipe data, use the --force flag.'));
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

		await writeFile(resolvedPath, yamlContent, 'utf8');
		spinner.succeed('Initialization complete!');

		ui.log('\n' + chalk.green('✅ AI Stock Predictions CLI initialized successfully!'));
		ui.log('\n' + chalk.bold('Configuration file created:'));
		ui.log(chalk.cyan(`  ${resolvedPath}`));

		ui.log('\n' + chalk.bold('Next steps:'));
		ui.log(chalk.cyan('  1. Review configuration in config.yaml'));
		ui.log(chalk.cyan('  2. Run: ai-stock-predictions symbol-add-defaults'));
		ui.log(chalk.cyan('  3. Run: ai-stock-predictions train'));
		ui.log(chalk.cyan('  4. Run: ai-stock-predictions predict'));

		ui.log(chalk.cyan(`\nProcess completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`));
	} catch (error) {
		spinner.fail('Initialization failed');
		if (error instanceof Error) {
			ui.error(chalk.red(`Error: ${error.message}`));
		}
		process.exit(1);
	}
}
