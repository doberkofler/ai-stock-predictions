/**
 * Data Source Registry
 * Manages data providers and handles failover logic
 */

import type {ApiConfig} from '../types/index.ts';

import type {IDataSourceProvider} from './interfaces.ts';
import {YahooFinanceDataSource} from './yahoo-finance.ts';

export class DataSourceRegistry {
	private readonly yahoo: YahooFinanceDataSource;

	public constructor(config: ApiConfig) {
		this.yahoo = new YahooFinanceDataSource(config);
	}

	/**
	 * Get the best available provider
	 */
	public getProvider(): IDataSourceProvider {
		return this.yahoo;
	}
}
