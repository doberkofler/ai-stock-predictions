/**
 * Train command - Optimizes LSTM models for the specified portfolio
 */

import chalk from 'chalk';
import {join} from 'node:path';
import {SqliteStorage} from '../../gather/storage.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {LstmModel} from '../../compute/lstm-model.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {ui} from '../utils/ui.ts';
import {runCommand} from '../utils/runner.ts';

/**
 * Train command implementation
 * Trains models from scratch for all symbols in the database or specified list
 * @param {string} configPath - Path to the configuration file
 * @param {boolean} [quickTest] - Run with limited symbols and data for verification
 * @param {string} [symbolList] - Comma-separated list of symbols to train
 */
export async function trainCommand(configPath: string, quickTest = false, symbolList?: string): Promise<void> {
	await runCommand(
		{
			title: 'Model Training',
			description: 'Optimizing TensorFlow.js LSTM neural networks for the specified portfolio.',
			configPath,
		},
		async ({config}) => {
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
						ui.error(chalk.red(`\n❌ Error: Symbol '${sym}' has no gathered data. Run 'gather' first.`));
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
				ui.log(chalk.yellow('No stock data found in database.'));
				ui.log(chalk.yellow('\n💡 Suggestion: Run "ai-stock-predictions gather" first to fetch market data.'));
				return;
			}

			if (quickTest) {
				symbolsToProcess = symbolsToProcess.slice(0, 3);
				ui.log(chalk.yellow(`⚠️  Quick test mode active: Processing only the first ${symbolsToProcess.length} symbols and 50 data points`));
			}

			const tf = await import('@tensorflow/tfjs');
			ui.log(chalk.dim(`TensorFlow.js backend: ${tf.getBackend()}`));

			ui.log(chalk.blue(`\n🧠 Training models for ${symbolsToProcess.length} symbols`));

			// Process each symbol
			for (let i = 0; i < symbolsToProcess.length; i++) {
				const symbolEntry = symbolsToProcess[i];
				if (!symbolEntry) continue;
				const {symbol, name} = symbolEntry;

				const prefix = chalk.dim(`[${i + 1}/${symbolsToProcess.length}]`);
				const symbolSpinner = ui.spinner(`${prefix} Processing ${name} (${symbol})`).start();

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
						ui.error(chalk.red(`  Error: ${error.message}`));
					}
				}
			}

			// Display summary
			const summary = progress.getSummary();
			ui.log('\n' + chalk.bold('🧠 Training Summary:'));
			ui.log(chalk.green(`  ✅ Trained: ${summary.trained ?? 0}`));
			ui.log(chalk.yellow(`  ⚠️  Poor Performance: ${summary['poor-performance'] ?? 0}`));
			ui.log(chalk.red(`  ❌ Errors: ${summary.error ?? 0}`));
			ui.log(chalk.dim(`  📊 Total symbols processed: ${symbolsToProcess.length}`));

			ui.log('\n' + chalk.green('✅ Model training complete!'));
			ui.log(chalk.cyan('Next: Run "ai-stock-predictions predict" to generate forecasts.'));
		},
		{},
	);
}
