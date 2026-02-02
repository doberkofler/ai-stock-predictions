/**
 * Import command - Deserializes a JSON file and overwrites existing databases
 */

import {join} from 'node:path';
import {z} from 'zod';

import {HistoricalRowSchema, MetadataRowSchema, SqliteStorage, SymbolRowSchema} from '../../gather/storage.ts';
import {FsUtils} from '../utils/fs.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Export data schema for validation
 */
const ExportSchema = z.object({
	historical_data: z.array(HistoricalRowSchema),
	models_metadata: z.array(MetadataRowSchema),
	symbols: z.array(SymbolRowSchema).optional(),
	version: z.string(),
});

/**
 * Import command implementation
 * @param configPath - Path to the configuration file (needed for runCommand)
 * @param importPath - Path to the JSON file to import
 */
export async function importCommand(configPath: string, importPath = 'export.json'): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Hydrating the relational SQLite databases from a serialized JSON backup.',
			title: 'Data Import',
		},
		async () => {
			const spinner = ui.spinner('Importing databases...').start();

			const resolvedPath = join(process.cwd(), importPath);
			const rawData = await FsUtils.readJson(resolvedPath);

			spinner.text = 'Validating import data...';
			const validatedData = ExportSchema.parse(rawData);

			const storage = new SqliteStorage();

			if (validatedData.symbols) {
				spinner.text = 'Overwriting symbols...';
				await storage.overwriteSymbols(validatedData.symbols);
			}

			spinner.text = 'Overwriting historical data...';
			await storage.overwriteHistoricalData(validatedData.historical_data);

			spinner.text = 'Overwriting models metadata...';
			await storage.overwriteModelsMetadata(validatedData.models_metadata);

			storage.close();
			spinner.succeed(`Import complete! Overwritten from: ${resolvedPath}`);
		},
		{},
	);
}
