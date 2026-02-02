/**
 * Export command - Serializes all databases to a single JSON file
 */

import chalk from 'chalk';
import ora from 'ora';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {SqliteStorage} from '../../gather/storage.ts';
import {ProgressTracker} from '../utils/progress.ts';

/**
 * Export command implementation
 * @param exportPath - Path where to save the export file
 */
export async function exportCommand(exportPath = 'export.json'): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Data Export ==='));
	console.log(chalk.dim('Serializing relational SQLite databases into a portable JSON format.\n'));
	const startTime = Date.now();
	const spinner = ora('Exporting databases...').start();

	try {
		const storage = new SqliteStorage();

		spinner.text = 'Fetching symbols...';
		const symbols = storage.getAllSymbols();

		spinner.text = 'Fetching quotes...';
		const quotes = storage.getAllQuotes();

		spinner.text = 'Fetching metadata...';
		const metadata = storage.getAllMetadata();

		const exportData = {
			version: '1.1.0',
			exportedAt: new Date().toISOString(),
			symbols,
			historical_data: quotes,
			models_metadata: metadata,
		};

		const resolvedPath = join(process.cwd(), exportPath);
		await writeFile(resolvedPath, JSON.stringify(exportData, null, 2), 'utf8');

		storage.close();
		spinner.succeed(`Export complete! Saved to: ${resolvedPath}`);
		console.log(chalk.cyan(`Process completed in ${ProgressTracker.formatDuration(Date.now() - startTime)}.`));
	} catch (error) {
		spinner.fail('Export failed');
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		}
		process.exit(1);
	}
}
