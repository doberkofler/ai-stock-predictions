/**
 * Market feature engineering for stock predictions
 * Calculates market context features from index data and stock data
 */

import type {StockDataPoint} from '../types/index.ts';
import type {MarketFeatures} from '../types/index.ts';

import {MarketFeaturesSchema} from '../types/index.ts';

const BETA_WINDOW = 30;
const CORRELATION_WINDOW = 20;

/**
 * Market feature engineer
 */
export class MarketFeatureEngineer {
	/**
	 * Calculate all market features for a stock
	 * @param symbol - Stock symbol
	 * @param stockData - Stock historical data
	 * @param marketData - Primary market index data (configured via config.market.primaryIndex)
	 * @param vixData - Volatility index data (configured via config.market.volatilityIndex)
	 * @returns Array of market features matching stock data length
	 */
	public calculateFeatures(symbol: string, stockData: StockDataPoint[], marketData: StockDataPoint[], vixData: StockDataPoint[]): MarketFeatures[] {
		const features: MarketFeatures[] = [];

		for (let i = 0; i < stockData.length; i++) {
			const stock = stockData[i];
			if (!stock) {
				continue;
			}
			const feature = this.calculateFeatureForDate(symbol, stock, stockData, marketData, vixData, i);

			if (feature) {
				features.push(feature);
			}
		}

		return features;
	}

	/**
	 * Calculate 30-day rolling beta
	 * @param stockData
	 * @param marketData
	 * @param index
	 */
	private calculateBeta(stockData: StockDataPoint[], marketData: StockDataPoint[], index: number): number {
		if (index < BETA_WINDOW || index >= Math.min(stockData.length, marketData.length)) {
			return 1;
		}

		const stockReturns: number[] = [];
		const marketReturns: number[] = [];

		for (let i = index - BETA_WINDOW + 1; i <= index; i++) {
			const stock = stockData[i];
			if (!stock) {
				continue;
			}
			const stockReturn = this.calculateDailyReturn(stock, i, stockData);
			const marketReturn = this.calculateMarketReturn(marketData, i);

			if (stockReturn !== null && marketReturn !== null) {
				stockReturns.push(stockReturn);
				marketReturns.push(marketReturn);
			}
		}

		if (stockReturns.length === 0) {
			return 1;
		}

		return this.calculateCovariance(stockReturns, marketReturns) / this.calculateVariance(marketReturns);
	}

	/**
	 * Calculate 20-day rolling correlation with primary market index
	 * @param stockData
	 * @param marketData
	 * @param index
	 */
	private calculateCorrelation(stockData: StockDataPoint[], marketData: StockDataPoint[], index: number): number {
		if (index < CORRELATION_WINDOW || index >= Math.min(stockData.length, marketData.length)) {
			return 0;
		}

		const stockReturns: number[] = [];
		const marketReturns: number[] = [];

		for (let i = index - CORRELATION_WINDOW + 1; i <= index; i++) {
			const stock = stockData[i];
			if (!stock) {
				continue;
			}
			const stockReturn = this.calculateDailyReturn(stock, i, stockData);
			const marketReturn = this.calculateMarketReturn(marketData, i);

			if (stockReturn !== null && marketReturn !== null) {
				stockReturns.push(stockReturn);
				marketReturns.push(marketReturn);
			}
		}

		if (stockReturns.length === 0) {
			return 0;
		}

		return this.calculatePearsonCorrelation(stockReturns, marketReturns);
	}

	/**
	 * Calculate covariance
	 * @param x
	 * @param y
	 */
	private calculateCovariance(x: number[], y: number[]): number {
		const meanX = x.reduce((a, b) => a + b, 0) / x.length;
		const meanY = y.reduce((a, b) => a + b, 0) / y.length;

		let covariance = 0;
		let i = 0;
		for (const xi of x) {
			const yi = y[i];
			if (yi !== undefined) {
				covariance += (xi - meanX) * (yi - meanY);
			}
			i++;
		}

		return covariance / x.length;
	}

	/**
	 * Calculate daily stock return
	 * @param stock
	 * @param index
	 * @param stockData
	 */
	private calculateDailyReturn(stock: StockDataPoint, index: number, stockData: StockDataPoint[]): null | number {
		if (index < 1 || index >= stockData.length) {
			return null;
		}

		const current = stock.close;
		const previous = stockData[index - 1]?.close;

		if (previous === undefined) {
			return null;
		}

		return (current - previous) / previous;
	}

	/**
	 * Calculate market features for a single date
	 * @param symbol
	 * @param stock
	 * @param stockData
	 * @param marketData
	 * @param vixData
	 * @param index
	 */
	private calculateFeatureForDate(
		symbol: string,
		stock: StockDataPoint,
		stockData: StockDataPoint[],
		marketData: StockDataPoint[],
		vixData: StockDataPoint[],
		index: number,
	): MarketFeatures | null {
		const marketReturn = this.calculateMarketReturn(marketData, index);
		const stockReturn = this.calculateDailyReturn(stock, index, stockData);
		const vix = this.getVixValue(vixData, stock.date);

		if (marketReturn === null || stockReturn === null || vix === null) {
			return null;
		}

		const relativeReturn = stockReturn - marketReturn;
		const beta = this.calculateBeta(stockData, marketData, index);
		const indexCorrelation = this.calculateCorrelation(stockData, marketData, index);
		const volatilitySpread = this.calculateVolatilitySpread(stockData, marketData, index);
		const {distanceFromMA, regime} = this.calculateMarketRegime(marketData, index);

		const feature = {
			beta,
			date: stock.date,
			distanceFromMA,
			indexCorrelation,
			marketRegime: regime,
			marketReturn,
			relativeReturn,
			symbol,
			vix,
			volatilitySpread,
		};

		const validated = MarketFeaturesSchema.safeParse(feature);
		if (!validated.success) {
			return null;
		}

		return validated.data;
	}

	/**
	 * Calculate market regime (BULL/BEAR/NEUTRAL) based on moving averages
	 * @param marketData
	 * @param index
	 */
	private calculateMarketRegime(marketData: StockDataPoint[], index: number): {distanceFromMA: number; regime: 'BEAR' | 'BULL' | 'NEUTRAL'} {
		if (index < 200 || index >= marketData.length) {
			return {distanceFromMA: 0, regime: 'NEUTRAL'};
		}

		const currentPrice = marketData[index]?.close;
		if (currentPrice === undefined) {
			return {distanceFromMA: 0, regime: 'NEUTRAL'};
		}
		const ma200 = this.calculateMovingAverage(marketData, index, 200);
		const ma50 = this.calculateMovingAverage(marketData, index, 50);

		const distanceFromMA = (currentPrice - ma200) / ma200;

		if (currentPrice > ma200 && ma50 > ma200) {
			return {distanceFromMA, regime: 'BULL'};
		}

		if (currentPrice < ma200 && ma50 < ma200) {
			return {distanceFromMA, regime: 'BEAR'};
		}

		return {distanceFromMA, regime: 'NEUTRAL'};
	}

	/**
	 * Calculate daily market return (S&P 500)
	 * @param marketData
	 * @param index
	 */
	private calculateMarketReturn(marketData: StockDataPoint[], index: number): null | number {
		if (index < 1 || index >= marketData.length) {
			return null;
		}

		const current = marketData[index]?.close;
		const previous = marketData[index - 1]?.close;

		if (current === undefined || previous === undefined) {
			return null;
		}

		return (current - previous) / previous;
	}

	/**
	 * Calculate moving average
	 * @param data
	 * @param index
	 * @param window
	 */
	private calculateMovingAverage(data: StockDataPoint[], index: number, window: number): number {
		let sum = 0;
		for (let i = index - window + 1; i <= index; i++) {
			const point = data[i];
			sum += point?.close ?? 0;
		}

		return sum / window;
	}

	/**
	 * Calculate Pearson correlation coefficient
	 * @param x
	 * @param y
	 */
	private calculatePearsonCorrelation(x: number[], y: number[]): number {
		const meanX = x.reduce((a, b) => a + b, 0) / x.length;
		const meanY = y.reduce((a, b) => a + b, 0) / y.length;

		let numerator = 0;
		let sumSqX = 0;
		let sumSqY = 0;
		let i = 0;

		for (const xi of x) {
			const yi = y[i];
			if (yi === undefined) {
				i++;
				continue;
			}
			const dx = xi - meanX;
			const dy = yi - meanY;
			numerator += dx * dy;
			sumSqX += dx ** 2;
			sumSqY += dy ** 2;
			i++;
		}

		const denominator = Math.sqrt(sumSqX * sumSqY);

		if (denominator === 0) {
			return 0;
		}

		return numerator / denominator;
	}

	/**
	 * Calculate standard deviation
	 * @param values
	 */
	private calculateStandardDeviation(values: number[]): number {
		return Math.sqrt(this.calculateVariance(values));
	}

	/**
	 * Calculate variance
	 * @param values
	 */
	private calculateVariance(values: number[]): number {
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		let variance = 0;

		for (const value of values) {
			variance += (value - mean) ** 2;
		}

		return variance / values.length;
	}

	/**
	 * Calculate volatility spread (stock - market)
	 * @param stockData
	 * @param marketData
	 * @param index
	 */
	private calculateVolatilitySpread(stockData: StockDataPoint[], marketData: StockDataPoint[], index: number): number {
		if (index < 10 || index >= Math.min(stockData.length, marketData.length)) {
			return 0;
		}

		const window = 10;

		// Calculate returns for the window correctly
		const stockSlice = stockData.slice(index - window, index + 1);
		const stockReturns = stockSlice.slice(1).map((point, i) => this.calculateDailyReturn(point, i + 1, stockSlice) ?? 0);

		const stockVol = this.calculateStandardDeviation(stockReturns);

		// Same for market volatility
		const marketSlice = marketData.slice(index - window, index + 1);
		const marketReturns = marketSlice.slice(1).map((_, i) => this.calculateMarketReturn(marketSlice, i + 1) ?? 0);

		const marketVol = this.calculateStandardDeviation(marketReturns);

		return stockVol - marketVol;
	}

	/**
	 * Get VIX value for date
	 * @param vixData
	 * @param date
	 */
	private getVixValue(vixData: StockDataPoint[], date: string): null | number {
		const vixPoint = vixData.find((v) => v.date === date);
		return vixPoint?.close ?? null;
	}
}
