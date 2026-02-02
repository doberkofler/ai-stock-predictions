import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {SqliteStorage} from '../../../src/gather/storage.ts';
import type {StockDataPoint} from '../../../src/types/index.ts';
import type {ModelMetadata} from '../../../src/compute/lstm-model.ts';

vi.mock('node:fs', () => ({
	existsSync: vi.fn().mockReturnValue(true),
	mkdirSync: vi.fn(),
}));

describe('SqliteStorage', () => {
	let storage: SqliteStorage;
	const mockData: StockDataPoint[] = [
		{
			date: '2023-01-01',
			open: 100,
			high: 110,
			low: 90,
			close: 105,
			volume: 1000,
			adjClose: 105,
		},
	];

	beforeEach(() => {
		storage = new SqliteStorage();
	});

	afterEach(() => {
		storage.close();
	});

	describe('Symbol Operations', () => {
		it('should save and retrieve symbol name', () => {
			storage.saveSymbol('AAPL', 'Apple Inc.');
			const name = storage.getSymbolName('AAPL');
			expect(name).toBe('Apple Inc.');
		});

		it('should return null for non-existent symbol name', () => {
			const name = storage.getSymbolName('NONEXISTENT');
			expect(name).toBeNull();
		});

		it('should check if symbol exists', () => {
			storage.saveSymbol('AAPL', 'Apple Inc.');
			expect(storage.symbolExists('AAPL')).toBe(true);
			expect(storage.symbolExists('TSLA')).toBe(false);
		});

		it('should delete symbol and associated data', async () => {
			storage.saveSymbol('AAPL', 'Apple Inc.');
			await storage.saveStockData('AAPL', mockData);

			storage.deleteSymbol('AAPL');

			expect(storage.symbolExists('AAPL')).toBe(false);
			const data = await storage.getStockData('AAPL');
			expect(data).toBeNull();
		});
	});

	describe('Quotes Operations', () => {
		it('should save and retrieve stock data', async () => {
			await storage.saveStockData('AAPL', mockData);
			const data = await storage.getStockData('AAPL');
			expect(data).toHaveLength(1);
			expect(data).toEqual(mockData);
		});

		it('should return null for empty data rows', async () => {
			const data = await storage.getStockData('EMPTY');
			expect(data).toBeNull();
		});

		it('should get quote count', async () => {
			await storage.saveStockData('AAPL', mockData);
			expect(storage.getQuoteCount('AAPL')).toBe(1);
			expect(storage.getQuoteCount('TSLA')).toBe(0);
		});

		it('should return null for non-existent symbol', async () => {
			const data = await storage.getStockData('NONEXISTENT');
			expect(data).toBeNull();
		});

		it('should return available symbols', async () => {
			await storage.saveStockData('AAPL', mockData);
			const symbols = await storage.getAvailableSymbols();
			expect(symbols).toContain('AAPL');
		});

		it('should get correct data timestamp', async () => {
			await storage.saveStockData('AAPL', mockData);
			const timestamp = await storage.getDataTimestamp('AAPL');
			expect(timestamp).not.toBeNull();
			expect(timestamp?.toISOString().split('T')[0]).toEqual('2023-01-01');
		});
	});

	describe('Model Metadata Operations', () => {
		it('should save and retrieve model metadata', async () => {
			const mockMetadata: ModelMetadata = {
				version: '1.0.0',
				trainedAt: new Date(),
				dataPoints: 100,
				loss: 0.01,
				windowSize: 30,
				metrics: {mae: 0.05},
				symbol: 'AAPL',
			};

			await storage.saveModelMetadata('AAPL', mockMetadata);
			const metadata = await storage.getModelMetadata('AAPL');
			expect(metadata).not.toBeNull();
			expect(metadata?.version).toBe('1.0.0');
			expect(metadata?.symbol).toBe('AAPL');
		});

		it('should return null for non-existent model metadata', async () => {
			const metadata = await storage.getModelMetadata('NONEXISTENT');
			expect(metadata).toBeNull();
		});
	});

	describe('Export/Import Operations', () => {
		it('should export and import symbols correctly', async () => {
			const symbols = [{symbol: 'AAPL', name: 'Apple Inc.'}];
			await storage.overwriteSymbols(symbols);
			expect(storage.getAllSymbols()).toEqual(symbols);
		});

		it('should export and import quotes correctly', async () => {
			const quotes = [
				{
					symbol: 'AAPL',
					date: '2023-01-01',
					open: 100,
					high: 110,
					low: 90,
					close: 105,
					volume: 1000,
					adjClose: 105,
				},
			];
			await storage.overwriteHistoricalData(quotes);
			expect(storage.getAllQuotes()).toEqual(quotes);
		});

		it('should export and import metadata correctly', async () => {
			const metadata = [
				{
					symbol: 'AAPL',
					version: '1.0.0',
					trainedAt: '2023-01-01T00:00:00.000Z',
					dataPoints: 100,
					loss: 0.01,
					windowSize: 30,
					metrics: JSON.stringify({mae: 0.05}),
				},
			];
			await storage.overwriteModelsMetadata(metadata);
			expect(storage.getAllMetadata()).toEqual(metadata);
		});
	});

	describe('Cleanup Operations', () => {
		it('should clear all data', async () => {
			storage.saveSymbol('AAPL', 'Apple Inc.');
			await storage.saveStockData('AAPL', mockData);
			await storage.clearAllData();

			const symbols = await storage.getAvailableSymbols();
			expect(symbols).toHaveLength(0);
			expect(storage.getAllSymbols()).toHaveLength(0);
		});
	});
});
