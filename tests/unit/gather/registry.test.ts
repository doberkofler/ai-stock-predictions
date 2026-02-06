import {describe, it, expect, vi, beforeEach} from 'vitest';
import {DataSourceRegistry} from '../../../src/gather/registry.ts';
import {YahooFinanceDataSource} from '../../../src/gather/yahoo-finance.ts';

vi.mock('../../../src/gather/yahoo-finance.ts');

describe('DataSourceRegistry', () => {
	const mockConfig = {retries: 3, timeout: 5000};
	let registry: DataSourceRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new DataSourceRegistry(mockConfig as any);
	});

	it('should return the yahoo provider', () => {
		const provider = registry.getProvider();
		expect(provider).toBeInstanceOf(YahooFinanceDataSource);
	});
});
