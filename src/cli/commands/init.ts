/**
 * Initialize command - Creates default configuration file and resets data
 */

import chalk from 'chalk';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {configExists, getConfigFilePath, getDefaultConfig} from '../../config/config.ts';
import {FsUtils} from '../utils/fs.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Initialize command implementation
 * Creates configuration file and necessary directories
 * @param configPath - Path to the configuration file
 * @param force - Whether to overwrite existing config and wipe all data
 */
export async function initCommand(configPath: string, force = false): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Setting up project structure and creating the default configuration file.',
			title: 'Initialization',
		},
		async () => {
			const spinner = ui.spinner('Initializing AI Stock Predictions CLI').start();

			if (force) {
				spinner.text = 'Wiping existing data and models...';
				await FsUtils.deletePath(join(process.cwd(), 'data'));
				await FsUtils.deletePath(join(process.cwd(), 'output'));
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
				await FsUtils.ensureDir(dir);
			}

			// Save default configuration
			spinner.text = 'Creating configuration file...';
			const defaultConfig = getDefaultConfig();
			const resolvedPath = getConfigFilePath(configPath);

			// Load template and replace placeholders
			const currentDir = dirname(fileURLToPath(import.meta.url));
			const templatePath = join(currentDir, '../../constants/config-template.yaml');
			let yamlContent = await FsUtils.readText(templatePath);

			// Perform replacements for all configuration sections
			const replacements: Record<string, number | string> = {
				'dataSource.timeout': defaultConfig.dataSource.timeout,
				'dataSource.retries': defaultConfig.dataSource.retries,
				'dataSource.rateLimit': defaultConfig.dataSource.rateLimit,
				'training.minNewDataPoints': defaultConfig.training.minNewDataPoints,
				'model.windowSize': defaultConfig.model.windowSize,
				'model.epochs': defaultConfig.model.epochs,
				'model.learningRate': defaultConfig.model.learningRate,
				'model.batchSize': defaultConfig.model.batchSize,
				'prediction.days': defaultConfig.prediction.days,
				'prediction.historyChartDays': defaultConfig.prediction.historyChartDays,
				'prediction.contextDays': defaultConfig.prediction.contextDays,
				'prediction.directory': defaultConfig.prediction.directory,
				'prediction.buyThreshold': defaultConfig.prediction.buyThreshold,
				'prediction.sellThreshold': defaultConfig.prediction.sellThreshold,
				'prediction.minConfidence': defaultConfig.prediction.minConfidence,
			};

			for (const [key, value] of Object.entries(replacements)) {
				yamlContent = yamlContent.replace(`{{${key}}}`, value.toString());
			}

			await FsUtils.writeText(resolvedPath, yamlContent);
			spinner.succeed('Initialization complete!');

			ui.log('\n' + chalk.green('✅ AI Stock Predictions CLI initialized successfully!'));
			ui.log('\n' + chalk.bold('Configuration file created:'));
			ui.log(chalk.cyan(`  ${resolvedPath}`));

			ui.log('\n' + chalk.bold('Next steps:'));
			ui.log(chalk.cyan('  1. Review configuration in config.yaml'));
			ui.log(chalk.cyan('  2. Run: ai-stock-predictions symbol-add-defaults'));
			ui.log(chalk.cyan('  3. Run: ai-stock-predictions train'));
			ui.log(chalk.cyan('  4. Run: ai-stock-predictions predict'));
		},
		{},
	);
}
