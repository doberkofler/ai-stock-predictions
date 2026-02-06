/**
 * Symbol commands - Manages symbols in the database
 */

import chalk from 'chalk';
import {join, resolve} from 'node:path';
import {z} from 'zod';

import {ModelPersistence} from '../../compute/persistence.ts';
import {getDefaultSymbols} from '../../constants/defaults-loader.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {SymbolService} from '../services/symbol-service.ts';
import {FsUtils} from '../utils/fs.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Single symbol import schema for validation
 */
const SingleSymbolImportSchema = z.object({
	history: z.array(
		z.object({
			adjClose: z.number().optional(),
			close: z.number(),
			date: z.string(),
			high: z.number().optional(),
			low: z.number().optional(),
			open: z.number().optional(),
			volume: z.number().optional(),
		}),
	),
	name: z.string(),
	priority: z.number().default(100),
	symbol: z.string(),
	type: z.string().default('STOCK'),
});

/**
 * Adds symbols to the database and synchronizes data
 * @param workspaceDir - Path to the workspace directory
 * @param symbolsStr - Comma-separated symbols
 */
export async function symbolAddCommand(workspaceDir: string, symbolsStr: string): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Adding new symbols to the portfolio.',
			nextSteps: ['Run: {cli} sync to download historical data'],
			title: 'Add Symbols',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage(workspaceDir);
			const dataSource = new YahooFinanceDataSource(config.dataSource);
			const symbols = symbolsStr.split(',').map((s) => s.trim().toUpperCase());
			const addedSymbols: {name: string; symbol: string}[] = [];

			for (const symbol of symbols) {
				const spinner = ui.spinner(`Adding symbol ${symbol}...`).start();

				if (storage.symbolExists(symbol)) {
					spinner.info(`Symbol ${symbol} already exists in the database`);
					const name = storage.getSymbolName(symbol) ?? symbol;
					addedSymbols.push({name, symbol});
					continue;
				}

				try {
					spinner.text = `Validating and fetching name for ${symbol}...`;
					const isValid = await dataSource.validateSymbol(symbol);
					if (!isValid) {
						spinner.fail(`Symbol ${symbol} is not a valid Yahoo Finance symbol`);
						continue;
					}

					const quote = await dataSource.getCurrentQuote(symbol);
					storage.saveSymbol(symbol, quote.name);
					spinner.succeed(`Added ${quote.name} (${symbol}) to the database`);
					addedSymbols.push({name: quote.name, symbol});
				} catch (error) {
					spinner.fail(`Failed to add symbol ${symbol}`);
					if (error instanceof Error) ui.error(chalk.red(`  Error: ${error.message}`));
				}
			}

			if (addedSymbols.length > 0) {
				ui.log(chalk.green(`\n✅ Added ${addedSymbols.length} symbol(s)`));
			}
		},
		{},
	);
}

/**
 * Adds default symbols and synchronizes data
 * @param workspaceDir - Path to the workspace directory
 */
export async function symbolDefaultsCommand(workspaceDir: string): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Populating the database with default symbols.',
			nextSteps: ['Run: {cli} sync to download historical data'],
			title: 'Add Default Symbols',
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage(workspaceDir);
			const defaults = getDefaultSymbols();
			const addedSymbols: {name: string; symbol: string}[] = [];

			for (const entry of defaults) {
				if (!storage.symbolExists(entry.symbol)) {
					storage.saveSymbol(entry.symbol, entry.name, entry.type, entry.priority);
				}
				addedSymbols.push({name: entry.name, symbol: entry.symbol});
			}

			ui.log(chalk.green(`\n✅ Registered ${addedSymbols.length} default symbols`));
		},
		{},
	);
}

/**
 * Lists all symbols in the database
 * @param workspaceDir - Path to the workspace directory
 */
export async function symbolListCommand(workspaceDir: string): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			title: 'Portfolio List',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const resolvedWorkspace = resolve(process.cwd(), workspaceDir);
			const storage = new SqliteStorage(workspaceDir);
			const modelPersistence = new ModelPersistence(join(resolvedWorkspace, 'models'));
			const symbols = storage.getAllSymbols();

			ui.log(chalk.blue(`\n📊 Current Portfolio (${symbols.length} symbols):\n`));

			if (symbols.length === 0) {
				ui.log(chalk.dim('  (No symbols in portfolio)'));
				return;
			}

			const header = 'SYM'.padEnd(8) + 'NAME'.padEnd(35) + 'POINTS'.padEnd(10) + 'LAST DATE'.padEnd(15) + 'TRAINED AT'.padEnd(25) + 'LOSS';
			ui.log(chalk.bold.dim(header));
			ui.log(chalk.dim('─'.repeat(header.length)));

			const sortedSymbols = symbols.toSorted((a, b) => a.symbol.localeCompare(b.symbol));

			for (const s of sortedSymbols) {
				const count = storage.getQuoteCount(s.symbol);
				const lastDate = await storage.getDataTimestamp(s.symbol);
				const metadata = await modelPersistence.getModelMetadata(s.symbol);

				const symCol = chalk.bold(s.symbol.padEnd(8));
				const nameCol = s.name.slice(0, 33).padEnd(35);
				const countCol = String(count).padEnd(10);
				const dateCol = (lastDate?.toISOString().split('T')[0] ?? '-').padEnd(15);
				const trainedAtCol = (metadata?.trainedAt ? metadata.trainedAt.toISOString().replace('T', ' ').slice(0, 19) : '-').padEnd(25);
				const lossCol = metadata ? metadata.loss.toFixed(4) : '-';

				ui.log(`${symCol}${nameCol}${countCol}${dateCol}${trainedAtCol}${lossCol}`);
			}
		},
		{},
	);
}

/**
 * Removes symbols from the database
 * @param workspaceDir - Path to the workspace directory
 * @param symbolsStr - Comma-separated symbols
 */
export async function symbolRemoveCommand(workspaceDir: string, symbolsStr: string): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Removing symbols and associated data/models from the portfolio.',
			title: 'Remove Symbols',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const symbols = symbolsStr.split(',').map((s) => s.trim().toUpperCase());

			for (const symbol of symbols) {
				const spinner = ui.spinner(`Removing symbol ${symbol}...`).start();
				await SymbolService.removeSymbol(symbol, config, workspaceDir);
				spinner.succeed(`Removed ${symbol} and all associated data/models`);
			}
		},
		{},
	);
}

/**
 * Import a symbol and its history from a JSON file
 * @param workspaceDir - Path to the workspace directory
 * @param importPath - Path to the JSON file
 */
export async function symbolImportCommand(workspaceDir: string, importPath: string): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Importing a custom symbol and its history from a JSON file.',
			nextSteps: ['Run: {cli} sync to calculate market features'],
			title: 'Symbol Import',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const spinner = ui.spinner(`Reading ${importPath}...`).start();

			const resolvedPath = join(process.cwd(), importPath);
			const rawData = await FsUtils.readJson(resolvedPath);

			spinner.text = 'Validating import data...';
			const validated = SingleSymbolImportSchema.parse(rawData);
			const symbol = validated.symbol.toUpperCase();

			const storage = new SqliteStorage(workspaceDir);

			spinner.text = `Saving symbol ${symbol}...`;
			storage.saveSymbol(symbol, validated.name, validated.type, validated.priority);

			spinner.text = `Saving ${validated.history.length} historical data points for ${symbol}...`;
			const stockData = validated.history.map((h) => ({
				adjClose: h.adjClose ?? h.close,
				close: h.close,
				date: h.date,
				high: h.high ?? h.close,
				low: h.low ?? h.close,
				open: h.open ?? h.close,
				volume: h.volume ?? 0,
			}));

			await storage.saveStockData(symbol, stockData);

			spinner.succeed(`Successfully imported ${validated.name} (${symbol}) with ${validated.history.length} data points.`);
		},
		{},
	);
}
