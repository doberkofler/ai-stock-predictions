/**
 * Data Source Registry
 * Manages data providers and handles failover logic
 */

import type {ApiConfig} from '../types/index.ts';

import {ui} from '../cli/utils/ui.ts';
import {AlphaVantageDataSource} from './alpha-vantage.ts';
import type {IDataSourceProvider} from './interfaces.ts';
import {YahooFinanceDataSource} from './yahoo-finance.ts';

export class DataSourceRegistry {
	private readonly alphaVantage: AlphaVantageDataSource;
	private readonly primaryProvider: IDataSourceProvider;
	private readonly secondaryProvider: IDataSourceProvider;
	private readonly yahoo: YahooFinanceDataSource;

	public constructor(config: ApiConfig) {
		this.yahoo = new YahooFinanceDataSource(config);
		this.alphaVantage = new AlphaVantageDataSource(config);

		// Default configuration: Yahoo Primary, Alpha Vantage Secondary
		// In the future, this could be configurable via config.jsonc
		this.primaryProvider = this.yahoo;
		this.secondaryProvider = this.alphaVantage;
	}

	/**
	 * Get the best available provider, falling back if necessary
	 * Returns a wrapper that implements the failover logic
	 */
	public getProvider(): IDataSourceProvider {
		return {
			calculateMarketFeatures: (symbol, stockData, marketData, vixData) => {
				// Computation doesn't fail over, just uses the primary logic
				return this.primaryProvider.calculateMarketFeatures(symbol, stockData, marketData, vixData);
			},

			getCurrentQuote: async (symbol) => {
				try {
					return await this.primaryProvider.getCurrentQuote(symbol);
				} catch {
					ui.warn(`Primary source failed for ${symbol}, trying backup...`);
					return await this.secondaryProvider.getCurrentQuote(symbol);
				}
			},

			getHistoricalData: async (symbol, startDate, limit) => {
				try {
					return await this.primaryProvider.getHistoricalData(symbol, startDate, limit);
				} catch {
					ui.warn(`Primary source failed for ${symbol}, trying backup...`);
					return await this.secondaryProvider.getHistoricalData(symbol, startDate, limit);
				}
			},

			validateSymbol: async (symbol) => {
				if (await this.primaryProvider.validateSymbol(symbol)) {
					return true;
				}
				return await this.secondaryProvider.validateSymbol(symbol);
			},
		};
	}
}
