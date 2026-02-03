import {beforeEach, describe, expect, it, vi} from 'vitest';

import {YahooFinanceDataSource} from '../../../src/gather/yahoo-finance.ts';

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
		rateLimit: 10,
		retries: 2,
		timeout: 1000,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		dataSource = new YahooFinanceDataSource(mockApiConfig);
	});

	describe('getHistoricalData', () => {
		it('should successfully fetch and filter historical data', async () => {
			const mockResponse = {
				quotes: [
					{adjclose: 105, close: 105, date: new Date('2023-01-01'), high: 110, low: 90, open: 100, volume: 1000},
					{adjclose: 105, close: 105, date: new Date('2023-01-02'), high: 110, low: 90, open: null, volume: 1000}, // incomplete
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

		it('should apply limit to historical data', async () => {
			const mockResponse = {
				quotes: [
					{adjclose: 100, close: 100, date: new Date('2023-01-01'), high: 110, low: 90, open: 100, volume: 1000},
					{adjclose: 101, close: 101, date: new Date('2023-01-02'), high: 111, low: 91, open: 101, volume: 1000},
					{adjclose: 102, close: 102, date: new Date('2023-01-03'), high: 112, low: 92, open: 102, volume: 1000},
				],
			};
			mockChart.mockResolvedValue(mockResponse);

			const result = await dataSource.getHistoricalData('AAPL', new Date('2023-01-01'), 2);

			expect(result.data).toHaveLength(2);
			expect(result.data[0]?.date).toBe('2023-01-02');
			expect(result.data[1]?.date).toBe('2023-01-03');
		});

		it('should deduplicate records by date', async () => {
			const mockResponse = {
				quotes: [
					{adjclose: 105, close: 105, date: new Date('2023-01-01T10:00:00Z'), high: 110, low: 90, open: 100, volume: 1000},
					{adjclose: 106, close: 106, date: new Date('2023-01-01T20:00:00Z'), high: 111, low: 91, open: 101, volume: 1100},
				],
			};
			mockChart.mockResolvedValue(mockResponse);

			const result = await dataSource.getHistoricalData('AAPL', new Date('2023-01-01'));

			expect(result.data).toHaveLength(1);
			expect(result.data[0]?.close).toBe(106); // keeps the last one
		});

		it('should retry on API error and eventually succeed', async () => {
			mockChart.mockRejectedValueOnce(new Error('Transient Error')).mockResolvedValueOnce({
				quotes: [{adjclose: 105, close: 105, date: new Date('2023-01-01'), high: 110, low: 90, open: 100, volume: 1000}],
			});

			const result = await dataSource.getHistoricalData('AAPL', new Date('2023-01-01'));
			expect(result.data).toHaveLength(1);
			expect(mockChart).toHaveBeenCalledTimes(2);
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
		it('should successfully fetch current quote with name', async () => {
			mockQuote.mockResolvedValue({
				currency: 'USD',
				longName: 'Apple Inc.',
				regularMarketPrice: 150.5,
			});

			const quote = await dataSource.getCurrentQuote('AAPL');

			expect(quote.price).toBe(150.5);
			expect(quote.currency).toBe('USD');
			expect(quote.name).toBe('Apple Inc.');
		});

		it('should use fallback names if longName is missing', async () => {
			mockQuote.mockResolvedValue({
				currency: 'USD',
				regularMarketPrice: 150.5,
				shortName: 'Apple',
			});

			const quote = await dataSource.getCurrentQuote('AAPL');
			expect(quote.name).toBe('Apple');
		});

		it('should use symbol if both names are missing', async () => {
			mockQuote.mockResolvedValue({
				currency: 'USD',
				regularMarketPrice: 150.5,
			});

			const quote = await dataSource.getCurrentQuote('AAPL');
			expect(quote.name).toBe('AAPL');
		});

		it('should throw error if quote response is malformed', async () => {
			mockQuote.mockResolvedValue({
				invalid: 'data',
			});

			await expect(dataSource.getCurrentQuote('AAPL')).rejects.toThrow(/Failed to fetch current quote/);
		});
	});

	describe('validateSymbol', () => {
		it('should return true for valid symbol', async () => {
			mockQuote.mockResolvedValue({
				currency: 'USD',
				regularMarketPrice: 150.5,
			});
			const isValid = await dataSource.validateSymbol('AAPL');
			expect(isValid).toBe(true);
		});

		it('should return false for invalid symbol', async () => {
			mockQuote.mockRejectedValue(new Error('Invalid symbol'));
			const isValid = await dataSource.validateSymbol('INVALID');
			expect(isValid).toBe(false);
		});
	});
});
