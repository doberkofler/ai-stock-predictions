/**
 * Import command - Deserializes a JSON file and overwrites existing databases
 */

import chalk from 'chalk';
import {join} from 'node:path';
import {z} from 'zod';

import {HistoricalRowSchema, MetadataRowSchema, SqliteStorage, SymbolRowSchema} from '../../gather/storage.ts';
import {DateUtils} from '../utils/date.ts';
import {FsUtils} from '../utils/fs.ts';
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
 * @param importPath - Path to the JSON file to import
 */
export async function importCommand(importPath = 'export.json'): Promise<void> {
	ui.log(chalk.bold.blue('\n=== AI Stock Predictions: Data Import ==='));
	ui.log(chalk.dim('Hydrating the relational SQLite databases from a serialized JSON backup.\n'));
	const startTime = Date.now();
	const spinner = ui.spinner('Importing databases...').start();

	try {
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
		ui.log(chalk.cyan(`Process completed in ${DateUtils.formatDuration(Date.now() - startTime)}.`));
	} catch (error) {
		/* v8 ignore start */
		spinner.fail('Import failed');
		if (error instanceof Error) {
			ui.error(chalk.red(`Error: ${error.message}`));
		}
		process.exit(1);
		/* v8 ignore stop */
	}
}
