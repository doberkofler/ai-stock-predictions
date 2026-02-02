/**
 * Gather command - Fetches new stock data from Yahoo Finance API
 * Implements rate limiting, retry logic, and progress tracking
 */

import chalk from 'chalk';
import ora from 'ora';
import {loadConfig} from '../../config/config.ts';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {join} from 'node:path';

/**
 * Gather command implementation
 * Fetches historical stock data for all configured symbols
 * @param {string} configPath - Path to the configuration file
 * @param {boolean} [quickTest] - Run with limited symbols for verification
 * @param {boolean} [init] - Clear all existing data before gathering
 */
export async function gatherCommand(configPath: string, quickTest = false, init = false): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Data Gathering ==='));
	console.log(chalk.dim('Fetching historical market data from Yahoo Finance and syncing the local database.\n'));
	const startTime = Date.now();

	// Handle Ctrl-C
	process.on('SIGINT', () => {
		console.log(chalk.yellow('\n\n🛑 Operation interrupted by user. Exiting immediately...'));
		process.exit(0);
	});

	try {
		// Load configuration
		const config = loadConfig(configPath);

		// Initialize components
		const dataSource = new YahooFinanceDataSource(config.api);
		const storage = new SqliteStorage();
		const progress = new ProgressTracker();

		if (init || quickTest) {
			const spinner = ora(quickTest ? 'Clearing data for quick test...' : 'Clearing existing data...').start();
			const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
			await storage.clearAllData();
			await modelPersistence.deleteAllModels();
			spinner.succeed(quickTest ? 'Database and models cleared for quick test' : 'Existing data and models cleared');
		}

		let symbolsToProcess: {symbol: string; name: string}[] = [];
		const dbSymbols = storage.getAllSymbols();

		if (dbSymbols.length === 0) {
			console.log(chalk.yellow('No symbols found in the database.'));
			console.log(chalk.yellow('\n💡 Suggestion: Run "ai-stock-predictions portfolio --add-defaults" to populate the database.'));
			return;
		}

		symbolsToProcess = dbSymbols;

		if (quickTest) {
			symbolsToProcess = symbolsToProcess.slice(0, 3);
			console.log(chalk.yellow('⚠️  Quick test mode active: Processing only the first 3 symbols'));
		}

		console.log(chalk.blue(`\n📊 Gathering data for ${symbolsToProcess.length} symbols`));

		// Process each symbol
		for (let i = 0; i < symbolsToProcess.length; i++) {
			const symbolEntry = symbolsToProcess[i];
			if (!symbolEntry) continue;
			const {symbol, name} = symbolEntry;

			const prefix = chalk.dim(`[${i + 1}/${symbolsToProcess.length}]`);
			const symbolSpinner = ora(`${prefix} Processing ${name} (${symbol})`).start();

			try {
				// Persist symbol name to database
				storage.saveSymbol(symbol, name);

				// Calculate start date
				let startDate: Date;
				const lastStoredDate = await storage.getDataTimestamp(symbol);

				if (lastStoredDate) {
					// Set to last stored date + 1 day
					startDate = new Date(lastStoredDate);
					startDate.setDate(startDate.getDate() + 1);
				} else {
					startDate = new Date('1900-01-01');
				}

				// Check if we already have today's data
				const today = new Date();
				today.setHours(0, 0, 0, 0);

				if (startDate >= today) {
					symbolSpinner.succeed(`${prefix} ${name} (${symbol}) (up to date)`);
					progress.complete(symbol, 'up-to-date');
					continue;
				}

				// Fetch new data
				symbolSpinner.text = `${prefix} Fetching ${name} (${symbol}) data from ${startDate.toISOString().split('T')[0]}...`;
				const result = await dataSource.getHistoricalData(symbol, startDate, quickTest ? 50 : undefined);

				if (result.data.length === 0) {
					symbolSpinner.succeed(`${prefix} ${name} (${symbol}) (no new data)`);
					progress.complete(symbol, 'up-to-date');
					continue;
				}

				// Save data
				symbolSpinner.text = `${prefix} Saving ${name} (${symbol}) data...`;
				await storage.saveStockData(symbol, result.data);

				let successMsg = `${prefix} ${name} (${symbol}) [${result.data.length} new pts]`;
				if (result.omittedCount > 0) {
					successMsg += ` (${result.omittedCount} omitted)`;
				}

				symbolSpinner.succeed(successMsg);
				progress.complete(symbol, 'updated', result.data.length);

				// Rate limiting
				if (i < symbolsToProcess.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, config.api.rateLimit));
				}
			} catch (error) {
				symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗`);
				progress.complete(symbol, 'error');

				if (error instanceof Error) {
					console.error(chalk.red(`  Error: ${error.message}`));
				} else {
					console.error(chalk.red('  Unknown error occurred'));
				}
			}
		}

		// Display summary
		const summary = progress.getSummary();
		console.log('\n' + chalk.bold('📈 Data Gathering Summary:'));
		console.log(chalk.green(`  ✅ Updated: ${summary.updated ?? 0}`));
		console.log(chalk.blue(`  ℹ️  Up to date: ${summary['up-to-date'] ?? 0}`));
		console.log(chalk.red(`  ❌ Errors: ${summary.error ?? 0}`));
		console.log(chalk.dim(`  📊 Total symbols processed: ${symbolsToProcess.length}`));

		if ((summary.error ?? 0) > 0) {
			console.log('\n' + chalk.yellow('⚠️  Some symbols failed to update. Check the errors above.'));
		}

		console.log('\n' + chalk.green('✅ Data gathering complete!'));
		console.log(chalk.cyan(`Process completed in ${ProgressTracker.formatDuration(Date.now() - startTime)}.`));
		console.log(chalk.cyan('Next: Run "ai-stock-predictions train" to train the models.'));
	} catch (error) {
		console.error(chalk.red('\n❌ Data gathering failed'));
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		} else {
			console.error(chalk.red('Unknown error occurred during data gathering'));
		}
		process.exit(1);
	}
}
