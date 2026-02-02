/**
 * Train command - Trains models from scratch using all available data
 * Implements fresh training logic and model validation
 */

import chalk from 'chalk';
import ora from 'ora';
import {loadConfig} from '../../config/config.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {LstmModel} from '../../compute/lstm-model.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {join} from 'node:path';

/**
 * Train command implementation
 * Trains models from scratch for all symbols in the database or specified list
 * @param {string} configPath - Path to the configuration file
 * @param {boolean} [quickTest] - Run with limited symbols and data for verification
 * @param {string} [symbolList] - Comma-separated list of symbols to train
 */
export async function trainCommand(configPath: string, quickTest = false, symbolList?: string): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Model Training ==='));
	console.log(chalk.dim('Optimizing TensorFlow.js LSTM neural networks for the specified portfolio.\n'));
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
		const storage = new SqliteStorage();
		const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
		const progress = new ProgressTracker();

		// Data-aware filtering: Only process symbols that have data in the database
		const availableSymbols = await storage.getAvailableSymbols();

		let symbolsToProcess: {symbol: string; name: string}[] = [];

		if (symbolList) {
			const requestedSymbols = symbolList.split(',').map((s) => s.trim().toUpperCase());
			for (const sym of requestedSymbols) {
				if (!availableSymbols.includes(sym)) {
					console.error(chalk.red(`\n❌ Error: Symbol '${sym}' has no gathered data. Run 'gather' first.`));
					process.exit(1);
				}
				const name = storage.getSymbolName(sym) ?? sym;
				symbolsToProcess.push({symbol: sym, name});
			}
		} else {
			for (const sym of availableSymbols) {
				const name = storage.getSymbolName(sym) ?? sym;
				symbolsToProcess.push({symbol: sym, name});
			}
		}

		if (symbolsToProcess.length === 0) {
			console.log(chalk.yellow('No stock data found in database.'));
			console.log(chalk.yellow('\n💡 Suggestion: Run "ai-stock-predictions gather" first to fetch market data.'));
			return;
		}

		if (quickTest) {
			symbolsToProcess = symbolsToProcess.slice(0, 0 + 3);
			console.log(chalk.yellow(`⚠️  Quick test mode active: Processing only the first ${symbolsToProcess.length} symbols and 50 data points`));
		}

		console.log(chalk.blue(`\n🧠 Training models for ${symbolsToProcess.length} symbols`));

		// Process each symbol
		for (let i = 0; i < symbolsToProcess.length; i++) {
			const symbolEntry = symbolsToProcess[i];
			if (!symbolEntry) continue;
			const {symbol, name} = symbolEntry;

			const prefix = chalk.dim(`[${i + 1}/${symbolsToProcess.length}]`);
			const symbolSpinner = ora(`${prefix} Processing ${name} (${symbol})`).start();

			try {
				// Check if data exists
				let stockData = await storage.getStockData(symbol);
				if (!stockData || stockData.length < config.ml.windowSize) {
					symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗ (insufficient data)`);
					progress.complete(symbol, 'error');
					continue;
				}

				if (quickTest) {
					stockData = stockData.slice(-50);
				}

				// Always create a fresh model
				symbolSpinner.text = `${prefix} Creating fresh ${name} (${symbol}) model...`;
				const model = new LstmModel(config.ml);

				// Train model
				const trainingStartTime = Date.now();
				const dataPointCount = stockData.length;
				const trainingProgress = (epoch: number, loss: number) => {
					const bar = progress.createProgressBar(config.ml.epochs, epoch, `Training ${name} (${symbol})`);
					const eta = ProgressTracker.calculateEta(trainingStartTime, epoch, config.ml.epochs);
					symbolSpinner.text = `${prefix} ${bar} [${dataPointCount} pts] (Loss: ${loss.toFixed(6)}, ETA: ${eta})`;
				};

				await model.train(stockData, config, trainingProgress);

				// Validate and save model
				symbolSpinner.text = `${prefix} Validating ${name} (${symbol}) model...`;
				const performance = await model.evaluate(stockData, config);

				if (performance.isValid || quickTest) {
					await modelPersistence.saveModel(symbol, model, {
						...performance,
						dataPoints: stockData.length,
						modelType: config.ml.modelType,
						windowSize: config.ml.windowSize,
					});
					const perfMsg = performance.isValid ? `(Loss: ${performance.loss.toFixed(6)})` : `(Loss: ${performance.loss.toFixed(6)} - Forced save)`;
					symbolSpinner.succeed(`${prefix} ${name} (${symbol}) ${perfMsg}`);
					progress.complete(symbol, 'trained', performance.loss);
				} else {
					symbolSpinner.warn(`${prefix} ${name} (${symbol}) ⚠️ (Poor performance, model not saved)`);
					progress.complete(symbol, 'poor-performance');
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
		console.log('\n' + chalk.bold('🎯 Training Summary:'));
		console.log(chalk.green(`  ✅ Trained: ${summary.trained ?? 0}`));
		console.log(chalk.yellow(`  ⚠️  Poor performance: ${summary['poor-performance'] ?? 0}`));
		console.log(chalk.red(`  ❌ Errors: ${summary.error ?? 0}`));
		console.log(chalk.dim(`  📊 Total symbols processed: ${symbolsToProcess.length}`));

		if ((summary.error ?? 0) > 0 || (summary['poor-performance'] ?? 0) > 0) {
			console.log('\n' + chalk.yellow('⚠️  Some models had issues. Check details above.'));
		}

		console.log('\n' + chalk.green('✅ Training complete!'));
		console.log(chalk.cyan(`Process completed in ${ProgressTracker.formatDuration(Date.now() - startTime)}.`));
		console.log(chalk.cyan('Next: Run "ai-stock-predictions predict" to generate predictions.'));
	} catch (error) {
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		} else {
			console.error(chalk.red('Unknown error occurred during training'));
		}
		process.exit(1);
	}
}
