import {describe, it, expect, beforeEach, vi} from 'vitest';
import {SqliteStorage} from '@/gather/storage.ts';
import type {StockDataPoint} from '@/types/index.ts';
import type {ModelMetadata} from '@/compute/lstm-model.ts';

// Note: Better-sqlite3 is difficult to mock deeply without significant boilerplate.
// Since we are running in an environment that supports SQLite, we use a real :memory: database for high-fidelity testing.

describe('SqliteStorage', () => {
	let storage: SqliteStorage;

	beforeEach(() => {
		vi.clearAllMocks();
		storage = new SqliteStorage(true); // isMemory = true
	});

	describe('Symbols Operations', () => {
		it('should save and retrieve symbol name', () => {
			storage.saveSymbol('AAPL', 'Apple Inc.');
			const name = storage.getSymbolName('AAPL');
			expect(name).toBe('Apple Inc.');
		});

		it('should return null for non-existent symbol name', () => {
			const name = storage.getSymbolName('NONEXISTENT');
			expect(name).toBeNull();
		});
	});

	describe('Quotes Operations', () => {
		const mockData: StockDataPoint[] = [
			{
				date: '2023-01-01',
				open: 150,
				high: 155,
				low: 145,
				close: 152,
				volume: 1000000,
				adjClose: 152,
			},
		];

		it('should save and retrieve stock data', async () => {
			await storage.saveStockData('AAPL', mockData);
			const result = await storage.getStockData('AAPL');
			expect(result).toEqual(mockData);
		});

		it('should return null for non-existent symbol', async () => {
			const result = await storage.getStockData('NONEXISTENT');
			expect(result).toBeNull();
		});

		it('should return available symbols', async () => {
			// Clear data first since it might be polluted if :memory: is shared (unlikely but safe)
			await storage.saveStockData('AAPL', mockData);
			await storage.saveStockData('MSFT', mockData);
			const symbols = await storage.getAvailableSymbols();
			expect(symbols).toContain('AAPL');
			expect(symbols).toContain('MSFT');
		});

		it('should get correct data timestamp', async () => {
			await storage.saveStockData('AAPL', mockData);
			const timestamp = await storage.getDataTimestamp('AAPL');
			expect(timestamp).toEqual(new Date('2023-01-01'));
		});
	});

	describe('Model Metadata Operations', () => {
		const mockMetadata: ModelMetadata = {
			version: '1.0.0',
			trainedAt: new Date('2023-01-01T00:00:00.000Z'),
			dataPoints: 100,
			loss: 0.01,
			windowSize: 30,
			metrics: {mae: 0.05},
			symbol: 'AAPL',
		};

		it('should save and retrieve model metadata', async () => {
			await storage.saveModelMetadata('AAPL', mockMetadata);
			const result = await storage.getModelMetadata('AAPL');
			expect(result).toEqual(mockMetadata);
		});

		it('should return null for non-existent model metadata', async () => {
			const result = await storage.getModelMetadata('NONEXISTENT');
			expect(result).toBeNull();
		});
	});

	describe('Export/Import Operations', () => {
		it('should export and import data correctly', async () => {
			const mockSymbol = {
				symbol: 'AAPL',
				name: 'Apple Inc.',
			};
			const mockQuote = {
				symbol: 'AAPL',
				date: '2023-01-01',
				open: 150,
				high: 155,
				low: 145,
				close: 152,
				volume: 1000000,
				adjClose: 152,
			};
			const mockMeta = {
				symbol: 'AAPL',
				version: '1.0.0',
				trainedAt: '2023-01-01T00:00:00.000Z',
				dataPoints: 100,
				loss: 0.01,
				windowSize: 30,
				metrics: JSON.stringify({mae: 0.05}),
			};

			await storage.overwriteSymbols([mockSymbol]);
			await storage.overwriteHistoricalData([mockQuote]);
			await storage.overwriteModelsMetadata([mockMeta]);

			const symbols = storage.getAllSymbols();
			const quotes = storage.getAllQuotes();
			const metadata = storage.getAllMetadata();

			expect(symbols).toHaveLength(1);
			expect(symbols[0]?.name).toBe('Apple Inc.');
			expect(quotes).toHaveLength(1);
			expect(quotes[0]?.symbol).toBe('AAPL');
			expect(metadata).toHaveLength(1);
			expect(metadata[0]?.symbol).toBe('AAPL');
		});
	});

	describe('Data Management', () => {
		it('should clear all data', async () => {
			await storage.saveSymbol('AAPL', 'Apple Inc.');
			await storage.saveStockData('AAPL', [
				{
					date: '2023-01-01',
					open: 150,
					high: 155,
					low: 145,
					close: 152,
					volume: 1000000,
					adjClose: 152,
				},
			]);

			await storage.clearAllData();
			const symbols = await storage.getAvailableSymbols();
			const name = storage.getSymbolName('AAPL');

			expect(symbols).toHaveLength(0);
			expect(name).toBeNull();
		});
	});
});
