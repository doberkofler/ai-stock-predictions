/**
 * Backtest execution and metrics calculation
 * Simulates trading strategies based on historical predictions
 */

import type {Config} from '../../config/schema.ts';
import type {BacktestResult, MarketFeatures, StockDataPoint, Trade} from '../../types/index.ts';
import type {LstmModel} from '../lstm-model.ts';
import type {EnsembleModel} from '../ensemble.ts';
import type {PredictionEngine} from '../prediction.ts';

import {ErrorHandler} from '../../cli/utils/errors.ts';
import {InterruptHandler} from '../../cli/utils/interrupt.ts';

/**
 * Backtest engine class
 */
export class BacktestEngine {
	private readonly config: Config;
	private readonly predictionEngine: PredictionEngine;

	/**
	 * @param config - Application configuration
	 * @param predictionEngine - Prediction engine instance
	 */
	public constructor(config: Config, predictionEngine: PredictionEngine) {
		this.config = config;
		this.predictionEngine = predictionEngine;
	}

	/**
	 * Run a backtest for a specific symbol over a historical period
	 * @param symbol - Stock symbol
	 * @param model - Trained model
	 * @param historicalData - Full historical dataset
	 * @param marketFeatures - Optional market features
	 * @param days - Number of days to backtest
	 * @param onProgress - Optional progress callback (current, total)
	 * @returns Backtest results
	 */
	public async run(
		symbol: string,
		model: LstmModel | EnsembleModel,
		historicalData: StockDataPoint[],
		marketFeatures: MarketFeatures[] = [],
		days = 252,
		onProgress?: (current: number, total: number) => void,
	): Promise<BacktestResult> {
		const context = {
			operation: 'run-backtest',
			symbol,
		};

		return ErrorHandler.wrapAsync(async () => {
			const windowSize = this.config.model.windowSize;

			// We need enough data for the first prediction window
			let actualDays = days;
			if (historicalData.length < windowSize + days) {
				actualDays = historicalData.length - windowSize - 1;
			}

			if (actualDays <= 0) {
				throw new Error(`Insufficient data to run backtest for ${symbol}. Need at least ${windowSize + 1} points.`);
			}

			const startIndex = historicalData.length - actualDays - 1;
			const initialValue = this.config.backtest.initialCapital;

			// Optimization: Pre-filter market features to those available up to the start of the backtest
			// and use a date-based lookup for speed
			const {equityCurve, trades} = await this.simulateTrades(model, historicalData, marketFeatures, startIndex, onProgress);

			// Benchmark: Buy and Hold
			const firstPrice = historicalData[startIndex]?.close ?? 0;
			const lastPrice = historicalData.at(-1)?.close ?? 0;
			const benchmarkReturn = firstPrice > 0 ? (lastPrice - firstPrice) / firstPrice : 0;

			// Final valuation
			const finalValue = equityCurve.at(-1)?.value ?? initialValue;
			const totalReturn = (finalValue - initialValue) / initialValue;

			return {
				alpha: totalReturn - benchmarkReturn,
				benchmarkReturn,
				drawdown: this.calculateMaxDrawdown(equityCurve),
				equityCurve,
				finalValue,
				initialValue,
				profit: finalValue - initialValue,
				sharpeRatio: this.calculateSharpeRatio(equityCurve),
				totalReturn,
				trades,
				winRate: this.calculateWinRate(trades),
			};
		}, context);
	}

	/**
	 * Simulate trades over the historical period
	 * @param model
	 * @param historicalData
	 * @param marketFeatures
	 * @param startIndex
	 * @param onProgress
	 */
	private async simulateTrades(
		model: LstmModel | EnsembleModel,
		historicalData: StockDataPoint[],
		marketFeatures: MarketFeatures[],
		startIndex: number,
		onProgress?: (current: number, total: number) => void,
	): Promise<{equityCurve: {date: string; value: number}[]; trades: Trade[]}> {
		const trades: Trade[] = [];
		const equityCurve: {date: string; value: number}[] = [];

		let cash = this.config.backtest.initialCapital;
		let shares = 0;

		const totalIterations = historicalData.length - startIndex;

		for (let i = startIndex; i < historicalData.length; i++) {
			// Check for interrupt signal every iteration for maximum responsiveness
			InterruptHandler.throwIfInterrupted();

			const currentPoint = historicalData[i];
			if (!currentPoint) continue;

			if (onProgress) {
				onProgress(i - startIndex + 1, totalIterations);
				// Yield to event loop to allow UI updates on every iteration during backtest
				// because each iteration is heavy
				await new Promise((resolve) => setTimeout(resolve, 0));
			}

			if (i < historicalData.length - 1) {
				const nextDay = historicalData[i + 1];
				if (nextDay) {
					const {newCash, newShares} = await this.handleTradeSignal(model, historicalData, marketFeatures, i, nextDay, cash, shares, trades);
					cash = newCash;
					shares = newShares;
				}
			}

			equityCurve.push({date: currentPoint.date, value: cash + shares * currentPoint.close});
		}

		return {equityCurve, trades} as {equityCurve: {date: string; value: number}[]; trades: Trade[]};
	}

	/**
	 * Handle a single trade signal
	 * @param model
	 * @param historicalData
	 * @param marketFeatures
	 * @param currentIndex
	 * @param nextDay
	 * @param cash
	 * @param shares
	 * @param trades
	 */
	private async handleTradeSignal(
		model: LstmModel | EnsembleModel,
		historicalData: StockDataPoint[],
		marketFeatures: MarketFeatures[],
		currentIndex: number,
		nextDay: StockDataPoint,
		cash: number,
		shares: number,
		trades: Trade[],
	): Promise<{newCash: number; newShares: number}> {
		const currentDayDate = historicalData[currentIndex]?.date;

		// Optimization: Only use the data needed for the prediction window and indicators
		const windowNeeded = this.config.model.windowSize * 4;
		const startIdx = Math.max(0, currentIndex + 1 - windowNeeded);
		const contextData = historicalData.slice(startIdx, currentIndex + 1);

		// Ensure we only pass market features up to the current backtest date to avoid look-ahead bias
		// and slice them correctly so the lengths match or the prediction engine can handle it.
		const contextFeatures = marketFeatures.filter((f) => {
			const startDate = contextData[0]?.date;
			return startDate !== undefined && currentDayDate !== undefined && f.date >= startDate && f.date <= currentDayDate;
		});

		const prediction = await this.predictionEngine.predict(model, contextData, this.config, contextFeatures);
		const signal = this.predictionEngine.generateSignal(prediction, this.config.prediction);
		const transactionCostRate = this.config.backtest.transactionCost;

		if (signal.action === 'BUY' && cash > 0) {
			const buyPrice = nextDay.open;
			const cost = cash * transactionCostRate;
			const sharesToBuy = Math.floor((cash - cost) / buyPrice);
			if (sharesToBuy > 0) {
				const purchaseValue = sharesToBuy * buyPrice;
				trades.push({action: 'BUY', date: nextDay.date, price: buyPrice, shares: sharesToBuy, value: purchaseValue});
				return {newCash: cash - purchaseValue - cost, newShares: shares + sharesToBuy};
			}
		} else if (signal.action === 'SELL' && shares > 0) {
			const sellPrice = nextDay.open;
			const sellValue = shares * sellPrice;
			const cost = sellValue * transactionCostRate;
			trades.push({action: 'SELL', date: nextDay.date, price: sellPrice, shares, value: sellValue});
			return {newCash: cash + sellValue - cost, newShares: 0};
		}

		return {newCash: cash, newShares: shares};
	}

	/**
	 * Calculate Max Drawdown
	 * @param equityCurve
	 */
	private calculateMaxDrawdown(equityCurve: {value: number}[]): number {
		let maxDrawdown = 0;
		let peak = 0;
		for (const point of equityCurve) {
			if (point.value > peak) peak = point.value;
			const dd = peak > 0 ? (peak - point.value) / peak : 0;
			if (dd > maxDrawdown) maxDrawdown = dd;
		}
		return maxDrawdown;
	}

	/**
	 * Calculate Sharpe Ratio
	 * @param equityCurve
	 */
	private calculateSharpeRatio(equityCurve: {value: number}[]): number {
		const dailyReturns: number[] = [];
		for (let i = 1; i < equityCurve.length; i++) {
			const prevValue = equityCurve[i - 1]?.value ?? 0;
			const currentValue = equityCurve[i]?.value ?? 0;
			if (prevValue > 0) dailyReturns.push((currentValue - prevValue) / prevValue);
		}

		if (dailyReturns.length < 2) return 0;

		const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
		const stdDevReturn = Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / (dailyReturns.length - 1));

		return stdDevReturn > 0 ? (avgDailyReturn / stdDevReturn) * Math.sqrt(252) : 0;
	}

	/**
	 * Calculate Win Rate
	 * @param trades
	 */
	private calculateWinRate(trades: Trade[]): number {
		if (trades.length === 0) return 0;
		let wins = 0;
		let completedTrades = 0;

		let idx = 0;
		while (idx < trades.length - 1) {
			const current = trades[idx];
			const next = trades[idx + 1];
			if (current?.action === 'BUY' && next?.action === 'SELL') {
				if (next.price * next.shares > current.price * current.shares) wins++;
				completedTrades++;
				idx += 2; // Jump over the pair
			} else {
				idx++;
			}
		}
		return completedTrades > 0 ? wins / completedTrades : 0;
	}
}
