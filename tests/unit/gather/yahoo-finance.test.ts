import {describe, it, expect, vi, beforeEach} from 'vitest';
import {YahooFinanceDataSource} from '@/gather/yahoo-finance.ts';
import YahooFinance from 'yahoo-finance2';

// Create stable mock functions
const mockChart = vi.fn();
const mockQuote = vi.fn();

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => {
	return {
		default: class {
			public chart = mockChart;
			public quote = mockQuote;
		},
	};
});

describe('YahooFinanceDataSource', () => {
	let dataSource: YahooFinanceDataSource;
	const mockApiConfig = {
		timeout: 1000,
		retries: 2,
		rateLimit: 10,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		dataSource = new YahooFinanceDataSource(mockApiConfig);
	});

	describe('getHistoricalData', () => {
		it('should successfully fetch and filter historical data', async () => {
			const mockResponse = {
				quotes: [
					{date: new Date('2023-01-01'), open: 100, high: 110, low: 90, close: 105, volume: 1000, adjclose: 105},
					{date: new Date('2023-01-02'), open: null, high: 110, low: 90, close: 105, volume: 1000, adjclose: 105}, // incomplete
				],
			};
			mockChart.mockResolvedValue(mockResponse);

			const result = await dataSource.getHistoricalData('AAPL', new Date('2023-01-01'));

			expect(result.data).toHaveLength(1);
			expect(result.data[0]?.close).toBe(105);
			expect(result.data[0]?.date).toBe('2023-01-01');
			expect(result.omittedCount).toBe(1);
			expect(result.oldestDate).toBe('2023-01-01');
		});

		it('should deduplicate records by date', async () => {
			const mockResponse = {
				quotes: [
					{date: new Date('2023-01-01T10:00:00Z'), open: 100, high: 110, low: 90, close: 105, volume: 1000, adjclose: 105},
					{date: new Date('2023-01-01T20:00:00Z'), open: 101, high: 111, low: 91, close: 106, volume: 1100, adjclose: 106},
				],
			};
			mockChart.mockResolvedValue(mockResponse);

			const result = await dataSource.getHistoricalData('AAPL', new Date('2023-01-01'));

			expect(result.data).toHaveLength(1);
			expect(result.data[0]?.close).toBe(106); // keeps the last one
		});

		it('should throw DataSourceError after max retries', async () => {
			mockChart.mockRejectedValue(new Error('Persistent API Error'));

			await expect(dataSource.getHistoricalData('AAPL', new Date('2023-01-01'))).rejects.toThrow(
				/Operation "fetch historical data for AAPL" failed after 2 attempts/,
			);
		});

		it('should throw DataSourceError if no data and no omitted records', async () => {
			mockChart.mockResolvedValue({quotes: []});

			await expect(dataSource.getHistoricalData('AAPL', new Date('2023-01-01'))).rejects.toThrow(/No data returned for symbol AAPL/);
		});
	});

	describe('getCurrentQuote', () => {
		it('should successfully fetch current quote', async () => {
			mockQuote.mockResolvedValue({
				regularMarketPrice: 150.5,
				currency: 'USD',
			});

			const quote = await dataSource.getCurrentQuote('AAPL');

			expect(quote.price).toBe(150.5);
			expect(quote.currency).toBe('USD');
		});
	});
});
