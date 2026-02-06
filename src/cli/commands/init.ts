/**
 * Initialize command - Creates default configuration file and resets data
 */

import chalk from 'chalk';
import {resolve} from 'node:path';

import {configExists, getConfigFilePath, getDefaultConfig, saveConfig} from '../../config/config.ts';
import {FsUtils} from '../utils/fs.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Initialize command implementation
 * Creates configuration file and necessary directories
 * @param workspaceDir - Path to the workspace directory
 * @param force - Whether to overwrite existing configuration and wipe all data
 */
export async function initCommand(workspaceDir: string, force = false): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Creating the default configuration file.',

			nextSteps: ['Review configuration in config.jsonc', 'Run: {cli} symbol-add <SYMBOLS>', 'Run: {cli} sync', 'Run: {cli} train', 'Run: {cli} predict'],
			title: 'Initialization',
		},
		async () => {
			const spinner = ui.spinner('Initializing AI Stock Predictions CLI').start();
			const resolvedWorkspace = resolve(process.cwd(), workspaceDir);

			if (force) {
				spinner.text = 'Wiping existing workspace...';
				await FsUtils.deletePath(resolvedWorkspace);
				await FsUtils.deletePath(resolve(process.cwd(), 'output'));
				spinner.text = 'Workspace wiped successfully.';
			} else if (configExists(workspaceDir)) {
				const resolvedPath = getConfigFilePath(workspaceDir);
				spinner.warn('Configuration file already exists');
				ui.log(chalk.yellow(`Configuration file found at: ${resolvedPath}`));
				ui.log(chalk.blue('To reinitialize and wipe data, use the --force flag.'));
				return;
			}

			// Ensure workspace directory exists
			await FsUtils.ensureDir(resolvedWorkspace);

			// Create configuration
			const defaultConfig = getDefaultConfig();

			spinner.text = 'Creating configuration file...';
			const resolvedPath = getConfigFilePath(workspaceDir);

			await saveConfig(defaultConfig, workspaceDir);

			spinner.succeed('Initialization complete!');

			ui.log('\n' + chalk.green('✅ AI Stock Predictions CLI initialized successfully!'));
			ui.log('\n' + chalk.bold('Configuration file created:'));
			ui.log(chalk.cyan(`  ${resolvedPath}`));
		},
		{},
	);
}
