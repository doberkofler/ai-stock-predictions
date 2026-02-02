/**
 * Predict command - Generates predictions and creates HTML reports
 */

import chalk from 'chalk';
import {join} from 'node:path';
import {ensureDir} from 'fs-extra';
import {SqliteStorage} from '../../gather/storage.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {PredictionEngine} from '../../compute/prediction.ts';
import {HtmlGenerator} from '../../output/html-generator.ts';
import {ProgressTracker} from '../utils/progress.ts';
import {ui} from '../utils/ui.ts';
import {runCommand} from '../utils/runner.ts';
import type {ReportPrediction} from '../../types/index.ts';

/**
 * Predict command implementation
 * @param configPath - Path to the configuration file
 * @param quickTest - Whether to run with limited symbols and forecast window
 * @param [symbolList] - Optional list of symbols to predict
 */
export async function predictCommand(configPath: string, quickTest = false, symbolList?: string): Promise<void> {
	await runCommand(
		{
			title: 'Price Estimation',
			description: 'Generating multi-day trend forecasts and rendering the interactive HTML report.',
			configPath,
		},
		async ({config}) => {
			const storage = new SqliteStorage();
			const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));
			const predictionEngine = new PredictionEngine();
			const htmlGenerator = new HtmlGenerator(config.prediction);
			const progress = new ProgressTracker();

			const availableSymbolsInDb = await storage.getAvailableSymbols();
			let symbolsToProcess: {symbol: string; name: string}[] = [];

			if (symbolList) {
				const requestedSymbols = symbolList.split(',').map((s) => s.trim().toUpperCase());
				for (const sym of requestedSymbols) {
					const model = await modelPersistence.loadModel(sym, config);
					if (!model) {
						ui.error(chalk.red(`\n❌ Error: No trained model found for '${sym}'. Run 'train' first.`));
						process.exit(1);
					}
					if (!availableSymbolsInDb.includes(sym)) {
						ui.error(chalk.red(`\n❌ Error: Symbol '${sym}' has no gathered data. Run 'sync' first.`));
						process.exit(1);
					}
					const name = storage.getSymbolName(sym) ?? sym;
					symbolsToProcess.push({symbol: sym, name});
				}
			} else {
				for (const sym of availableSymbolsInDb) {
					const model = await modelPersistence.loadModel(sym, config);
					if (model) {
						const name = storage.getSymbolName(sym) ?? sym;
						symbolsToProcess.push({symbol: sym, name});
					}
				}
			}

			if (symbolsToProcess.length === 0) {
				ui.log(chalk.yellow('No trained models found. Please run "train" first.'));
				return;
			}

			if (quickTest) {
				symbolsToProcess = symbolsToProcess.slice(0, 3);
				ui.log(chalk.yellow(`⚠️ Quick test mode active: Processing 3 symbols and 5-day forecast`));
			}

			const effectiveConfig = quickTest
				? {
						...config,
						prediction: {
							...config.prediction,
							days: 5,
						},
					}
				: config;

			ui.log(chalk.blue(`\n🔮 Generating predictions for ${symbolsToProcess.length} symbols`));
			ui.log(chalk.dim(`Prediction window: ${effectiveConfig.prediction.days} days`));

			const predictions: ReportPrediction[] = [];

			for (let i = 0; i < symbolsToProcess.length; i++) {
				const entry = symbolsToProcess[i];
				if (!entry) continue;
				const {symbol, name} = entry;
				const prefix = chalk.dim(`[${i + 1}/${symbolsToProcess.length}]`);
				const symbolSpinner = ui.spinner(`${prefix} Predicting ${name} (${symbol})`).start();

				try {
					const stockData = await storage.getStockData(symbol);
					const model = await modelPersistence.loadModel(symbol, effectiveConfig);

					if (!stockData || stockData.length < effectiveConfig.model.windowSize) {
						symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗ (insufficient data)`);
						progress.complete(symbol, 'error');
						continue;
					}

					if (!model) {
						symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗ (no model found)`);
						progress.complete(symbol, 'error');
						continue;
					}

					symbolSpinner.text = `${prefix} Predicting ${name} (${symbol}) [${stockData.length} pts]...`;
					const prediction = await predictionEngine.predict(model, stockData, effectiveConfig);
					const signal = predictionEngine.generateSignal(prediction, effectiveConfig.prediction);

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
					symbolSpinner.succeed(`${prefix} ${name} (${symbol}) ${signalEmoji} ${signal.action} (${(signal.confidence * 100).toFixed(0)}%)`);
					progress.complete(symbol, 'predicted', signal.confidence);
				} catch (error) {
					symbolSpinner.fail(`${prefix} ${name} (${symbol}) ✗`);
					progress.complete(symbol, 'error');
					if (error instanceof Error) ui.error(chalk.red(`  Error: ${error.message}`));
				}
			}

			if (predictions.length > 0) {
				const htmlSpinner = ui.spinner('Generating HTML report...').start();
				try {
					await ensureDir(effectiveConfig.prediction.directory);
					const reportPath = await htmlGenerator.generateReport(predictions, effectiveConfig);
					htmlSpinner.succeed('HTML report generated');
					ui.log(chalk.green(`\n📄 Report saved to: ${reportPath}`));
				} catch (error) {
					htmlSpinner.fail('HTML report generation failed');
					if (error instanceof Error) ui.error(chalk.red(`Error: ${error.message}`));
				}
			}

			const summary = progress.getSummary();
			ui.log('\n' + chalk.bold('🔮 Prediction Summary:'));
			ui.log(chalk.green(`  ✅ Predicted: ${summary.predicted ?? 0}`));
			ui.log(chalk.red(`  ❌ Errors: ${summary.error ?? 0}`));
			ui.log(chalk.dim(`  📊 Total symbols processed: ${symbolsToProcess.length}`));

			ui.log('\n' + chalk.green('✅ Prediction complete!'));
		},
		{},
	);
}
