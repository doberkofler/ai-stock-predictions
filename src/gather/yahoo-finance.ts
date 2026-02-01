/**
 * Yahoo Finance API data source
 * Handles fetching historical stock data with rate limiting and retry logic
 */

import yahooFinance from 'yahoo-finance2';
import {z} from 'zod';

import {DataSourceError, ErrorHandler} from '../cli/utils/errors.ts';
import type {StockDataPoint, ApiConfig} from '../types/index.ts';

/**
 * Stock data array schema for validation
 */
const StockDataSchema = z.array(
	z.object({
		date: z
			.string()
			.or(z.date())
			.transform((val) => (typeof val === 'string' ? val : val.toISOString())),
		open: z.number(),
		high: z.number(),
		low: z.number(),
		close: z.number(),
		volume: z.number(),
		adjClose: z.number().optional().default(0),
	}),
);

/**
 * Yahoo Finance data fetch result
 */
export type FetchResult = {
	data: StockDataPoint[];
	omittedCount: number;
	oldestDate: string | null;
};

/**
 * Internal Yahoo Finance Quote Type
 */
type RawYahooQuote = {
	date: Date | string | number;
	open?: number | null;
	high?: number | null;
	low?: number | null;
	close?: number | null;
	volume?: number | null;
	adjclose?: number | null;
};

/**
 * Yahoo Finance data source class
 */
export class YahooFinanceDataSource {
	private readonly api: InstanceType<typeof yahooFinance>;
	private readonly config: ApiConfig;

	public constructor(config: ApiConfig) {
		this.api = new yahooFinance();
		this.config = config;
	}

	/**
	 * Get historical data for a stock symbol
	 * @param {string} symbol - Stock symbol
	 * @param {Date} startDate - Start date for historical data
	 * @returns {Promise<FetchResult>} Object containing data and fetch metadata
	 * @throws {DataSourceError} If API request fails or data is invalid
	 */
	public async getHistoricalData(symbol: string, startDate: Date): Promise<FetchResult> {
		const context = {
			operation: 'fetch-historical-data',
			symbol,
			step: 'api-request',
		};

		return ErrorHandler.wrapAsync(async () => {
			let lastError: Error | null = null;

			for (let attempt = 1; attempt <= this.config.retries; attempt++) {
				try {
					// Make API request with timeout
					const response = (await Promise.race([
						this.api.chart(symbol, {
							period1: startDate.toISOString().split('T')[0] ?? '',
							interval: '1d',
						}),
						new Promise((_, reject) => {
							const timeoutId = setTimeout(() => {
								reject(new Error('Timeout'));
							}, this.config.timeout);
							timeoutId.unref();
						}),
					])) as {quotes: RawYahooQuote[]};

					const rawQuotes = response.quotes;
					let omittedCount = 0;
					const validQuotes: StockDataPoint[] = [];

					for (const quote of rawQuotes) {
						// Filter out null/undefined values
						if (quote.open != null && quote.high != null && quote.low != null && quote.close != null && quote.volume != null && quote.adjclose != null) {
							// Normalize date to YYYY-MM-DD string to prevent duplicates with different times
							const dateObj = quote.date instanceof Date ? quote.date : new Date(quote.date);
							const dateStr = dateObj.toISOString().split('T')[0];

							if (dateStr) {
								validQuotes.push({
									date: dateStr,
									open: quote.open,
									high: quote.high,
									low: quote.low,
									close: quote.close,
									volume: quote.volume,
									adjClose: quote.adjclose,
								});
							}
						} else {
							omittedCount++;
						}
					}

					// Deduplicate by date (keep the last one encountered in the batch)
					const quoteMap = new Map<string, StockDataPoint>();
					for (const quote of validQuotes) {
						quoteMap.set(quote.date, quote);
					}

					const deduplicatedQuotes = [...quoteMap.values()].toSorted((a, b) => a.date.localeCompare(b.date));

					// Validate the filtered and deduplicated data array
					const validatedData = StockDataSchema.parse(deduplicatedQuotes);

					if (validatedData.length === 0 && omittedCount === 0) {
						throw new DataSourceError(`No data returned for symbol ${symbol}`, symbol);
					}

					return {
						data: validatedData,
						omittedCount,
						oldestDate: validatedData[0]?.date ?? null,
					};
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));

					if (attempt < this.config.retries) {
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
	 * Get current quote for a symbol
	 * @param {string} symbol - Stock symbol
	 * @returns {Promise<{price: number; currency: string}>} Current price and currency
	 * @throws {DataSourceError} If API request fails
	 */
	public async getCurrentQuote(symbol: string): Promise<{price: number; currency: string}> {
		const context = {
			operation: 'fetch-current-quote',
			symbol,
			step: 'api-request',
		};

		return ErrorHandler.wrapAsync(async () => {
			try {
				const quote = (await Promise.race([
					this.api.quote(symbol),
					new Promise((_, reject) => {
						const timeoutId = setTimeout(() => {
							reject(new Error('Timeout'));
						}, this.config.timeout);
						timeoutId.unref();
					}),
				])) as Record<string, unknown>;

				if (typeof quote === 'object' && quote.regularMarketPrice != null && quote.currency != null) {
					return {
						price: quote.regularMarketPrice as number,
						currency: quote.currency as string,
					};
				}

				throw new DataSourceError(`Invalid quote data for symbol ${symbol}`, symbol);
			} catch (error) {
				throw new DataSourceError(`Failed to fetch current quote: ${error instanceof Error ? error.message : String(error)}`, symbol);
			}
		}, context);
	}

	/**
	 * Validate stock symbol
	 * @param {string} symbol - Stock symbol to validate
	 * @returns {Promise<boolean>} True if symbol is valid
	 */
	public async validateSymbol(symbol: string): Promise<boolean> {
		try {
			await this.getCurrentQuote(symbol);
			return true;
		} catch {
			return false;
		}
	}
}
