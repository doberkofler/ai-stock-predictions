/**
 * Gather command - Fetches new stock data from Yahoo Finance API
 * Implements rate limiting, retry logic, and progress tracking
 */

import chalk from 'chalk';
import ora from 'ora';
import {loadConfig} from '../../config/config.ts';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {ProgressTracker} from '../utils/progress.ts';

/**
 * Gather command implementation
 * Fetches historical stock data for all configured symbols
 * @param {string} configPath - Path to the configuration file
 * @param {boolean} [full] - Perform a full refresh instead of incremental
 * @param {boolean} [quickTest] - Run with limited symbols for verification
 * @param {boolean} [init] - Clear all existing data before gathering
 */
export async function gatherCommand(configPath: string, full = false, quickTest = false, init = false): Promise<void> {
	console.log(chalk.bold.blue('\n--- Gathering Stock Data ---'));
	const startTime = Date.now();

	// Handle Ctrl-C
	process.on('SIGINT', () => {
		console.log(chalk.yellow('\n\n🛑 Operation interrupted by user. Exiting immediately...'));
		process.exit(0);
	});

	const spinner = ora('Loading configuration').start();

	try {
		// Load configuration
		const config = loadConfig(configPath);
		spinner.succeed('Configuration loaded');

		// Initialize components
		const dataSource = new YahooFinanceDataSource(config.api);
		const storage = new SqliteStorage();
		const progress = new ProgressTracker();

		if (init) {
			spinner.text = 'Clearing existing data...';
			await storage.clearAllData();
			spinner.succeed('Existing data cleared');
		}

		let symbolsToProcess = config.symbols;
		if (quickTest) {
			symbolsToProcess = symbolsToProcess.slice(0, 3);
			console.log(chalk.yellow('⚠️  Quick test mode active: Processing only the first 3 symbols'));
		}

		console.log(chalk.blue(`\n📊 Gathering data for ${symbolsToProcess.length} symbols`));
		if (full) {
			console.log(chalk.yellow('⚠️  Performing full history refresh'));
		}

		// Process each symbol
		for (let i = 0; i < symbolsToProcess.length; i++) {
			const symbolEntry = symbolsToProcess[i];
			if (!symbolEntry) continue;
			const {symbol, name} = symbolEntry;

			const symbolSpinner = ora(`Processing ${name} (${symbol}) (${i + 1}/${symbolsToProcess.length})`).start();

			try {
				// Persist symbol name to database
				storage.saveSymbol(symbol, name);

				// Calculate start date
				let startDate: Date;
				const lastStoredDate = await storage.getDataTimestamp(symbol);

				if (full || !lastStoredDate) {
					startDate = new Date('1900-01-01');
				} else {
					// Set to last stored date + 1 day
					startDate = new Date(lastStoredDate);
					startDate.setDate(startDate.getDate() + 1);
				}

				// Check if we already have today's data
				const today = new Date();
				today.setHours(0, 0, 0, 0);

				if (startDate >= today) {
					symbolSpinner.succeed(`${name} (${symbol}) (up to date)`);
					progress.complete(symbol, 'up-to-date');
					continue;
				}

				// Fetch new data
				symbolSpinner.text = `Fetching ${name} (${symbol}) data from ${startDate.toISOString().split('T')[0]}...`;
				const result = await dataSource.getHistoricalData(symbol, startDate);

				if (result.data.length === 0) {
					symbolSpinner.succeed(`${name} (${symbol}) (no new data)`);
					progress.complete(symbol, 'up-to-date');
					continue;
				}

				// Save data
				symbolSpinner.text = `Saving ${name} (${symbol}) data...`;
				await storage.saveStockData(symbol, result.data);

				let successMsg = `${name} (${symbol}) (${result.data.length} new points`;
				if (result.omittedCount > 0) {
					successMsg += `, ${result.omittedCount} omitted incomplete`;
				}
				if (result.oldestDate) {
					successMsg += `, oldest: ${result.oldestDate.split('T')[0]}`;
				}
				successMsg += ')';

				symbolSpinner.succeed(successMsg);
				progress.complete(symbol, 'updated', result.data.length);

				// Rate limiting
				if (i < symbolsToProcess.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, config.api.rateLimit));
				}
			} catch (error) {
				symbolSpinner.fail(`${name} (${symbol}) ✗`);
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
		spinner.fail('Data gathering failed');
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		} else {
			console.error(chalk.red('Unknown error occurred during data gathering'));
		}
		process.exit(1);
	}
}
