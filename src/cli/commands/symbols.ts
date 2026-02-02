/**
 * Symbol commands - Manages symbols in the database
 */

import chalk from 'chalk';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {join} from 'node:path';
import {ui} from '../utils/ui.ts';
import {runCommand} from '../utils/runner.ts';
import {SyncService} from '../services/sync-service.ts';
import {SymbolService} from '../services/symbol-service.ts';
import defaults from '../../constants/defaults.json' with {type: 'json'};

/**
 * Adds symbols to the database and synchronizes data
 * @param configPath - Path to the config file
 * @param symbolsStr - Comma-separated symbols
 */
export async function symbolAddCommand(configPath: string, symbolsStr: string): Promise<void> {
	await runCommand(
		{
			title: 'Add Symbols',
			description: 'Adding new symbols to the portfolio and synchronizing historical data.',
			configPath,
		},
		async ({config}) => {
			const storage = new SqliteStorage();
			const dataSource = new YahooFinanceDataSource(config.dataSource);
			const symbols = symbolsStr.split(',').map((s) => s.trim().toUpperCase());
			const addedSymbols: {symbol: string; name: string}[] = [];

			for (const symbol of symbols) {
				const spinner = ui.spinner(`Adding symbol ${symbol}...`).start();

				if (storage.symbolExists(symbol)) {
					spinner.info(`Symbol ${symbol} already exists in the database`);
					const name = storage.getSymbolName(symbol) ?? symbol;
					addedSymbols.push({symbol, name});
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
					addedSymbols.push({symbol, name: quote.name});
				} catch (error) {
					spinner.fail(`Failed to add symbol ${symbol}`);
					if (error instanceof Error) ui.error(chalk.red(`  Error: ${error.message}`));
				}
			}

			if (addedSymbols.length > 0) {
				await SyncService.syncSymbols(addedSymbols, config);
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
			title: 'Remove Symbols',
			description: 'Removing symbols and associated data/models from the portfolio.',
			configPath,
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

/**
 * Adds default symbols and synchronizes data
 * @param configPath - Path to the config file
 */
export async function symbolDefaultsCommand(configPath: string): Promise<void> {
	await runCommand(
		{
			title: 'Add Default Symbols',
			description: 'Populating the database with default symbols and syncing data.',
			configPath,
		},
		async ({config}) => {
			const storage = new SqliteStorage();
			const addedSymbols: {symbol: string; name: string}[] = [];

			for (const entry of defaults) {
				if (!storage.symbolExists(entry.symbol)) {
					storage.saveSymbol(entry.symbol, entry.name);
				}
				addedSymbols.push(entry);
			}

			ui.log(chalk.green(`\n✅ Registered ${addedSymbols.length} default symbols`));
			await SyncService.syncSymbols(addedSymbols, config);
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
			title: 'Portfolio List',
			configPath,
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

			for (const s of symbols.toSorted((a, b) => a.symbol.localeCompare(b.symbol))) {
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
