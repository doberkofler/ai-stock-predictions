/**
 * Export command - Serializes all databases to a single JSON file
 */

import chalk from 'chalk';
import {join} from 'node:path';

import {SqliteStorage} from '../../gather/storage.ts';
import {DateUtils} from '../utils/date.ts';
import {FsUtils} from '../utils/fs.ts';
import {ui} from '../utils/ui.ts';

/**
 * Export command implementation
 * @param exportPath - Path where to save the export file
 */
export async function exportCommand(exportPath = 'export.json'): Promise<void> {
	ui.log(chalk.bold.blue('\n=== AI Stock Predictions: Data Export ==='));
	ui.log(chalk.dim('Serializing relational SQLite databases into a portable JSON format.\n'));
	const startTime = Date.now();
	const spinner = ui.spinner('Exporting databases...').start();

	try {
		const storage = new SqliteStorage();

		spinner.text = 'Fetching symbols...';
		const symbols = storage.getAllSymbols();

		spinner.text = 'Fetching quotes...';
		const quotes = storage.getAllQuotes();

		spinner.text = 'Fetching metadata...';
		const metadata = storage.getAllMetadata();

		const exportData = {
			exportedAt: new Date().toISOString(),
			historical_data: quotes,
			models_metadata: metadata,
			symbols,
			version: '1.1.0',
		};

		const resolvedPath = join(process.cwd(), exportPath);
		await FsUtils.writeJson(resolvedPath, exportData);

		storage.close();
		spinner.succeed(`Export complete! Saved to: ${resolvedPath}`);
		ui.log(chalk.cyan(`Process completed in ${DateUtils.formatDuration(Date.now() - startTime)}.`));
	} catch (error) {
		/* v8 ignore start */
		spinner.fail('Export failed');
		if (error instanceof Error) {
			ui.error(chalk.red(`Error: ${error.message}`));
		}
		process.exit(1);
		/* v8 ignore stop */
	}
}
