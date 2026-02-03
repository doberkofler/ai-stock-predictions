/**
 * Yahoo Finance API data source
 * Handles fetching historical stock data with rate limiting and retry logic
 */

import yahooFinance from 'yahoo-finance2';
import {z} from 'zod';

import type {ApiConfig, MarketFeatures, StockDataPoint} from '../types/index.ts';

import {DateUtils} from '../cli/utils/date.ts';
import {DataSourceError, ErrorHandler} from '../cli/utils/errors.ts';
import {MarketFeatureEngineer} from '../compute/market-features.ts';
import {StockDataPointSchema, YahooQuoteSchema} from '../types/index.ts';

const StockDataSchema = z.array(StockDataPointSchema);

/**
 * Yahoo Finance data fetch result
 */
export type FetchResult = {
	data: StockDataPoint[];
	oldestDate: null | string;
	omittedCount: number;
};

/**
 * Internal Yahoo Finance Quote Type
 */
type RawYahooQuote = {
	adjclose?: null | number;
	close?: null | number;
	date: Date | number | string;
	high?: null | number;
	low?: null | number;
	open?: null | number;
	volume?: null | number;
};

/**
 * Yahoo Finance data source class
 */
export class YahooFinanceDataSource {
	private readonly api: InstanceType<typeof yahooFinance>;
	private readonly config: ApiConfig;
	private readonly marketFeatureEngineer: MarketFeatureEngineer;

	public constructor(config: ApiConfig) {
		this.api = new yahooFinance();
		this.config = config;
		this.marketFeatureEngineer = new MarketFeatureEngineer();
	}

	/**
	 * Calculate market features for a symbol using provided index data
	 * @param symbol - Stock symbol
	 * @param stockData - Stock historical data
	 * @param marketData - Market index data (^GSPC)
	 * @param vixData - VIX index data (^VIX)
	 * @returns Array of market features
	 */
	public calculateMarketFeatures(symbol: string, stockData: StockDataPoint[], marketData: StockDataPoint[], vixData: StockDataPoint[]): MarketFeatures[] {
		return this.marketFeatureEngineer.calculateFeatures(symbol, stockData, marketData, vixData);
	}

	/**
	 * Get current quote for a symbol
	 * @param symbol - Stock symbol
	 * @returns Current price, currency and company name
	 * @throws {DataSourceError} If API request fails
	 */
	public async getCurrentQuote(symbol: string): Promise<{currency: string; name: string; price: number}> {
		const context = {
			operation: 'fetch-current-quote',
			step: 'api-request',
			symbol,
		};

		return ErrorHandler.wrapAsync(async () => {
			try {
				const response = await Promise.race([
					this.api.quote(symbol),
					new Promise((_resolve, reject) => {
						const timeoutId = setTimeout(() => {
							reject(new Error('Timeout'));
						}, this.config.timeout);
						timeoutId.unref();
					}),
				]);

				const quote = YahooQuoteSchema.parse(response);
				const name = quote.longName ?? quote.shortName ?? symbol;

				return {
					currency: quote.currency,
					name,
					price: quote.regularMarketPrice,
				};
			} catch (error) {
				throw new DataSourceError(`Failed to fetch current quote: ${error instanceof Error ? error.message : String(error)}`, symbol);
			}
		}, context);
	}

	/**
	 * Get historical data for a stock symbol
	 * @param symbol - Stock symbol
	 * @param startDate - Start date for historical data
	 * @param limit - Optional limit for data points
	 * @returns Object containing data and fetch metadata
	 * @throws {DataSourceError} If API request fails or data is invalid
	 */
	public async getHistoricalData(symbol: string, startDate: Date, limit?: number): Promise<FetchResult> {
		const context = {
			operation: 'fetch-historical-data',
			step: 'api-request',
			symbol,
		};

		return ErrorHandler.wrapAsync(async () => {
			let lastError: Error | null = null;

			for (let attempt = 1; attempt <= this.config.retries; attempt++) {
				try {
					// Make API request with timeout
					const response = (await Promise.race([
						this.api.chart(symbol, {
							interval: '1d',
							period1: DateUtils.formatIso(startDate),
						}),
						new Promise((_resolve, reject) => {
							const timeoutId = setTimeout(() => {
								reject(new Error('Timeout'));
							}, this.config.timeout);
							timeoutId.unref();
						}),
					])) as {quotes: RawYahooQuote[]};

					const rawQuotes = response.quotes;
					const deduplicatedQuotes = this.processQuotes(rawQuotes, limit);

					if (deduplicatedQuotes.length === 0) {
						throw new DataSourceError(`No data returned for symbol ${symbol}`, symbol);
					}

					return {
						data: deduplicatedQuotes,
						oldestDate: deduplicatedQuotes[0]?.date ?? null,
						omittedCount: rawQuotes.length - deduplicatedQuotes.length,
					};
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));

					if (attempt < this.config.retries) {
						// eslint-disable-next-line sonarjs/pseudo-random
						const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 1000, 10_000);
						await new Promise((resolve) => {
							const timeoutId = setTimeout(resolve, delay);
							timeoutId.unref();
						});
					}
				}
			}

			throw ErrorHandler.createRetryError(`fetch historical data for ${symbol}`, this.config.retries, lastError ?? new Error('Unknown error'));
		}, context);
	}

	/**
	 * Validate stock symbol
	 * @param symbol - Stock symbol to validate
	 * @returns True if symbol is valid
	 */
	public async validateSymbol(symbol: string): Promise<boolean> {
		try {
			await this.getCurrentQuote(symbol);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Process raw quotes from API into valid, deduplicated stock data points
	 * @param rawQuotes - Raw quotes from Yahoo Finance
	 * @param limit - Optional limit for data points
	 * @returns Valid stock data points
	 */
	private processQuotes(rawQuotes: RawYahooQuote[], limit?: number): StockDataPoint[] {
		const validQuotes: StockDataPoint[] = [];

		for (const quote of rawQuotes) {
			if (quote.open != null && quote.high != null && quote.low != null && quote.close != null && quote.volume != null && quote.adjclose != null) {
				const dateObj = quote.date instanceof Date ? quote.date : new Date(quote.date);
				const dateStr = DateUtils.formatIso(dateObj);

				if (dateStr) {
					validQuotes.push({
						adjClose: quote.adjclose,
						close: quote.close,
						date: dateStr,
						high: quote.high,
						low: quote.low,
						open: quote.open,
						volume: quote.volume,
					});
				}
			}
		}

		// Deduplicate by date
		const quoteMap = new Map<string, StockDataPoint>();
		for (const quote of validQuotes) {
			quoteMap.set(quote.date, quote);
		}

		let result = [...quoteMap.values()].toSorted((a, b) => a.date.localeCompare(b.date));

		if (limit && limit > 0 && result.length > limit) {
			result = result.slice(-limit);
		}

		return StockDataSchema.parse(result);
	}
}
