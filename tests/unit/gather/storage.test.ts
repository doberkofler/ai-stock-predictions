import {rmSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import type {ModelMetadata} from '../../../src/compute/lstm-model.ts';
import type {MarketFeatures, StockDataPoint} from '../../../src/types/index.ts';

import {SqliteStorage} from '../../../src/gather/storage.ts';

const testDataDir = join(process.cwd(), 'data-test');

describe('SqliteStorage', () => {
	let storage: SqliteStorage;
	const mockData: StockDataPoint[] = [
		{
			adjClose: 105,
			close: 105,
			date: '2023-01-01',
			high: 110,
			low: 90,
			open: 100,
			volume: 1000,
		},
	];

	beforeAll(() => {
		try {
			rmSync(testDataDir, {force: true, recursive: true});
		} catch {
			// Directory doesn't exist
		}
	});

	afterAll(() => {
		try {
			rmSync(testDataDir, {force: true, recursive: true});
		} catch {
			// Directory doesn't exist
		}
	});

	beforeEach(() => {
		storage = new SqliteStorage(testDataDir);
	});

	afterEach(() => {
		if (storage) {
			storage.close();
		}
		vi.restoreAllMocks();
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
				dataPoints: 100,
				loss: 0.01,
				metrics: {mae: 0.05},
				symbol: 'AAPL',
				trainedAt: new Date(),
				version: '1.0.0',
				windowSize: 30,
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
			const symbols = [{name: 'Apple Inc.', priority: 999, symbol: 'AAPL', type: 'STOCK'}];
			await storage.overwriteSymbols(symbols);
			expect(storage.getAllSymbols()).toEqual(symbols);
		});

		it('should export and import quotes correctly', async () => {
			const quotes = [
				{
					adjClose: 105,
					close: 105,
					date: '2023-01-01',
					high: 110,
					low: 90,
					open: 100,
					symbol: 'AAPL',
					volume: 1000,
				},
			];
			await storage.overwriteHistoricalData(quotes);
			expect(storage.getAllQuotes()).toEqual(quotes);
		});

		it('should export and import metadata correctly', async () => {
			const metadata = [
				{
					dataHash: null,
					dataPoints: 100,
					lastDataDate: null,
					loss: 0.01,
					metrics: JSON.stringify({mae: 0.05}),
					symbol: 'AAPL',
					trainedAt: '2023-01-01T00:00:00.000Z',
					version: '1.0.0',
					windowSize: 30,
				},
			];
			await storage.overwriteModelsMetadata(metadata);
			expect(storage.getAllMetadata()).toEqual(metadata);
		});
	});

	describe('Data Quality Operations', () => {
		it('should save and retrieve data quality metrics', async () => {
			storage.saveDataQuality('AAPL', 85.5, 5, 0.05, 2, 0.02, 0, 10);
			const quality = storage.getDataQuality('AAPL');
			expect(quality).not.toBeNull();
			expect(quality?.qualityScore).toBe(85.5);
			expect(quality?.interpolatedCount).toBe(5);
			expect(quality?.outlierCount).toBe(2);
			expect(quality?.symbol).toBe('AAPL');
		});

		it('should return null for non-existent data quality', async () => {
			const quality = storage.getDataQuality('NONEXISTENT');
			expect(quality).toBeNull();
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

	describe('Market Features Operations', () => {
		it('should save and retrieve market features', async () => {
			const mockFeatures: MarketFeatures[] = [
				{
					beta: 1.2,
					date: '2023-01-01',
					distanceFromMA: 0.05,
					indexCorrelation: 0.8,
					marketRegime: 'BULL',
					marketReturn: 0.01,
					relativeReturn: 0.005,
					symbol: 'AAPL',
					vix: 20,
					volatilitySpread: 0.02,
				},
			];

			await storage.saveMarketFeatures('AAPL', mockFeatures);
			const features = await storage.getMarketFeatures('AAPL');
			expect(features).not.toBeNull();
			if (features) {
				expect(features).toHaveLength(1);
				expect(features[0]?.marketReturn).toBe(0.01);
				expect(features[0]?.marketRegime).toBe('BULL');
			}
		});

		it('should return null for non-existent market features', async () => {
			const features = await storage.getMarketFeatures('NONEXISTENT');
			expect(features).toBeNull();
		});

		it('should delete market features when symbol is deleted', async () => {
			const mockFeatures: MarketFeatures[] = [
				{
					beta: 1.2,
					date: '2023-01-01',
					distanceFromMA: 0.05,
					indexCorrelation: 0.8,
					marketRegime: 'BULL',
					marketReturn: 0.01,
					relativeReturn: 0.005,
					symbol: 'AAPL',
					vix: 20,
					volatilitySpread: 0.02,
				},
			];

			await storage.saveMarketFeatures('AAPL', mockFeatures);
			storage.deleteSymbol('AAPL');

			const features = await storage.getMarketFeatures('AAPL');
			expect(features).toBeNull();
		});
	});
});
