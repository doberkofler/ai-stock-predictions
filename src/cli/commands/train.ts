/**
 * Train command - Trains models incrementally or from scratch
 * Implements incremental training logic and model validation/comparison
 */

import chalk from 'chalk';
import ora from 'ora';
import {loadConfig} from '../../config/config.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {LstmModel} from '../../compute/lstm-model.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {ProgressTracker} from '../utils/progress.ts';
import type {StockDataPoint} from '../../types/index.ts';
import type {Config} from '../../config/schema.ts';
import {join} from 'node:path';

/**
 * Train command implementation
 * Trains models incrementally for all configured symbols
 * @param {string} configPath - Path to the configuration file
 * @param {boolean} [quickTest] - Run with limited symbols and data for verification
 * @param {boolean} [init] - If true, trains a new model from scratch and compares with existing
 */
export async function trainCommand(configPath: string, quickTest = false, init = false): Promise<void> {
	console.log(chalk.bold.blue('\n--- Training ML Models ---'));
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

		if (init) {
			console.log(chalk.blue('\n🔄 Training from scratch mode active (--init)'));
			console.log(chalk.dim('Existing models will be compared and replaced only if performance improves.'));
		}

		console.log(chalk.blue(`\n🧠 Training models for ${symbolsToProcess.length} symbols`));
		if (!init) {
			console.log(chalk.dim(`Incremental training: ${config.training.incremental ? 'Enabled' : 'Disabled'}`));
			console.log(chalk.dim(`Minimum new data points: ${config.training.minNewDataPoints}`));
		}

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

				// Load existing model for either incremental training or comparison
				const existingModel = await modelPersistence.loadModel(symbol, config);
				let model: LstmModel;
				let existingPerformance = null;

				if (init) {
					// Mode: Train from scratch and compare
					symbolSpinner.text = `Evaluating existing ${name} (${symbol}) model...`;
					existingPerformance = existingModel ? await existingModel.evaluate(stockData, config) : null;

					symbolSpinner.text = `Creating fresh ${name} (${symbol}) model...`;
					model = new LstmModel(config.ml);
				} else {
					// Mode: Incremental training
					const shouldIncrementalTrain = config.training.incremental && existingModel && (await shouldTrainIncrementally(storage, symbol, config));

					if (!shouldIncrementalTrain && existingModel && !quickTest) {
						symbolSpinner.info(`${name} (${symbol}) (no new data for incremental training)`);
						progress.complete(symbol, 'no-new-data');
						continue;
					}

					model = existingModel ?? new LstmModel(config.ml);
				}

				// Train model
				const trainingStartTime = Date.now();
				const trainingProgress = (epoch: number, loss: number) => {
					const bar = progress.createProgressBar(config.ml.epochs, epoch, `${init ? 'Retraining' : 'Training'} ${name} (${symbol})`);
					const eta = ProgressTracker.calculateEta(trainingStartTime, epoch, config.ml.epochs);
					symbolSpinner.text = `${bar} (Loss: ${loss.toFixed(6)}, ETA: ${eta})`;
				};

				await model.train(stockData, config, trainingProgress);

				// Validate and save model
				symbolSpinner.text = `Validating ${name} (${symbol}) model...`;
				const performance = await model.evaluate(stockData, config);

				if (performance.isValid || quickTest) {
					let shouldSave = true;
					let improvement = '';

					if (init && existingPerformance && !quickTest) {
						// Only replace if new model is significantly better (5% threshold)
						shouldSave = performance.loss < existingPerformance.loss * 0.95;
						if (shouldSave) {
							improvement = ` (${((1 - performance.loss / existingPerformance.loss) * 100).toFixed(1)}% improvement)`;
						}
					}

					if (shouldSave) {
						await modelPersistence.saveModel(symbol, model, {
							...performance,
							dataPoints: stockData.length,
							modelType: config.ml.modelType,
							windowSize: config.ml.windowSize,
						});
						const perfMsg = performance.isValid ? `(Loss: ${performance.loss.toFixed(6)})` : `(Loss: ${performance.loss.toFixed(6)} - Forced save)`;
						symbolSpinner.succeed(`${name} (${symbol})${improvement} ${perfMsg}`);
						progress.complete(symbol, init ? 'retrained' : 'trained', performance.loss);
					} else {
						symbolSpinner.warn(`${name} (${symbol}) (No significant improvement, keeping existing)`);
						progress.complete(symbol, 'no-improvement');
					}
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
		console.log(chalk.green(`  ✅ Trained: ${(summary.trained ?? 0) + (summary.retrained ?? 0)}`));
		console.log(chalk.blue(`  ℹ️  No new data: ${summary['no-new-data'] ?? 0}`));
		console.log(chalk.blue(`  ↔️  No improvement: ${summary['no-improvement'] ?? 0}`));
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

/**
 * Determine if incremental training should be performed
 * @param {SqliteStorage} storage - Data storage instance
 * @param {string} symbol - Stock symbol
 * @param {Config} config - Configuration object
 * @returns {Promise<boolean>} True if incremental training should be performed
 */
async function shouldTrainIncrementally(storage: SqliteStorage, symbol: string, config: Config): Promise<boolean> {
	try {
		const modelMetadata = await storage.getModelMetadata(symbol);
		if (!modelMetadata) {
			return false;
		}

		// Check if enough new data points exist
		const stockData = await storage.getStockData(symbol);
		if (!stockData) return false;
		const lastTrainingDate = new Date(modelMetadata.trainedAt);
		const newDataPoints = stockData.filter((data: StockDataPoint) => new Date(data.date) > lastTrainingDate).length;

		return newDataPoints >= config.training.minNewDataPoints;
	} catch {
		return false;
	}
}
