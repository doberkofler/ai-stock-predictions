import {describe, it, expect, vi, beforeEach} from 'vitest';
import {SyncService} from '../../../../src/cli/services/sync-service.ts';
import {YahooFinanceDataSource} from '../../../../src/gather/yahoo-finance.ts';
import {SqliteStorage} from '../../../../src/gather/storage.ts';
import {DateUtils} from '../../../../src/cli/utils/date.ts';
import type {Config} from '../../../../src/config/schema.ts';

const mockStorage = {
	symbolExists: vi.fn(),
	saveSymbol: vi.fn(),
	getDataTimestamp: vi.fn(),
	saveStockData: vi.fn(),
	getAllSymbols: vi.fn(),
};

const mockDataSource = {
	getHistoricalData: vi.fn(),
};

vi.mock('../../../../src/gather/yahoo-finance.ts', () => ({
	YahooFinanceDataSource: vi.fn().mockImplementation(function (this: any) {
		return mockDataSource;
	}),
}));

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function (this: any) {
		return mockStorage;
	}),
}));

vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		log: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			fail: vi.fn().mockReturnThis(),
			text: '',
		}),
		error: vi.fn(),
	},
}));

describe('SyncService', () => {
	const mockConfig: Config = {
		dataSource: {timeout: 10000, retries: 3, rateLimit: 0},
		training: {minNewDataPoints: 50},
		model: {windowSize: 30, epochs: 50, learningRate: 0.001, batchSize: 128},
		prediction: {
			days: 30,
			historyChartDays: 1825,
			contextDays: 15,
			directory: 'output',
			buyThreshold: 0.05,
			sellThreshold: -0.05,
			minConfidence: 0.6,
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should sync symbols correctly', async () => {
		mockDataSource.getHistoricalData.mockResolvedValue({
			data: [{date: '2023-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000, adjClose: 105}],
			omittedCount: 0,
		});

		mockStorage.getDataTimestamp.mockResolvedValue(null);
		mockStorage.symbolExists.mockReturnValue(false);

		await SyncService.syncSymbols([{symbol: 'AAPL', name: 'Apple Inc.'}], mockConfig);

		expect(mockStorage.saveSymbol).toHaveBeenCalledWith('AAPL', 'Apple Inc.');
		expect(mockDataSource.getHistoricalData).toHaveBeenCalled();
		expect(mockStorage.saveStockData).toHaveBeenCalled();
	});

	it('should skip sync if already up to date', async () => {
		const today = DateUtils.getStartOfToday();
		mockStorage.getDataTimestamp.mockResolvedValue(today);
		mockStorage.symbolExists.mockReturnValue(true);

		await SyncService.syncSymbols([{symbol: 'AAPL', name: 'Apple Inc.'}], mockConfig);

		expect(mockStorage.saveStockData).not.toHaveBeenCalled();
	});

	it('should handle no new data', async () => {
		const mockDataSource = {
			getHistoricalData: vi.fn().mockResolvedValue({
				data: [],
				omittedCount: 0,
			}),
		};
		vi.mocked(YahooFinanceDataSource).mockImplementation(function (this: any) {
			return mockDataSource;
		});
		mockStorage.getDataTimestamp.mockResolvedValue(null);

		await SyncService.syncSymbols([{symbol: 'AAPL', name: 'Apple Inc.'}], mockConfig);
		expect(mockStorage.saveStockData).not.toHaveBeenCalled();
	});

	it('should handle errors during sync', async () => {
		mockDataSource.getHistoricalData.mockRejectedValue(new Error('API Down'));
		mockStorage.getDataTimestamp.mockResolvedValue(null);

		await SyncService.syncSymbols([{symbol: 'AAPL', name: 'Apple Inc.'}], mockConfig);
		expect(mockStorage.saveStockData).not.toHaveBeenCalled();
	});
});
