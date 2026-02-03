import type {Ora} from 'ora';

import chalk from 'chalk';

import type {Config} from '../../config/schema.ts';
import type {StockDataPoint} from '../../types/index.ts';
import type {MockOra} from '../utils/ui.ts';

import {SqliteStorage} from '../../gather/storage.ts';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {DateUtils} from '../utils/date.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {ui} from '../utils/ui.ts';

/**
 * Service for synchronizing stock data with the external data source
 */
export const SyncService = {
	/**
	 * Synchronizes data for a list of symbols
	 * @param symbols - Array of symbols to sync
	 * @param config - Application configuration
	 * @param quickTest - Whether to limit the data points for verification
	 */
	syncSymbols: async (symbols: {name: string; symbol: string}[], config: Config, quickTest = false): Promise<void> => {
		const dataSource = new YahooFinanceDataSource(config.dataSource);
		const storage = new SqliteStorage();
		const progress = new ProgressTracker();

		// Filter out indices to sync them first
		const marketIndices = symbols.filter((s) => s.symbol === '^GSPC' || s.symbol === '^VIX');
		const otherSymbols = symbols.filter((s) => s.symbol !== '^GSPC' && s.symbol !== '^VIX');
		const sortedSymbols = [...marketIndices, ...otherSymbols];

		ui.log(chalk.blue(`\n📊 Syncing data for ${symbols.length} symbols`));

		for (const [i, entry] of sortedSymbols.entries()) {
			const {name, symbol} = entry;
			const prefix = chalk.dim(`[${i + 1}/${symbols.length}]`);
			const spinner = ui.spinner(`${prefix} Processing ${name} (${symbol})`).start();

			try {
				const stockData = await syncSingleSymbol(symbol, name, storage, dataSource, progress, spinner as Ora, config, quickTest, prefix);

				// Calculate market features if it is a STOCK or ETF and we have market data
				if (config.market.featureConfig.enabled && symbol !== '^GSPC' && symbol !== '^VIX' && !symbol.startsWith('^')) {
					spinner.text = `${prefix} Calculating market features for ${name} (${symbol})...`;
					const marketData = await storage.getStockData('^GSPC');
					const vixData = await storage.getStockData('^VIX');

					if (marketData && vixData && stockData) {
						const features = dataSource.calculateMarketFeatures(symbol, stockData, marketData, vixData);
						storage.saveMarketFeatures(symbol, features);
					}
				}

				// Rate limiting
				if (i < sortedSymbols.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, config.dataSource.rateLimit));
				}
			} catch (error) {
				spinner.fail(`${prefix} ${name} (${symbol}) ✗`);
				progress.complete(symbol, 'error');
				if (error instanceof Error) {
					ui.error(chalk.red(`  Error: ${error.message}`));
				}
			}
		}

		displaySyncSummary(progress, symbols.length);
	},
};

/**
 * Display final synchronization summary
 * @param progress
 * @param total
 */
function displaySyncSummary(progress: ProgressTracker, total: number): void {
	const summary = progress.getSummary();
	const updated = summary.updated ?? 0;
	const upToDate = summary['up-to-date'] ?? 0;
	const error = summary.error ?? 0;

	ui.log('\n' + chalk.bold('📈 Sync Summary:'));
	ui.log(chalk.green(`  ✅ Updated: ${updated}`));
	ui.log(chalk.blue(`  ℹ️  Up to date: ${upToDate}`));
	ui.log(chalk.red(`  ❌ Errors: ${error}`));
	ui.log(chalk.dim(`  📊 Total symbols processed: ${total}`));
}

/**
 * Logic for synchronizing a single symbol
 * @param symbol
 * @param name
 * @param storage
 * @param dataSource
 * @param progress
 * @param spinner
 * @param _config
 * @param quickTest
 * @param prefix
 */
async function syncSingleSymbol(
	symbol: string,
	name: string,
	storage: SqliteStorage,
	dataSource: YahooFinanceDataSource,
	progress: ProgressTracker,
	spinner: MockOra | Ora,
	_config: Config,
	quickTest: boolean,
	prefix: string,
): Promise<null | StockDataPoint[]> {
	// Persist symbol name to database if it doesn't exist
	if (!storage.symbolExists(symbol)) {
		storage.saveSymbol(symbol, name);
	}

	// Calculate start date
	const lastStoredDate = await storage.getDataTimestamp(symbol);
	const startDate = lastStoredDate ? DateUtils.addDays(lastStoredDate, 1) : new Date('1900-01-01');

	const today = DateUtils.getStartOfToday();

	if (startDate >= today) {
		spinner.succeed(`${prefix} ${name} (${symbol}) (up to date)`);
		progress.complete(symbol, 'up-to-date');
		return storage.getStockData(symbol);
	}

	// Fetch data
	spinner.text = `${prefix} Fetching ${name} (${symbol}) data...`;
	const result = await dataSource.getHistoricalData(symbol, startDate, quickTest ? 1000 : undefined);

	if (result.data.length === 0) {
		spinner.succeed(`${prefix} ${name} (${symbol}) (no new data)`);
		progress.complete(symbol, 'up-to-date');
		return storage.getStockData(symbol);
	}

	// Save data
	spinner.text = `${prefix} Saving ${name} (${symbol}) data...`;
	await storage.saveStockData(symbol, result.data);

	let successMsg = `${prefix} ${name} (${symbol}) [${result.data.length} new pts]`;
	if (result.omittedCount > 0) {
		successMsg += ` (${result.omittedCount} omitted)`;
	}

	spinner.succeed(successMsg);
	progress.complete(symbol, 'updated', result.data.length);

	return storage.getStockData(symbol);
}
