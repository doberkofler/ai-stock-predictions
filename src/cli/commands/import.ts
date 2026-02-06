/**
 * Import command - Deserializes a JSON file and overwrites existing databases
 */

import {join} from 'node:path';
import {z} from 'zod';

import {HistoricalRowSchema, SqliteStorage, SymbolRowSchema} from '../../gather/storage.ts';
import {FsUtils} from '../utils/fs.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Export data schema for validation (v2.0.0+)
 * Only includes user-defined data: symbols and historical quotes
 * Computed data (models_metadata, market_features, data_quality) is excluded
 */
const ExportSchema = z.object({
	exportedAt: z.string().optional(),
	historical_data: z.array(HistoricalRowSchema),
	symbols: z.array(SymbolRowSchema),
	version: z.string().refine((v) => v.startsWith('2.'), {
		message: 'Only v2.x export files are supported. Please re-export your data.',
	}),
});

/**
 * Import command implementation
 * @param workspaceDir - Path to the workspace directory
 * @param importPath - Path to the JSON file to import
 */
export async function importCommand(workspaceDir: string, importPath = 'export.json'): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Hydrating the relational SQLite databases from a serialized JSON backup.',
			nextSteps: ['Run: {cli} sync to update historical data', 'Run: {cli} train to regenerate models'],
			title: 'Data Import',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing.');
			}
			const spinner = ui.spinner('Importing databases...').start();

			const resolvedPath = join(process.cwd(), importPath);
			const rawData = await FsUtils.readJson(resolvedPath);

			spinner.text = 'Validating import data...';
			const validatedData = ExportSchema.parse(rawData);

			const storage = new SqliteStorage(workspaceDir);

			spinner.text = 'Overwriting symbols...';
			await storage.overwriteSymbols(validatedData.symbols);

			spinner.text = 'Overwriting historical data...';
			await storage.overwriteHistoricalData(validatedData.historical_data);

			storage.close();
			spinner.succeed(`Import complete! Data restored from: ${resolvedPath}`);
		},
		{},
	);
}
