/**
 * Train command - Optimizes LSTM models for the specified portfolio
 */

import type {Ora} from 'ora';

import chalk from 'chalk';
import {join} from 'node:path';

import type {Config} from '../../config/schema.ts';
import type {MockOra} from '../utils/ui.ts';

import {LstmModel} from '../../compute/lstm-model.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Train command implementation
 * @param configPath - Path to the configuration file
 * @param quickTest - Whether to run with limited data and epochs
 * @param symbolList - Optional list of symbols to train
 */
export async function trainCommand(configPath: string, quickTest = false, symbolList?: string): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Optimizing TensorFlow.js LSTM neural networks for the specified portfolio.',
			title: 'Model Training',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage();
			const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
			const progress = new ProgressTracker();

			// 1. Determine symbols to process
			const symbolsToProcess = await getSymbolsToProcess(storage, symbolList, quickTest);
			if (symbolsToProcess.length === 0) {
				ui.log(chalk.yellow('No stock data found in database.'));
				ui.log(chalk.yellow('\n💡 Suggestion: Run "ai-stock-predictions sync" first to fetch market data.'));
				return;
			}

			// 2. Prepare effective configuration
			const effectiveConfig = quickTest
				? {
						...config,
						model: {
							...config.model,
							epochs: 5,
						},
					}
				: config;

			// 3. Log backend info
			const tf = await import('@tensorflow/tfjs');
			ui.log(chalk.dim(`TensorFlow.js backend: ${tf.getBackend()}`));
			ui.log(chalk.blue(`\n🧠 Training models for ${symbolsToProcess.length} symbols`));

			// 4. Run training loop
			await executeTraining(symbolsToProcess, storage, modelPersistence, progress, effectiveConfig, quickTest);

			// 5. Display summary
			displaySummary(progress, symbolsToProcess.length);
		},
		{},
	);
}

/**
 * Display final training summary
 * @param progress
 * @param total
 */
function displaySummary(progress: ProgressTracker, total: number): void {
	const summary = progress.getSummary();
	const trained = summary.trained ?? 0;
	const poorPerf = summary['poor-performance'] ?? 0;
	const error = summary.error ?? 0;

	ui.log('\n' + chalk.bold('🧠 Training Summary:'));
	ui.log(chalk.green(`  ✅ Trained: ${trained}`));
	ui.log(chalk.yellow(`  ⚠️  Poor Performance: ${poorPerf}`));
	ui.log(chalk.red(`  ❌ Errors: ${error}`));
	ui.log(chalk.dim(`  📊 Total symbols processed: ${total}`));
	ui.log('\n' + chalk.green('✅ Model training complete!'));
}

/**
 * Core training execution loop
 * @param symbols
 * @param storage
 * @param modelPersistence
 * @param progress
 * @param config
 * @param quickTest
 */
async function executeTraining(
	symbols: {name: string; symbol: string}[],
	storage: SqliteStorage,
	modelPersistence: ModelPersistence,
	progress: ProgressTracker,
	config: Config,
	quickTest: boolean,
): Promise<void> {
	for (const [i, entry] of symbols.entries()) {
		const {name, symbol} = entry;
		const prefix = chalk.dim(`[${i + 1}/${symbols.length}]`);
		const symbolSpinner = ui.spinner(`${prefix} Processing ${name} (${symbol})`).start();

		try {
			await trainSingleSymbol(symbol, name, storage, modelPersistence, progress, config, quickTest, prefix, symbolSpinner);
		} catch (error) {
			symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗`);
			progress.complete(symbol, 'error');
			if (error instanceof Error) ui.error(chalk.red(`  Error: ${error.message}`));
		}
	}
}

/**
 * Filter and determine which symbols are available for training
 * @param storage
 * @param symbolList
 * @param quickTest
 * @returns Symbols to process
 */
async function getSymbolsToProcess(storage: SqliteStorage, symbolList?: string, quickTest = false): Promise<{name: string; symbol: string}[]> {
	const availableSymbols = await storage.getAvailableSymbols();
	let symbols: {name: string; symbol: string}[] = [];

	if (symbolList) {
		const requestedSymbols = symbolList.split(',').map((s) => s.trim().toUpperCase());
		for (const sym of requestedSymbols) {
			if (!availableSymbols.includes(sym)) {
				ui.error(chalk.red(`\n❌ Error: Symbol '${sym}' has no gathered data. Run 'sync' first.`));
				process.exit(1);
			}
			const name = storage.getSymbolName(sym) ?? sym;
			symbols.push({name, symbol: sym});
		}
	} else {
		for (const sym of availableSymbols) {
			const name = storage.getSymbolName(sym) ?? sym;
			symbols.push({name, symbol: sym});
		}
	}

	if (quickTest) {
		symbols = symbols.slice(0, 3);
		ui.log(chalk.yellow(`⚠️ Quick test mode active: Processing 3 symbols, 1000 data points, and 5 epochs`));
	}

	return symbols;
}

/**
 * Logic for training a single symbol
 * @param symbol
 * @param name
 * @param storage
 * @param modelPersistence
 * @param progress
 * @param config
 * @param quickTest
 * @param prefix
 * @param spinner
 */
async function trainSingleSymbol(
	symbol: string,
	name: string,
	storage: SqliteStorage,
	modelPersistence: ModelPersistence,
	progress: ProgressTracker,
	config: Config,
	quickTest: boolean,
	prefix: string,
	spinner: MockOra | Ora,
): Promise<void> {
	let stockData = await storage.getStockData(symbol);
	if (!stockData || stockData.length < config.model.windowSize) {
		spinner.fail(`${prefix} ${name} (${symbol}) ✗ (insufficient data)`);
		progress.complete(symbol, 'error');
		return;
	}

	if (quickTest) {
		stockData = stockData.slice(-1000);
	}

	spinner.text = `${prefix} Creating fresh ${name} (${symbol}) model...`;
	const model = new LstmModel(config.model);

	const trainingStartTime = Date.now();
	const dataPointCount = stockData.length;
	const trainingProgress = (epoch: number, loss: number): void => {
		const bar = progress.createProgressBar(config.model.epochs, epoch, `Training ${name} (${symbol})`);
		const eta = ProgressTracker.calculateEta(trainingStartTime, epoch, config.model.epochs);
		spinner.text = `${prefix} ${bar} [${dataPointCount} pts] (Loss: ${loss.toFixed(6)}, ETA: ${eta})`;
	};

	await model.train(stockData, config, trainingProgress);

	spinner.text = `${prefix} Validating ${name} (${symbol}) model...`;
	const performance = await model.evaluate(stockData, config);

	if (performance.isValid || quickTest) {
		await modelPersistence.saveModel(symbol, model, {
			...performance,
			dataPoints: stockData.length,
			windowSize: config.model.windowSize,
		});
		const perfMsg = performance.isValid ? `(Loss: ${performance.loss.toFixed(6)})` : `(Loss: ${performance.loss.toFixed(6)} - Forced save)`;
		spinner.succeed(`${prefix} ${name} (${symbol}) ${perfMsg}`);
		progress.complete(symbol, 'trained', performance.loss);
	} else {
		spinner.warn(`${prefix} ${name} (${symbol}) ⚠️ (Poor performance, model not saved)`);
		progress.complete(symbol, 'poor-performance');
	}
}
