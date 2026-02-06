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
 * @param workspaceDir - Path to the workspace directory
 * @param exportPath - Path where to save the export file
 */
export async function exportCommand(workspaceDir: string, exportPath = 'export.json'): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Serializing relational SQLite databases into a portable JSON format.',
			nextSteps: ['Share the export file with others or use it to restore data on another system'],
			title: 'Data Export',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing.');
			}
			const spinner = ui.spinner('Exporting databases...').start();

			const storage = new SqliteStorage(workspaceDir);

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
