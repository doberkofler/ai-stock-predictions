/**
 * Export command - Serializes all databases to a single JSON file
 */

import {join} from 'node:path';

import {SqliteStorage} from '../../gather/storage.ts';
import {FsUtils} from '../utils/fs.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Export command implementation
 * @param configPath - Path to the configuration file (needed for runCommand)
 * @param exportPath - Path where to save the export file
 */
export async function exportCommand(configPath: string, exportPath = 'export.json'): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Serializing relational SQLite databases into a portable JSON format.',
			nextSteps: ['Share the export file with others or use it to restore data on another system'],
			title: 'Data Export',
		},
		async () => {
			const spinner = ui.spinner('Exporting databases...').start();

			const storage = new SqliteStorage();

			spinner.text = 'Fetching symbols...';
			const symbols = storage.getAllSymbols();

			spinner.text = 'Fetching historical data...';
			const quotes = storage.getAllQuotes();

			const exportData = {
				exportedAt: new Date().toISOString(),
				historical_data: quotes,
				symbols,
				version: '2.0.0',
			};

			const resolvedPath = join(process.cwd(), exportPath);
			await FsUtils.writeJson(resolvedPath, exportData);

			storage.close();
			spinner.succeed(`Export complete! Saved to: ${resolvedPath}`);
		},
		{},
	);
}
