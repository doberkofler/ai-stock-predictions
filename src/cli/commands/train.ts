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
 * Trains models from scratch for all configured symbols
 * @param {string} configPath - Path to the configuration file
 * @param {boolean} [quickTest] - Run with limited symbols and data for verification
 */
export async function trainCommand(configPath: string, quickTest = false): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Model Training ==='));
	console.log(chalk.dim('Optimizing TensorFlow.js LSTM neural networks for the specified portfolio.\n'));
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
		const storage = new SqliteStorage();
		const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
		const progress = new ProgressTracker();

		let symbolsToProcess = config.symbols;
		if (quickTest) {
			symbolsToProcess = symbolsToProcess.slice(0, 3);
			console.log(chalk.yellow('⚠️  Quick test mode active: Processing only the first 3 symbols and 50 data points'));
		}

		console.log(chalk.blue(`\n🧠 Training models for ${symbolsToProcess.length} symbols`));

		// Process each symbol
		for (let i = 0; i < symbolsToProcess.length; i++) {
			const symbolEntry = symbolsToProcess[i];
			if (!symbolEntry) continue;
			const {symbol, name} = symbolEntry;

			const symbolSpinner = ora(`Processing ${name} (${symbol}) (${i + 1}/${symbolsToProcess.length})`).start();

			try {
				// Check if data exists
				let stockData = await storage.getStockData(symbol);
				if (!stockData || stockData.length < config.ml.windowSize) {
					symbolSpinner.fail(`${name} (${symbol}) ✗ (insufficient data)`);
					progress.complete(symbol, 'error');
					continue;
				}

				if (quickTest) {
					stockData = stockData.slice(-50);
				}

				// Always create a fresh model
				symbolSpinner.text = `Creating fresh ${name} (${symbol}) model...`;
				const model = new LstmModel(config.ml);

				// Train model
				const trainingStartTime = Date.now();
				const trainingProgress = (epoch: number, loss: number) => {
					const bar = progress.createProgressBar(config.ml.epochs, epoch, `Training ${name} (${symbol})`);
					const eta = ProgressTracker.calculateEta(trainingStartTime, epoch, config.ml.epochs);
					symbolSpinner.text = `${bar} (Loss: ${loss.toFixed(6)}, ETA: ${eta})`;
				};

				await model.train(stockData, config, trainingProgress);

				// Validate and save model
				symbolSpinner.text = `Validating ${name} (${symbol}) model...`;
				const performance = await model.evaluate(stockData, config);

				if (performance.isValid || quickTest) {
					await modelPersistence.saveModel(symbol, model, {
						...performance,
						dataPoints: stockData.length,
						modelType: config.ml.modelType,
						windowSize: config.ml.windowSize,
					});
					const perfMsg = performance.isValid ? `(Loss: ${performance.loss.toFixed(6)})` : `(Loss: ${performance.loss.toFixed(6)} - Forced save)`;
					symbolSpinner.succeed(`${name} (${symbol}) ${perfMsg}`);
					progress.complete(symbol, 'trained', performance.loss);
				} else {
					symbolSpinner.warn(`${name} (${symbol}) ⚠️ (Poor performance, model not saved)`);
					progress.complete(symbol, 'poor-performance');
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
		spinner.fail('Training failed');
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		} else {
			console.error(chalk.red('Unknown error occurred during training'));
		}
		process.exit(1);
	}
}
