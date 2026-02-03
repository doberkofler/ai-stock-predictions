/**
 * Initialize command - Creates default configuration file and resets data
 */

import chalk from 'chalk';
import {join} from 'node:path';

import {configExists, getConfigFilePath, getDefaultConfig, saveConfig} from '../../config/config.ts';
import {getMarketIndices} from '../../constants/defaults-loader.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {FsUtils} from '../utils/fs.ts';
import {ui} from '../utils/ui.ts';

/**
 * Initialize command implementation
 * Creates configuration file and necessary directories
 * @param configPath - Path to the configuration file
 * @param force - Whether to overwrite existing config and wipe all data
 */
export async function initCommand(configPath: string, force = false): Promise<void> {
	// Initialize environment (loads backend)
	const env = await import('../../env.ts');
	await env.initializeEnvironment();

	ui.log(chalk.bold.blue('\n=== AI Stock Predictions: Initialization ==='));
	ui.log(chalk.dim('Setting up project structure and creating the default configuration file.\n'));

	const startTime = Date.now();

	try {
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

		await saveConfig(defaultConfig, configPath);

		// Initialize database with default indices from defaults.jsonc
		spinner.text = 'Initializing database with market indices...';
		const storage = new SqliteStorage();
		const indices = getMarketIndices();

		for (const idx of indices) {
			storage.saveSymbol(idx.symbol, idx.name, idx.type, idx.priority);
		}
		storage.close();

		spinner.succeed('Initialization complete!');

		ui.log('\n' + chalk.green('✅ AI Stock Predictions CLI initialized successfully!'));
		ui.log('\n' + chalk.bold('Configuration file created:'));
		ui.log(chalk.cyan(`  ${resolvedPath}`));

		ui.log('\n' + chalk.bold('Next steps:'));
		ui.log(chalk.cyan('  1. Review configuration in config.jsonc'));
		ui.log(chalk.cyan('  2. Run: ai-stock-predictions symbol-add-defaults'));
		ui.log(chalk.cyan('  3. Run: ai-stock-predictions train'));
		ui.log(chalk.cyan('  4. Run: ai-stock-predictions predict'));

		ui.log(chalk.cyan(`\nProcess completed in ${Math.floor((Date.now() - startTime) / 1000)}s.`));
	} catch (error) {
		ui.error(chalk.red('\n❌ Initialization failed'));
		if (error instanceof Error) {
			ui.error(chalk.red(`Error: ${error.message}`));
		}
		process.exit(1);
	}
}
