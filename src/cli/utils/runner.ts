import chalk from 'chalk';

import type {Config} from '../../config/schema.ts';

import {configExists, loadConfig} from '../../config/config.ts';
import {initializeEnvironment, initializeTensorFlow} from '../../env.ts';
import {DateUtils} from './date.ts';
import {getCliInvocation} from './cli-helper.ts';
import {InterruptError, InterruptHandler} from './interrupt.ts';
import {ui} from './ui.ts';

type CommandContext = {
	config: Config | undefined;
	startTime: number;
};

type CommandHandler<T> = (context: CommandContext, options: T) => Promise<void>;

type RunOptions = {
	workspaceDir: string;
	description?: string;
	needsTensorFlow?: boolean;
	nextSteps?: string[];
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
	if (options.needsTensorFlow) {
		await initializeTensorFlow();
	}

	ui.log(chalk.bold.blue(`\n=== AI Stock Predictions: ${options.title} ===`));
	if (options.description) {
		ui.log(chalk.dim(`${options.description}\n`));
	}

	const startTime = Date.now();

	// Initialize interrupt handler for graceful Ctrl+C support
	InterruptHandler.initialize();

	try {
		// Only load config if it exists
		const config = configExists(options.workspaceDir) ? loadConfig(options.workspaceDir) : undefined;
		await handler({config, startTime}, commandOptions);

		ui.log(chalk.cyan(`\nProcess completed in ${DateUtils.formatDuration(Date.now() - startTime)}.`));

		// Display next steps if provided
		if (options.nextSteps && options.nextSteps.length > 0) {
			ui.log(chalk.bold('\nNext steps:'));
			const cliInvocation = getCliInvocation();
			for (const [i, step] of options.nextSteps.entries()) {
				const formattedStep = step.replaceAll('{cli}', cliInvocation);
				ui.log(chalk.cyan(`  ${String(i + 1)}. ${formattedStep}`));
			}
		}
	} catch (error) {
		if (error instanceof InterruptError) {
			ui.log(chalk.yellow('\n\n🛑 Operation interrupted by user. Partial progress may be saved.'));
			process.exit(130); // Standard SIGINT exit code
		} else if (error instanceof Error) {
			ui.error(chalk.red(`\n❌ ${options.title} failed`));
			ui.error(chalk.red(`Error: ${error.message}`));
		} else {
			ui.error(chalk.red(`\n❌ Unknown error occurred during ${options.title}`));
		}
		process.exit(1);
	} finally {
		// Reset interrupt state for next command (if applicable)
		InterruptHandler.reset();
	}
}
