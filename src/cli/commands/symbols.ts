/**
 * Symbol commands - Manages symbols in the database
 */

import chalk from 'chalk';
import {join} from 'node:path';

import {ModelPersistence} from '../../compute/persistence.ts';
import {getDefaultSymbols} from '../../constants/defaults-loader.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {SymbolService} from '../services/symbol-service.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Adds symbols to the database and synchronizes data
 * @param configPath - Path to the config file
 * @param symbolsStr - Comma-separated symbols
 */
export async function symbolAddCommand(configPath: string, symbolsStr: string): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Adding new symbols to the portfolio.',
			nextSteps: ['Run: {cli} sync to download historical data'],
			title: 'Add Symbols',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage();
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
 * @param configPath - Path to the config file
 */
export async function symbolDefaultsCommand(configPath: string): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Populating the database with default symbols.',
			nextSteps: ['Run: {cli} sync to download historical data'],
			title: 'Add Default Symbols',
		},
		// eslint-disable-next-line @typescript-eslint/require-await
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage();
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
 * @param configPath - Path to the config file
 */
export async function symbolListCommand(configPath: string): Promise<void> {
	await runCommand(
		{
			configPath,
			title: 'Portfolio List',
		},
		async () => {
			const storage = new SqliteStorage();
			const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
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
 * @param configPath - Path to the config file
 * @param symbolsStr - Comma-separated symbols
 */
export async function symbolRemoveCommand(configPath: string, symbolsStr: string): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Removing symbols and associated data/models from the portfolio.',
			title: 'Remove Symbols',
		},
		async () => {
			const symbols = symbolsStr.split(',').map((s) => s.trim().toUpperCase());

			for (const symbol of symbols) {
				const spinner = ui.spinner(`Removing symbol ${symbol}...`).start();
				await SymbolService.removeSymbol(symbol);
				spinner.succeed(`Removed ${symbol} and all associated data/models`);
			}
		},
		{},
	);
}
