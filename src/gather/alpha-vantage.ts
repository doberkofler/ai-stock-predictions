/**
 * Alpha Vantage Data Source
 * Secondary provider for failover support
 */

import type {ApiConfig, MarketFeatures, StockDataPoint} from '../types/index.ts';
import type {FetchResult} from './yahoo-finance.ts';

import {DataSourceError, ErrorHandler} from '../cli/utils/errors.ts';
import {MarketFeatureEngineer} from '../compute/market-features.ts';
import {isQualityAcceptable, processData} from './data-quality.ts';
import type {IDataSourceProvider} from './interfaces.ts';

// Mock implementation for Phase 1 (since we don't have an API key yet)
// In a real scenario, this would use 'alphavantage' package or fetch()
export class AlphaVantageDataSource implements IDataSourceProvider {
	private readonly config: ApiConfig;
	private readonly marketFeatureEngineer: MarketFeatureEngineer;

	public constructor(config: ApiConfig) {
		this.config = config;
		this.marketFeatureEngineer = new MarketFeatureEngineer();
	}

	public calculateMarketFeatures(symbol: string, stockData: StockDataPoint[], marketData: StockDataPoint[], vixData: StockDataPoint[]): MarketFeatures[] {
		return this.marketFeatureEngineer.calculateFeatures(symbol, stockData, marketData, vixData);
	}

	public async getCurrentQuote(symbol: string): Promise<{currency: string; name: string; price: number}> {
		// Mock implementation
		const context = {operation: 'alpha-vantage-quote', step: 'mock-request', symbol};
		return ErrorHandler.wrapAsync(async () => {
			if (this.config.retries < 0) throw new DataSourceError('Invalid config', symbol);
			// Simulate async operation
			await Promise.resolve();
			return {
				currency: 'USD',
				name: `${symbol} (Alpha Vantage Mock)`,
				price: 150,
			};
		}, context);
	}

	public async getHistoricalData(symbol: string, _startDate: Date, _limit?: number): Promise<FetchResult> {
		const context = {operation: 'alpha-vantage-history', step: 'mock-request', symbol};

		return ErrorHandler.wrapAsync(async () => {
			// Simulate API call
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Return empty data for now as we don't have a real API key configured
			// This is just a placeholder to satisfy the interface and allow failover testing
			const data: StockDataPoint[] = [];

			if (symbol === 'MOCK_FAIL') {
				throw new Error('Simulated Alpha Vantage Failure');
			}

			const qualityResult = processData(data);

			return {
				data: isQualityAcceptable(qualityResult) ? qualityResult.data : data,
				oldestDate: null,
				omittedCount: 0,
				qualityMetrics: qualityResult,
			};
		}, context);
	}

	public async validateSymbol(symbol: string): Promise<boolean> {
		try {
			await this.getCurrentQuote(symbol);
			return true;
		} catch {
			return false;
		}
	}
}
