/**
 * Tune command - Hyperparameter optimization for LSTM models
 */

import chalk from 'chalk';

import {HyperparameterTuner} from '../../compute/tuner.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Tune command implementation
 * @param workspaceDir - Path to the workspace directory
 * @param symbol - The symbol to tune
 */
export async function tuneCommand(workspaceDir: string, symbol: string): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Hyperparameter tuning using Grid Search and Cross-Validation',
			needsTensorFlow: true,
			nextSteps: ['Update your config.jsonc with the discovered parameters'],
			title: 'Hyperparameter Tuning',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing.');
			}

			const storage = new SqliteStorage(workspaceDir);
			const tuner = new HyperparameterTuner(config);

			// Validate symbol
			if (!storage.symbolExists(symbol)) {
				throw new Error(`Symbol ${symbol} not found in database. Run 'sync' first.`);
			}

			const name = storage.getSymbolName(symbol) ?? symbol;
			ui.log(chalk.blue(`\n🔍 Starting tuning session for ${name} (${symbol})`));
			ui.log(chalk.dim('This process may take several minutes depending on the search space.\n'));

			// Load Data
			const spinner = ui.spinner('Fetching historical data...').start();
			const stockData = await storage.getStockData(symbol);
			if (!stockData || stockData.length < 200) {
				spinner.fail('Insufficient data');
				throw new Error('Insufficient data for tuning (need at least 200 points)');
			}

			const marketFeatures = config.market.featureConfig.enabled ? (storage.getMarketFeatures(symbol) ?? []) : [];
			spinner.succeed(`Loaded ${stockData.length} data points`);

			// Run Tuning
			const tuneSpinner = ui.spinner('Running Grid Search...').start();

			try {
				const bestResult = await tuner.tune(symbol, stockData, marketFeatures, (completed, total, bestMape) => {
					const pct = Math.round((completed / total) * 100);
					tuneSpinner.text = `Running Grid Search... ${pct}% (${completed}/${total}) | Best MAPE: ${(bestMape * 100).toFixed(2)}%`;
				});

				tuneSpinner.succeed('Tuning complete!');

				// Display Results
				ui.log('\n' + chalk.bold('🏆 Best Configuration Found:'));
				ui.log(chalk.green('----------------------------------------'));
				ui.log(`  Architecture:  ${chalk.bold(bestResult.params.architecture)}`);
				ui.log(`  Window Size:   ${chalk.bold(bestResult.params.windowSize)}`);
				ui.log(`  Learning Rate: ${chalk.bold(bestResult.params.learningRate)}`);
				ui.log(`  Batch Size:    ${chalk.bold(bestResult.params.batchSize)}`);
				ui.log(`  Epochs:        ${chalk.bold(bestResult.params.epochs)}`);
				ui.log(chalk.green('----------------------------------------'));
				ui.log(`  Validation MAPE: ${chalk.bold((bestResult.mape * 100).toFixed(2))}%`);
				ui.log(`  Validation Loss: ${bestResult.valLoss.toFixed(6)}`);
				ui.log(`  Trial Duration:  ${(bestResult.duration / 1000).toFixed(1)}s`);
				ui.log(chalk.green('----------------------------------------'));

				ui.log(chalk.yellow('\nTo use these parameters, update your config.jsonc:'));
				ui.log(
					chalk.dim(`
  "model": {
    "architecture": "${bestResult.params.architecture}",
    "windowSize": ${bestResult.params.windowSize},
    "learningRate": ${bestResult.params.learningRate},
    "batchSize": ${bestResult.params.batchSize},
    "epochs": ${bestResult.params.epochs},
    ...
  }
				`),
				);
			} catch (error) {
				tuneSpinner.fail('Tuning failed');
				throw error;
			}
		},
		{},
	);
}
