/**
 * Backtest command - Evaluates trading strategies based on historical data
 */

import chalk from 'chalk';
import {join, resolve} from 'node:path';

import {BacktestEngine} from '../../compute/backtest/engine.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {PredictionEngine} from '../../compute/prediction.ts';
import {SqliteStorage} from '../../gather/storage.ts';
import {runCommand} from '../utils/runner.ts';
import {ui} from '../utils/ui.ts';

/**
 * Backtest command implementation
 * @param workspaceDir - Path to the workspace directory
 * @param symbolList - Optional comma-separated list of symbols
 * @param days - Number of historical days to backtest
 */
export async function backtestCommand(workspaceDir: string, symbolList?: string, days = 252): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Simulating trading strategy based on historical predictions to evaluate performance.',
			needsTensorFlow: true,
			nextSteps: ['Review the backtest metrics to evaluate model profitability.'],
			title: 'Strategy Backtesting',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing.');
			}

			const dataDir = resolve(process.cwd(), workspaceDir);
			const storage = new SqliteStorage(workspaceDir);
			const modelPersistence = new ModelPersistence(join(dataDir, 'models'));
			const predictionEngine = new PredictionEngine();
			const backtestEngine = new BacktestEngine(config, predictionEngine);

			const availableSymbols = await storage.getAvailableSymbols();
			const requestedSymbols = symbolList ? symbolList.split(',').map((s) => s.trim().toUpperCase()) : availableSymbols;

			ui.log(chalk.blue(`\n📊 Running backtest for ${requestedSymbols.length} symbols over ${days} trading days`));

			for (const symbol of requestedSymbols) {
				const spinner = ui.spinner(`Backtesting ${symbol}...`).start();
				try {
					const model = await modelPersistence.loadModel(symbol, config);
					if (!model) {
						spinner.warn(`No trained model found for ${symbol}. Skipping.`);
						continue;
					}

					const historicalData = await storage.getStockData(symbol);
					if (!historicalData || historicalData.length < config.model.windowSize + 5) {
						spinner.warn(`Insufficient historical data for ${symbol}. Skipping.`);
						continue;
					}

					const marketFeatures = storage.getMarketFeatures(symbol) ?? [];

					const result = await backtestEngine.run(symbol, model, historicalData, marketFeatures, days);

					spinner.succeed(`Backtest complete for ${symbol}`);

					// Print metrics in a clean format
					ui.log(`  ${chalk.bold('Results for ' + symbol + ':')}`);
					ui.log(`    Cumulative Return: ${formatPercent(result.totalReturn)}`);
					ui.log(`    Benchmark (B&H):   ${formatPercent(result.benchmarkReturn)}`);
					ui.log(`    Alpha:             ${formatPercent(result.alpha)}`);
					ui.log(`    Max Drawdown:      ${formatPercent(result.drawdown)}`);
					ui.log(`    Win Rate:          ${formatPercent(result.winRate)}`);
					ui.log(`    Sharpe Ratio:      ${result.sharpeRatio.toFixed(2)}`);
					ui.log(`    Total Trades:      ${result.trades.length}`);
					ui.log(`    Final Portfolio:   $${result.finalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}`);
					ui.log('');
				} catch (error) {
					spinner.fail(`Backtest failed for ${symbol}`);
					if (error instanceof Error) ui.error(`  ${error.message}`);
				}
			}
		},
		{},
	);
}

function formatPercent(val: number): string {
	const color = val >= 0 ? chalk.green : chalk.red;
	return color(`${(val * 100).toFixed(2)}%`);
}
