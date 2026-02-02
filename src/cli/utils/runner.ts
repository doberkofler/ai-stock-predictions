import chalk from 'chalk';

import type {Config} from '../../config/schema.ts';

import {configExists, loadConfig} from '../../config/config.ts';
import {initializeEnvironment} from '../../env.ts';
import {DateUtils} from './date.ts';
import {ui} from './ui.ts';

type CommandContext = {
	config: Config | undefined;
	startTime: number;
};

type CommandHandler<T> = (context: CommandContext, options: T) => Promise<void>;

type RunOptions = {
	configPath: string;
	description?: string;
	title: string;
};

/**
 * Executes a CLI command with standardized initialization, error handling, and lifecycle logging.
 * Reduces boilerplate in command files by centralizing infrastructure.
 * @param options - Command execution options (title, description, configPath)
 * @param handler - The actual command logic to execute
 * @param commandOptions - Options specific to the command being run
 */
export async function runCommand<T>(options: RunOptions, handler: CommandHandler<T>, commandOptions: T): Promise<void> {
	await initializeEnvironment();

	ui.log(chalk.bold.blue(`\n=== AI Stock Predictions: ${options.title} ===`));
	if (options.description) {
		ui.log(chalk.dim(`${options.description}\n`));
	}

	const startTime = Date.now();

	// Listen for SIGINT to ensure graceful exit
	const sigintHandler = (): void => {
		ui.log(chalk.yellow('\n\n🛑 Operation interrupted by user. Exiting immediately...'));
		process.exit(0);
	};
	process.on('SIGINT', sigintHandler);

	try {
		// Only load config if it exists
		const config = configExists(options.configPath) ? loadConfig(options.configPath) : undefined;
		await handler({config, startTime}, commandOptions);

		ui.log(chalk.cyan(`\nProcess completed in ${DateUtils.formatDuration(Date.now() - startTime)}.`));
	} catch (error) {
		if (error instanceof Error) {
			ui.error(chalk.red(`\n❌ ${options.title} failed`));
			ui.error(chalk.red(`Error: ${error.message}`));
		} else {
			ui.error(chalk.red(`\n❌ Unknown error occurred during ${options.title}`));
		}
		process.exit(1);
	} finally {
		process.off('SIGINT', sigintHandler);
	}
}
