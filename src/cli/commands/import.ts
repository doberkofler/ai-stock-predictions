/**
 * Import command - Deserializes a JSON file and overwrites existing databases
 */

import chalk from 'chalk';
import ora from 'ora';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {SqliteStorage, SymbolRowSchema, HistoricalRowSchema, MetadataRowSchema} from '../../gather/storage.ts';
import {ProgressTracker} from '../utils/progress.ts';

/**
 * Export data schema for validation
 */
const ExportSchema = z.object({
	version: z.string(),
	symbols: z.array(SymbolRowSchema).optional(),
	historical_data: z.array(HistoricalRowSchema),
	models_metadata: z.array(MetadataRowSchema),
});

/**
 * Import command implementation
 * @param importPath - Path to the JSON file to import
 */
export async function importCommand(importPath = 'export.json'): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Data Import ==='));
	console.log(chalk.dim('Hydrating the relational SQLite databases from a serialized JSON backup.\n'));
	const startTime = Date.now();
	const spinner = ora('Importing databases...').start();

	try {
		const resolvedPath = join(process.cwd(), importPath);
		const fileContent = await readFile(resolvedPath, 'utf8');
		const rawData = JSON.parse(fileContent) as unknown;

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
		console.log(chalk.cyan(`Process completed in ${ProgressTracker.formatDuration(Date.now() - startTime)}.`));
	} catch (error) {
		spinner.fail('Import failed');
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		}
		process.exit(1);
	}
}
