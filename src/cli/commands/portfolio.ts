/**
 * Portfolio command - Manages the list of symbols in the database
 */

import chalk from 'chalk';
import ora from 'ora';
import {SqliteStorage} from '../../gather/storage.ts';
import {YahooFinanceDataSource} from '../../gather/yahoo-finance.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {loadConfig} from '../../config/config.ts';
import {join} from 'node:path';
import defaults from '../../constants/defaults.json' with {type: 'json'};

/**
 * Portfolio command implementation
 * @param {string} configPath - Path to the configuration file
 * @param {object} options - Command options
 * @param {boolean} [options.addDefaults] - Add default symbols
 * @param {string} [options.add] - Symbols to add
 * @param {string} [options.remove] - Symbols to remove
 * @param {boolean} [options.list] - Show detailed list
 */
export async function portfolioCommand(configPath: string, options: {addDefaults?: boolean; add?: string; remove?: string; list?: boolean}): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Portfolio Management ==='));
	const startTime = Date.now();

	try {
		const config = loadConfig(configPath);
		const storage = new SqliteStorage();
		const dataSource = new YahooFinanceDataSource(config.api);
		const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));

		if (options.addDefaults) {
			const spinner = ora('Adding default symbols...').start();
			let addedCount = 0;
			for (const entry of defaults) {
				if (!storage.symbolExists(entry.symbol)) {
					storage.saveSymbol(entry.symbol, entry.name);
					addedCount++;
				}
			}
			spinner.succeed(`Added ${addedCount} new default symbols to the database`);
		}

		if (options.add) {
			const symbols = options.add.split(',').map((s) => s.trim().toUpperCase());
			for (const symbol of symbols) {
				const spinner = ora(`Adding symbol ${symbol}...`).start();

				if (storage.symbolExists(symbol)) {
					spinner.fail(`Symbol ${symbol} already exists in the database`);
					process.exit(1);
				}

				spinner.text = `Validating and fetching name for ${symbol}...`;
				const isValid = await dataSource.validateSymbol(symbol);
				if (!isValid) {
					spinner.fail(`Symbol ${symbol} is not a valid Yahoo Finance symbol`);
					process.exit(1);
				}

				const quote = await dataSource.getCurrentQuote(symbol);
				storage.saveSymbol(symbol, quote.name);
				spinner.succeed(`Added ${quote.name} (${symbol}) to the database`);
			}
		}

		if (options.remove) {
			const symbols = options.remove.split(',').map((s) => s.trim().toUpperCase());
			for (const symbol of symbols) {
				const spinner = ora(`Removing symbol ${symbol}...`).start();

				if (!storage.symbolExists(symbol)) {
					spinner.fail(`Symbol ${symbol} does not exist in the database`);
					process.exit(1);
				}

				storage.deleteSymbol(symbol);
				await modelPersistence.deleteModel(symbol);
				spinner.succeed(`Removed ${symbol} and all associated data/models`);
			}
		}

		if (options.list || (!options.addDefaults && !options.add && !options.remove)) {
			const symbols = storage.getAllSymbols();
			console.log(chalk.blue(`\n📊 Current Portfolio (${symbols.length} symbols):\n`));

			if (symbols.length === 0) {
				console.log(chalk.dim('  (No symbols in portfolio)'));
			} else {
				// Header
				const header = 'SYM'.padEnd(8) + 'NAME'.padEnd(35) + 'POINTS'.padEnd(10) + 'LAST DATE'.padEnd(15) + 'TRAINED AT'.padEnd(25) + 'LOSS';
				console.log(chalk.bold.dim(header));
				console.log(chalk.dim('─'.repeat(header.length)));

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

					console.log(`${symCol}${nameCol}${countCol}${dateCol}${trainedAtCol}${lossCol}`);
				}
			}
		}

		console.log(chalk.cyan(`\nProcess completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`));
	} catch (error) {
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		} else {
			console.error(chalk.red('Unknown error occurred during portfolio management'));
		}
		process.exit(1);
	}
}
