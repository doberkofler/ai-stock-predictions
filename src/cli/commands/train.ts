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
import {DateUtils} from '../utils/date.ts';
import {calculateDataHash} from '../utils/hash.ts';
import {InterruptHandler} from '../utils/interrupt.ts';
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
			nextSteps: ['Run: {cli} predict to generate price forecasts'],
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
 * Apply quick test limit to symbols
 * @param symbols
 * @param quickTest
 */
function applyQuickTestLimit(symbols: {name: string; symbol: string}[], quickTest: boolean): {name: string; symbol: string}[] {
	if (!quickTest) {
		return symbols;
	}

	const maxSymbols = Math.min(3, symbols.length);
	const limitedSymbols = symbols.slice(0, maxSymbols);
	ui.log(chalk.yellow(`⚠️ Quick test mode active: Processing ${maxSymbols} ${maxSymbols === 1 ? 'symbol' : 'symbols'}, 500 data points, and 5 epochs`));

	return limitedSymbols;
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
	ui.log(chalk.yellow(`  ⚠️  Skipped (Quality): ${summary['low-quality'] ?? 0}`));
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
		// Check for interrupt before processing each symbol
		InterruptHandler.throwIfInterrupted();

		const {name, symbol} = entry;
		const prefix = chalk.dim(`[${i + 1}/${symbols.length}]`);
		const symbolSpinner = ui.spinner(`${prefix} Processing ${name} (${symbol})`).start();

		// Register spinner for cleanup on interrupt to prevent it from overwriting the interrupt message
		// eslint-disable-next-line unicorn/consistent-function-scoping -- Justification: Cleanup function requires access to symbolSpinner instance which is created within the loop.
		const cleanup = (): void => {
			symbolSpinner.stop();
		};
		InterruptHandler.registerCleanup(cleanup);

		try {
			await trainSingleSymbol(symbol, name, storage, modelPersistence, progress, config, quickTest, prefix, symbolSpinner);
		} catch (error) {
			symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗`);
			progress.complete(symbol, 'error');
			if (error instanceof Error) ui.error(chalk.red(`  Error: ${error.message}`));
		} finally {
			// Remove this specific cleanup handler if we finished normally
			InterruptHandler.unregisterCleanup(cleanup);
		}
	}
}

/**
 * Filter symbols into indices and stocks
 * @param symbols
 */
function filterSymbolsByType(symbols: {name: string; symbol: string}[]): {indices: {name: string; symbol: string}[]; stocks: {name: string; symbol: string}[]} {
	const indices = symbols.filter((s) => s.symbol.startsWith('^'));
	const stocks = symbols.filter((s) => !s.symbol.startsWith('^'));

	return {indices, stocks};
}

/**
 * Get all available symbols from storage
 * @param availableSymbols
 * @param storage
 */
function getAllAvailableSymbols(availableSymbols: string[], storage: SqliteStorage): {name: string; symbol: string}[] {
	const symbols: {name: string; symbol: string}[] = [];

	for (const sym of availableSymbols) {
		const name = storage.getSymbolName(sym) ?? sym;
		symbols.push({name, symbol: sym});
	}

	return symbols;
}

/**
 * Get requested symbols from comma-separated list
 * @param symbolList
 * @param availableSymbols
 * @param storage
 */
function getRequestedSymbols(symbolList: string, availableSymbols: string[], storage: SqliteStorage): {name: string; symbol: string}[] {
	const requestedSymbols = symbolList.split(',').map((s) => s.trim().toUpperCase());
	const symbols: {name: string; symbol: string}[] = [];

	for (const sym of requestedSymbols) {
		if (!availableSymbols.includes(sym)) {
			ui.error(chalk.red(`\n❌ Error: Symbol '${sym}' has no gathered data. Run 'sync' first.`));
			process.exit(1);
		}
		const name = storage.getSymbolName(sym) ?? sym;
		symbols.push({name, symbol: sym});
	}

	return symbols;
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
	const symbols = symbolList ? getRequestedSymbols(symbolList, availableSymbols, storage) : getAllAvailableSymbols(availableSymbols, storage);

	// Filter out indices (used for market context only, not for prediction)
	const {indices, stocks} = filterSymbolsByType(symbols);

	if (indices.length > 0 && symbolList) {
		logSkippedIndices(indices);
	}

	if (stocks.length === 0) {
		logNoStocksAvailable();
		return [];
	}

	return applyQuickTestLimit(stocks, quickTest);
}

/**
 * Log no stocks available message
 */
function logNoStocksAvailable(): void {
	ui.log(chalk.yellow('No stock symbols found in database.'));
	ui.log(chalk.yellow('Market indices (symbols starting with ^) are used for context only and cannot be trained.'));
	ui.log(chalk.yellow('\n💡 Suggestion: Run "ai-stock-predictions symbol-add AAPL" to add stocks for training.'));
}

/**
 * Log skipped indices message
 * @param indices
 */
function logSkippedIndices(indices: {name: string; symbol: string}[]): void {
	ui.log(chalk.yellow(`\n⚠️  Note: Skipping ${indices.length} market ${indices.length === 1 ? 'index' : 'indices'} (used for context only)`));
	for (const idx of indices) {
		ui.log(chalk.dim(`   - ${idx.name} (${idx.symbol})`));
	}
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
	// Calculate window cutoff date
	const cutoffDate = DateUtils.subtractYears(new Date(), config.training.maxHistoricalYears);
	const sinceDate = DateUtils.formatIso(cutoffDate);

	// Load windowed stock data
	let stockData = await storage.getStockData(symbol, sinceDate);

	if (!stockData || stockData.length < config.model.windowSize) {
		spinner.fail(`${prefix} ${name} (${symbol}) ✗ (insufficient data in last ${config.training.maxHistoricalYears} years)`);
		progress.complete(symbol, 'error');
		return;
	}

	// Check if model needs retraining (smart skip based on data hash)
	const currentDataHash = calculateDataHash(stockData);
	const lastDataDate = stockData.at(-1)?.date;
	const existingMetadata = await storage.getModelMetadata(symbol);

	// Skip training if data hasn't changed (unless in quick test mode)
	const dataUnchanged = existingMetadata?.dataHash === currentDataHash && existingMetadata.lastDataDate === lastDataDate;
	if (dataUnchanged && !quickTest) {
		spinner.succeed(`${prefix} ${name} (${symbol}) ✓ (model up-to-date, no data changes)`);
		progress.complete(symbol, 'trained');
		return;
	}

	// Check data quality
	const quality = storage.getDataQuality(symbol);
	if (quality && quality.qualityScore < config.training.minQualityScore) {
		// Build detailed quality breakdown
		const details = [
			`Quality: ${quality.qualityScore}/${config.training.minQualityScore} required`,
			quality.interpolatedCount > 0 ? `${quality.interpolatedCount} interpolated (${(quality.interpolatedPercent * 100).toFixed(1)}%)` : null,
			quality.outlierCount > 0 ? `${quality.outlierCount} outliers` : null,
			quality.gapsDetected > 0 ? `${quality.gapsDetected} gaps` : null,
		]
			.filter(Boolean)
			.join(', ');

		spinner.warn(`${prefix} ${name} (${symbol}) ⚠️ (${details})`);
		ui.log(chalk.dim(`  💡 Suggestion: Check data source quality or try different provider`));
		progress.complete(symbol, 'low-quality');
		return;
	}

	if (quickTest) {
		stockData = stockData.slice(-500);
	}

	spinner.text = `${prefix} Fetching market context for ${name} (${symbol})...`;
	const marketFeatures = config.market.featureConfig.enabled ? (storage.getMarketFeatures(symbol, sinceDate) ?? []) : [];

	spinner.text = `${prefix} Creating fresh ${name} (${symbol}) model...`;
	const model = new LstmModel(config.model, config.market.featureConfig);

	const trainingStartTime = Date.now();
	const dataPointCount = stockData.length;
	const trainingProgress = (epoch: number, loss: number): void => {
		const bar = progress.createProgressBar(config.model.epochs, epoch, `Training ${name} (${symbol})`);
		const eta = ProgressTracker.calculateEta(trainingStartTime, epoch, config.model.epochs);
		spinner.text = `${prefix} ${bar} [${dataPointCount} pts] (Loss: ${loss.toFixed(6)}, ETA: ${eta})`;
	};

	await model.train(stockData, config, trainingProgress, marketFeatures);

	spinner.text = `${prefix} Validating ${name} (${symbol}) model...`;
	const performance = model.evaluate(stockData, config, marketFeatures);

	if (performance.isValid || quickTest) {
		await modelPersistence.saveModel(symbol, model, {
			...performance,
			dataHash: currentDataHash,
			dataPoints: stockData.length,
			lastDataDate,
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
