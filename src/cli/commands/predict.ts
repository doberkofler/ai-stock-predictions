/**
 * Predict command - Generates predictions and creates HTML reports
 * Implements prediction logic and interactive chart generation
 */

import chalk from 'chalk';
import ora from 'ora';
import {loadConfig} from '../../config/config.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {PredictionEngine} from '../../compute/prediction.ts';
import {HtmlGenerator} from '../../output/html-generator.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {ensureDir} from 'fs-extra';
import {join} from 'node:path';
import type {ReportPrediction} from '../../types/index.ts';

/**
 * Predict command implementation
 * Generates predictions for all configured symbols and creates HTML reports
 * @param {string} configPath - Path to the configuration file
 */
export async function predictCommand(configPath: string): Promise<void> {
	console.log(chalk.bold.blue('\n=== AI Stock Predictions: Price Estimation ==='));
	console.log(chalk.dim('Generating multi-day trend forecasts and rendering the interactive HTML report.\n'));
	const startTime = Date.now();
	const spinner = ora('Loading configuration').start();

	try {
		// Load configuration
		const config = loadConfig(configPath);
		spinner.succeed('Configuration loaded');

		// Initialize components
		const storage = new SqliteStorage();
		const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
		const predictionEngine = new PredictionEngine();
		const htmlGenerator = new HtmlGenerator(config.output);
		const progress = new ProgressTracker();

		// Filter symbols to only those that have data in the database
		const availableSymbolsInDb = await storage.getAvailableSymbols();
		const symbolsToProcess = config.symbols.filter((s) => availableSymbolsInDb.includes(s.symbol));

		if (symbolsToProcess.length === 0) {
			spinner.warn('No stock data found in database. Run "gather" first.');
			return;
		}

		if (symbolsToProcess.length < config.symbols.length) {
			console.log(chalk.yellow(`⚠️  Data found for only ${symbolsToProcess.length} out of ${config.symbols.length} symbols. Skipping others.`));
		}

		console.log(chalk.blue(`\n🔮 Generating predictions for ${symbolsToProcess.length} symbols`));
		console.log(chalk.dim(`Prediction window: ${config.prediction.days} days`));
		console.log(
			chalk.dim(`Trading thresholds: Buy ${(config.trading.buyThreshold * 100).toFixed(1)}%, Sell ${(config.trading.sellThreshold * 100).toFixed(1)}%`),
		);

		const predictions: ReportPrediction[] = [];

		// Process each symbol
		for (let i = 0; i < symbolsToProcess.length; i++) {
			const symbolEntry = symbolsToProcess[i];
			if (!symbolEntry) continue;
			const {symbol, name} = symbolEntry;

			const symbolSpinner = ora(`Predicting ${name} (${symbol}) (${i + 1}/${symbolsToProcess.length})`).start();

			try {
				// Check if data and model exist
				const stockData = await storage.getStockData(symbol);
				const model = await modelPersistence.loadModel(symbol, config);

				if (!stockData || stockData.length < config.ml.windowSize) {
					symbolSpinner.fail(`${name} (${symbol}) ✗ (insufficient data)`);
					progress.complete(symbol, 'error');
					continue;
				}

				if (!model) {
					symbolSpinner.fail(`${name} (${symbol}) ✗ (no model found)`);
					progress.complete(symbol, 'error');
					continue;
				}

				// Generate prediction
				symbolSpinner.text = `Predicting ${name} (${symbol})...`;
				const prediction = await predictionEngine.predict(model, stockData, config);

				// Generate trading signal
				const signal = predictionEngine.generateSignal(prediction, config.trading);

				predictions.push({
					symbol,
					name,
					prediction,
					signal: signal.action,
					confidence: signal.confidence,
				});

				let signalEmoji = '➡️';
				if (signal.action === 'BUY') {
					signalEmoji = '📈';
				} else if (signal.action === 'SELL') {
					signalEmoji = '📉';
				}
				symbolSpinner.succeed(`${name} (${symbol}) ${signalEmoji} ${signal.action} (${(signal.confidence * 100).toFixed(0)}%)`);
				progress.complete(symbol, 'predicted', signal.confidence);
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

		// Generate HTML report
		if (predictions.length > 0) {
			const htmlSpinner = ora('Generating HTML report...').start();

			try {
				// Ensure output directory exists
				await ensureDir(config.output.directory);

				// Generate HTML report
				const reportPath = await htmlGenerator.generateReport(predictions, config);

				htmlSpinner.succeed('HTML report generated');
				console.log(chalk.green(`\n📄 Report saved to: ${reportPath}`));
			} catch (error) {
				htmlSpinner.fail('HTML report generation failed');
				if (error instanceof Error) {
					console.error(chalk.red(`Error: ${error.message}`));
				}
			}
		}

		// Display summary
		const summary = progress.getSummary();
		const buySignals = predictions.filter((p) => p.signal === 'BUY').length;
		const sellSignals = predictions.filter((p) => p.signal === 'SELL').length;
		const holdSignals = predictions.filter((p) => p.signal === 'HOLD').length;

		console.log('\n' + chalk.bold('🔮 Prediction Summary:'));
		console.log(chalk.green(`  ✅ Predicted: ${summary.predicted ?? 0}`));
		console.log(chalk.red(`  ❌ Errors: ${summary.error ?? 0}`));
		console.log(chalk.dim(`  📊 Total symbols processed: ${symbolsToProcess.length}`));

		if ((summary.predicted ?? 0) > 0) {
			console.log('\n' + chalk.bold('📈 Trading Signals:'));
			console.log(chalk.green(`  📈 BUY signals: ${buySignals}`));
			console.log(chalk.red(`  📉 SELL signals: ${sellSignals}`));
			console.log(chalk.blue(`  ➡️  HOLD signals: ${holdSignals}`));

			const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
			console.log(chalk.dim(`  📊 Average confidence: ${(avgConfidence * 100).toFixed(1)}%`));
		}

		if ((summary.error ?? 0) > 0) {
			console.log(`\n${chalk.yellow('⚠️  Some symbols failed to predict. Check errors above.')}`);
		}

		console.log('\n' + chalk.green('✅ Prediction complete!'));
		console.log(chalk.cyan(`Process completed in ${ProgressTracker.formatDuration(Date.now() - startTime)}.`));

		if (predictions.length > 0) {
			console.log(chalk.cyan(`Open the HTML report to view detailed predictions and charts.`));
		} else {
			console.log(chalk.yellow('No predictions generated. Check data and models.'));
		}
	} catch (error) {
		spinner.fail('Prediction failed');
		if (error instanceof Error) {
			console.error(chalk.red(`Error: ${error.message}`));
		} else {
			console.error(chalk.red('Unknown error occurred during prediction'));
		}
		process.exit(1);
	}
}
