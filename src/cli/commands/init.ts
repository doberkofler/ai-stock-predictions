/**
 * Initialize command - Creates default configuration file and resets data
 */

import chalk from 'chalk';
import {join} from 'node:path';

import {configExists, getConfigFilePath, getDefaultConfig, saveConfig} from '../../config/config.ts';
import {getMarketIndices} from '../../constants/defaults-loader.ts';
import {SqliteStorage} from '../../gather/storage.ts';
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
			nextSteps: ['Review configuration in config.jsonc', 'Run: {cli} symbol-add <SYMBOLS>', 'Run: {cli} sync', 'Run: {cli} train', 'Run: {cli} predict'],
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

			spinner.text = 'Creating configuration file...';
			const defaultConfig = getDefaultConfig();
			const resolvedPath = getConfigFilePath(configPath);

			// Validate that configured indices exist in defaults.jsonc
			const indices = getMarketIndices();
			const primaryIndex = indices.find((idx) => idx.symbol === defaultConfig.market.primaryIndex);
			const volatilityIndex = indices.find((idx) => idx.symbol === defaultConfig.market.volatilityIndex);

			if (!primaryIndex) {
				spinner.fail('Configuration error');
				throw new Error(
					`Primary index '${defaultConfig.market.primaryIndex}' not found in defaults.jsonc.\n` +
						`Available indices: ${indices.map((idx) => idx.symbol).join(', ')}`,
				);
			}

			if (!volatilityIndex) {
				spinner.fail('Configuration error');
				throw new Error(
					`Volatility index '${defaultConfig.market.volatilityIndex}' not found in defaults.jsonc.\n` +
						`Available indices: ${indices.map((idx) => idx.symbol).join(', ')}`,
				);
			}

			await saveConfig(defaultConfig, configPath);

			// Initialize database with default indices from defaults.jsonc
			spinner.text = 'Initializing database with market indices...';
			const storage = new SqliteStorage();

			for (const idx of indices) {
				storage.saveSymbol(idx.symbol, idx.name, idx.type, idx.priority);
			}
			storage.close();

			spinner.succeed('Initialization complete!');

			ui.log('\n' + chalk.green('✅ AI Stock Predictions CLI initialized successfully!'));
			ui.log('\n' + chalk.bold('Configuration file created:'));
			ui.log(chalk.cyan(`  ${resolvedPath}`));
		},
		{},
	);
}
