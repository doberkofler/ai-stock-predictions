/**
 * Predict command - Generates predictions and creates HTML reports
 */

import type {Ora} from 'ora';

import chalk from 'chalk';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

import type {Config} from '../../config/schema.ts';
import type {ReportPrediction} from '../../types/index.ts';
import type {MockOra} from '../utils/ui.ts';

import {BacktestEngine} from '../../compute/backtest/engine.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {PredictionEngine} from '../../compute/prediction.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {HtmlGenerator} from '../../output/html-generator.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Predict command implementation
 * @param configPath - Path to the configuration file
 * @param quickTest - Whether to run with limited symbols and forecast window
 * @param symbolList - Optional list of symbols to predict
 */
export async function predictCommand(configPath: string, quickTest = false, symbolList?: string): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Generating multi-day trend forecasts and rendering the interactive HTML report.',
			nextSteps: ['Open the generated HTML report in your browser to view predictions:', chalk.cyan(`  file://${join(process.cwd(), 'output', 'index.html')}`)],
			title: 'Price Estimation',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage();
			const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
			const predictionEngine = new PredictionEngine();
			const backtestEngine = new BacktestEngine(config, predictionEngine);
			const progress = new ProgressTracker();

			// 1. Determine symbols to process
			const symbolsToProcess = await getSymbolsToProcess(storage, modelPersistence, symbolList, quickTest);
			if (symbolsToProcess.length === 0) {
				ui.log(chalk.yellow('No trained models found. Please run "train" first.'));
				return;
			}

			// 2. Prepare effective configuration
			const effectiveConfig = quickTest
				? {
						...config,
						prediction: {
							...config.prediction,
							days: 5,
							uncertaintyIterations: 5,
						},
					}
				: config;

			ui.log(chalk.blue(`\n🔮 Generating predictions for ${symbolsToProcess.length} symbols`));
			ui.log(chalk.dim(`Prediction window: ${effectiveConfig.prediction.days} days`));

			// 3. Generate predictions
			const predictions = await generatePredictions(
				symbolsToProcess,
				storage,
				modelPersistence,
				predictionEngine,
				backtestEngine,
				progress,
				effectiveConfig,
				quickTest,
			);

			// 4. Generate HTML report
			if (predictions.length > 0) {
				await generateReport(predictions, effectiveConfig, storage);
			}

			// 5. Display summary
			displaySummary(progress, symbolsToProcess.length);
		},
		{},
	);
}

/**
 * Display final prediction summary
 * @param progress
 * @param total
 */
function displaySummary(progress: ProgressTracker, total: number): void {
	const summary = progress.getSummary();
	const predicted = summary.predicted ?? 0;
	const error = summary.error ?? 0;

	ui.log('\n' + chalk.bold('🔮 Prediction Summary:'));
	ui.log(chalk.green(`  ✅ Predicted: ${predicted}`));
	ui.log(chalk.red(`  ❌ Errors: ${error}`));
	ui.log(chalk.dim(`  📊 Total symbols processed: ${total}`));
	ui.log('\n' + chalk.green('✅ Prediction complete!'));
}

/**
 * Loop through symbols and generate prediction results
 * @param symbols
 * @param storage
 * @param modelPersistence
 * @param predictionEngine
 * @param backtestEngine
 * @param progress
 * @param config
 * @param quickTest
 * @returns Array of report predictions
 */
async function generatePredictions(
	symbols: {name: string; symbol: string}[],
	storage: SqliteStorage,
	modelPersistence: ModelPersistence,
	predictionEngine: PredictionEngine,
	backtestEngine: BacktestEngine,
	progress: ProgressTracker,
	config: Config,
	quickTest = false,
): Promise<ReportPrediction[]> {
	const predictions: ReportPrediction[] = [];

	for (const [i, entry] of symbols.entries()) {
		const {name, symbol} = entry;
		const prefix = chalk.dim(`[${i + 1}/${symbols.length}]`);
		const symbolSpinner = ui.spinner(`${prefix} Predicting ${name} (${symbol})`).start();

		try {
			const result = await predictSymbol(symbol, name, storage, modelPersistence, predictionEngine, backtestEngine, config, prefix, symbolSpinner, quickTest);
			if (result) {
				predictions.push(result);
				progress.complete(symbol, 'predicted', result.confidence);
			} else {
				progress.complete(symbol, 'error');
			}
		} catch (error) {
			symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗`);
			progress.complete(symbol, 'error');
			if (error instanceof Error) ui.error(chalk.red(`  Error: ${error.message}`));
		}
	}

	return predictions;
}

/**
 * Orchestrate HTML report generation
 * @param predictions
 * @param config
 * @param storage
 */
async function generateReport(predictions: ReportPrediction[], config: Config, storage: SqliteStorage): Promise<void> {
	const htmlSpinner = ui.spinner('Generating HTML report...').start();
	try {
		const htmlGenerator = new HtmlGenerator(config.prediction, storage);

		await mkdir(config.prediction.directory, {recursive: true});
		const reportPath = await htmlGenerator.generateReport(predictions, config);
		htmlSpinner.succeed('HTML report generated');
		ui.log(chalk.green(`\n📄 Report saved to: ${reportPath}`));
	} catch (error) {
		htmlSpinner.fail('HTML report generation failed');
		if (error instanceof Error) ui.error(chalk.red(`Error: ${error.message}`));
	}
}

/**
 * Get the list of symbols to process based on availability and user request
 * @param storage
 * @param modelPersistence
 * @param symbolList
 * @param quickTest
 * @returns Symbols to process
 */
async function getSymbolsToProcess(
	storage: SqliteStorage,
	modelPersistence: ModelPersistence,
	symbolList?: string,
	quickTest = false,
): Promise<{name: string; symbol: string}[]> {
	const availableSymbolsInDb = await storage.getAvailableSymbols();
	let symbols: {name: string; symbol: string}[] = [];

	if (symbolList) {
		const requestedSymbols = symbolList.split(',').map((s) => s.trim().toUpperCase());
		for (const sym of requestedSymbols) {
			if (!modelPersistence.modelExists(sym)) {
				ui.error(chalk.red(`\n❌ Error: No trained model found for '${sym}'. Run 'train' first.`));
				process.exit(1);
			}
			if (!availableSymbolsInDb.includes(sym)) {
				ui.error(chalk.red(`\n❌ Error: Symbol '${sym}' has no gathered data. Run 'sync' first.`));
				process.exit(1);
			}
			const name = storage.getSymbolName(sym) ?? sym;
			symbols.push({name, symbol: sym});
		}
	} else {
		for (const sym of availableSymbolsInDb) {
			if (modelPersistence.modelExists(sym)) {
				const name = storage.getSymbolName(sym) ?? sym;
				symbols.push({name, symbol: sym});
			}
		}
	}

	if (quickTest) {
		symbols = symbols.slice(0, 3);
		ui.log(chalk.yellow(`⚠️ Quick test mode active: Processing 3 symbols, 500 data points, 5-day forecast`));
		ui.log(chalk.yellow(`   Optimizations: 5 Monte Carlo iterations, backtesting disabled`));
	}

	return symbols;
}

/**
 * Generate prediction for a single symbol
 * @param symbol
 * @param name
 * @param storage
 * @param modelPersistence
 * @param predictionEngine
 * @param backtestEngine
 * @param config
 * @param prefix
 * @param spinner
 * @param quickTest
 * @returns Prediction result or null
 */
async function predictSymbol(
	symbol: string,
	name: string,
	storage: SqliteStorage,
	modelPersistence: ModelPersistence,
	predictionEngine: PredictionEngine,
	backtestEngine: BacktestEngine,
	config: Config,
	prefix: string,
	spinner: MockOra | Ora,
	quickTest = false,
): Promise<null | ReportPrediction> {
	spinner.text = `${prefix} Loading model for ${name} (${symbol})...`;
	const stockDataFull = await storage.getStockData(symbol);
	const model = await modelPersistence.loadModel(symbol, config);

	if (!stockDataFull || stockDataFull.length < config.model.windowSize) {
		spinner.fail(`${prefix} ${name} (${symbol}) ✗ (insufficient data)`);
		return null;
	}

	if (!model) {
		spinner.fail(`${prefix} ${name} (${symbol}) ✗ (no model found)`);
		return null;
	}

	const stockData = quickTest ? stockDataFull.slice(-500) : stockDataFull;

	spinner.text = `${prefix} Fetching market context for ${name} (${symbol})...`;
	const marketFeatures = config.market.featureConfig.enabled ? (storage.getMarketFeatures(symbol) ?? []) : [];

	spinner.text = `${prefix} Predicting future price for ${name} (${symbol})...`;
	const prediction = await predictionEngine.predict(model, stockData, config, marketFeatures);
	const signal = predictionEngine.generateSignal(prediction, config.prediction);

	let backtest;
	if (config.backtest.enabled && !quickTest) {
		const backtestStartTime = Date.now();
		const backtestDays = 126;
		const progress = new ProgressTracker();

		spinner.text = `${prefix} Starting walk-forward backtest (${backtestDays} days)...`;

		backtest = await backtestEngine.run(symbol, model, stockData, marketFeatures, backtestDays, (current, total) => {
			const bar = progress.createProgressBar(total, current, `Backtesting ${name} (${symbol})`);
			const eta = ProgressTracker.calculateEta(backtestStartTime, current, total);
			spinner.text = `${prefix} ${bar} (ETA: ${eta})`;
		});
	}

	let signalEmoji = '➡️';
	if (signal.action === 'BUY') {
		signalEmoji = '📈';
	} else if (signal.action === 'SELL') {
		signalEmoji = '📉';
	}

	spinner.succeed(`${prefix} ${name} (${symbol}) ${signalEmoji} ${signal.action} (${(signal.confidence * 100).toFixed(0)}%)`);

	return {
		backtest,
		confidence: signal.confidence,
		name,
		prediction,
		signal: signal.action,
		symbol,
	};
}
