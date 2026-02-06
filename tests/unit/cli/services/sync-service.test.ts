import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {Config} from '../../../../src/config/schema.ts';
import {DefaultConfig} from '../../../../src/config/schema.ts';

import {SyncService} from '../../../../src/cli/services/sync-service.ts';
import {DateUtils} from '../../../../src/cli/utils/date.ts';
import {YahooFinanceDataSource} from '../../../../src/gather/yahoo-finance.ts';

const mockStorage = {
	getAllSymbols: vi.fn(),
	getDataTimestamp: vi.fn(),
	getStockData: vi.fn(),
	saveMarketFeatures: vi.fn(),
	saveStockData: vi.fn(),
	saveSymbol: vi.fn(),
	symbolExists: vi.fn(),
};

const mockDataSource = {
	calculateMarketFeatures: vi.fn(),
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
		error: vi.fn(),
		log: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			fail: vi.fn().mockReturnThis(),
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			text: '',
		}),
	},
}));

describe('SyncService', () => {
	const mockConfig: Config = {
		...DefaultConfig,
		training: {
			...DefaultConfig.training,
			minQualityScore: 60,
		},
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should sync symbols correctly', async () => {
		mockDataSource.getHistoricalData.mockResolvedValue({
			data: [{adjClose: 105, close: 105, date: '2023-01-01', high: 110, low: 90, open: 100, volume: 1000}],
			omittedCount: 0,
		});

		mockStorage.getDataTimestamp.mockResolvedValue(null);
		mockStorage.symbolExists.mockReturnValue(false);

		await SyncService.syncSymbols([{name: 'Apple Inc.', symbol: 'AAPL'}], mockConfig, 'data');

		expect(mockStorage.saveSymbol).toHaveBeenCalledWith('AAPL', 'Apple Inc.');
		expect(mockDataSource.getHistoricalData).toHaveBeenCalled();
		expect(mockStorage.saveStockData).toHaveBeenCalled();
	});

	it('should skip sync if already up to date', async () => {
		const today = DateUtils.getStartOfToday();
		mockStorage.getDataTimestamp.mockResolvedValue(today);
		mockStorage.symbolExists.mockReturnValue(true);

		await SyncService.syncSymbols([{name: 'Apple Inc.', symbol: 'AAPL'}], mockConfig, 'data');

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

		await SyncService.syncSymbols([{name: 'Apple Inc.', symbol: 'AAPL'}], mockConfig, 'data');
		expect(mockStorage.saveStockData).not.toHaveBeenCalled();
	});

	it('should handle errors during sync', async () => {
		mockDataSource.getHistoricalData.mockRejectedValue(new Error('API Down'));
		mockStorage.getDataTimestamp.mockResolvedValue(null);

		await SyncService.syncSymbols([{name: 'Apple Inc.', symbol: 'AAPL'}], mockConfig, 'data');
		expect(mockStorage.saveStockData).not.toHaveBeenCalled();
	});
});
