import chalk from 'chalk';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {ui} from '../utils/ui.ts';
import type {Config} from '../../config/schema.ts';

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
	syncSymbols: async (symbols: {symbol: string; name: string}[], config: Config, quickTest = false): Promise<void> => {
		const dataSource = new YahooFinanceDataSource(config.dataSource);
		const storage = new SqliteStorage();
		const progress = new ProgressTracker();

		ui.log(chalk.blue(`\n📊 Syncing data for ${symbols.length} symbols`));

		for (let i = 0; i < symbols.length; i++) {
			const entry = symbols[i];
			if (!entry) continue;
			const {symbol, name} = entry;
			const prefix = chalk.dim(`[${i + 1}/${symbols.length}]`);
			const spinner = ui.spinner(`${prefix} Processing ${name} (${symbol})`).start();

			try {
				// Persist symbol name to database if it doesn't exist
				if (!storage.symbolExists(symbol)) {
					storage.saveSymbol(symbol, name);
				}

				// Calculate start date
				let startDate: Date;
				const lastStoredDate = await storage.getDataTimestamp(symbol);

				if (lastStoredDate) {
					startDate = new Date(lastStoredDate);
					startDate.setDate(startDate.getDate() + 1);
				} else {
					startDate = new Date('1900-01-01');
				}

				const today = new Date();
				today.setHours(0, 0, 0, 0);

				if (startDate >= today) {
					spinner.succeed(`${prefix} ${name} (${symbol}) (up to date)`);
					progress.complete(symbol, 'up-to-date');
					continue;
				}

				// Fetch data
				spinner.text = `${prefix} Fetching ${name} (${symbol}) data...`;
				const result = await dataSource.getHistoricalData(symbol, startDate, quickTest ? 1000 : undefined);

				if (result.data.length === 0) {
					spinner.succeed(`${prefix} ${name} (${symbol}) (no new data)`);
					progress.complete(symbol, 'up-to-date');
					continue;
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

				// Rate limiting
				if (i < symbols.length - 1) {
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

		// Display summary
		const summary = progress.getSummary();
		ui.log('\n' + chalk.bold('📈 Sync Summary:'));
		ui.log(chalk.green(`  ✅ Updated: ${summary.updated ?? 0}`));
		ui.log(chalk.blue(`  ℹ️  Up to date: ${summary['up-to-date'] ?? 0}`));
		ui.log(chalk.red(`  ❌ Errors: ${summary.error ?? 0}`));
		ui.log(chalk.dim(`  📊 Total symbols processed: ${symbols.length}`));
	},
};
