/**
 * Initialize command - Creates default configuration file
 * Sets up project structure and creates config.json with default values
 */

import chalk from 'chalk';
import ora from 'ora';
import {ensureDir} from 'fs-extra';
import {join} from 'node:path';
import {saveConfig, getDefaultConfig, configExists, getConfigFilePath} from '../../config/config.ts';
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
		await saveConfig(defaultConfig, configPath);

		spinner.succeed('Initialization complete!');

		// Display success message
		const resolvedPath = getConfigFilePath(configPath);
		console.log('\n' + chalk.green('✅ AI Stock Predictions CLI initialized successfully!'));
		console.log('\n' + chalk.bold('Configuration file created:'));
		console.log(chalk.cyan(`  ${resolvedPath}`));

		console.log('\n' + chalk.bold('Default settings:'));
		console.log(chalk.white(`  • ${defaultConfig.prediction.days} days prediction window`));
		console.log(chalk.white(`  • ${defaultConfig.ml.windowSize} day LSTM window`));
		console.log(chalk.white(`  • Output directory: ${defaultConfig.output.directory}`));

		console.log('\n' + chalk.bold('Next steps:'));
		console.log(chalk.cyan('  1. Review configuration in config.json'));
		console.log(chalk.cyan('  2. Run: ai-stock-predictions portfolio --add-defaults'));
		console.log(chalk.cyan('  3. Run: ai-stock-predictions gather'));
		console.log(chalk.cyan('  3. Run: ai-stock-predictions train'));
		console.log(chalk.cyan('  4. Run: ai-stock-predictions predict'));

		console.log('\n' + chalk.dim(`Process completed in ${ProgressTracker.formatDuration(Date.now() - startTime)}.`));
		console.log('\n' + chalk.dim('Edit config.json to customize symbols, thresholds, and other options.'));
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
