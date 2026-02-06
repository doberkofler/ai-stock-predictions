/**
 * Data Source Provider Interface
 * Defines the contract for all data source implementations (Yahoo Finance, etc.)
 */

import type {MarketFeatures, StockDataPoint} from '../types/index.ts';
import type {FetchResult} from './yahoo-finance.ts'; // Re-use type from Yahoo for now to avoid circular deps

export type IDataSourceProvider = {
	/**
	 * Calculate market features for a symbol using provided index data
	 */
	calculateMarketFeatures(symbol: string, stockData: StockDataPoint[], marketData: StockDataPoint[], vixData: StockDataPoint[]): MarketFeatures[];

	/**
	 * Get current quote for a symbol
	 */
	getCurrentQuote(symbol: string): Promise<{currency: string; name: string; price: number}>;

	/**
	 * Get historical data for a stock symbol
	 */
	getHistoricalData(symbol: string, startDate: Date, limit?: number): Promise<FetchResult>;

	/**
	 * Validate stock symbol
	 */
	validateSymbol(symbol: string): Promise<boolean>;
};
