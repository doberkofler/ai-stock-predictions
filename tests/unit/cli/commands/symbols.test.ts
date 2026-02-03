import {beforeEach, describe, expect, it, vi} from 'vitest';

import {symbolAddCommand, symbolDefaultsCommand, symbolListCommand, symbolRemoveCommand} from '../../../../src/cli/commands/symbols.ts';
import {SymbolService} from '../../../../src/cli/services/symbol-service.ts';
import {SyncService} from '../../../../src/cli/services/sync-service.ts';

const mockStorage = {
	getAllSymbols: vi.fn(),
	getDataTimestamp: vi.fn(),
	getQuoteCount: vi.fn(),
	getSymbolName: vi.fn(),
	saveSymbol: vi.fn(),
	symbolExists: vi.fn(),
};

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function () {
		return mockStorage;
	}),
}));

const mockDataSource = {
	getCurrentQuote: vi.fn(),
	validateSymbol: vi.fn(),
};

vi.mock('../../../../src/gather/yahoo-finance.ts', () => ({
	YahooFinanceDataSource: vi.fn().mockImplementation(function () {
		return mockDataSource;
	}),
}));

vi.mock('../../../../src/compute/persistence.ts', () => ({
	ModelPersistence: vi.fn().mockImplementation(function () {
		return {
			getModelMetadata: vi.fn().mockResolvedValue({loss: 0.01, trainedAt: new Date()}),
		};
	}),
}));

vi.mock('../../../../src/cli/services/symbol-service.ts', () => ({
	SymbolService: {
		removeSymbol: vi.fn(),
	},
}));

vi.mock('../../../../src/cli/services/sync-service.ts', () => ({
	SyncService: {
		syncSymbols: vi.fn(),
	},
}));

const mockAppConfig = {
	dataSource: {},
};

vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		await handler(
			{
				config: mockAppConfig,
				startTime: Date.now(),
			},
			commandOptions,
		);
	}),
}));

vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		error: vi.fn(),
		log: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			fail: vi.fn().mockReturnThis(),
			info: vi.fn().mockReturnThis(),
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			text: '',
		}),
	},
}));

describe('symbols commands', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: null | number | string) => never);
	});

	describe('symbolListCommand', () => {
		it('should list symbols', async () => {
			mockStorage.getAllSymbols.mockReturnValue([
				{name: 'Apple', symbol: 'AAPL'},
				{name: 'Google', symbol: 'GOOG'},
			]);

			await symbolListCommand('config.jsonc');

			expect(mockStorage.getAllSymbols).toHaveBeenCalled();
		});

		it('should add symbol', async () => {
			mockStorage.symbolExists.mockReturnValue(false);
			mockDataSource.validateSymbol.mockResolvedValue(true);
			mockDataSource.getCurrentQuote.mockResolvedValue({name: 'Apple Inc.'});

			await symbolAddCommand('config.jsonc', 'AAPL');

			expect(mockStorage.saveSymbol).toHaveBeenCalledWith('AAPL', 'Apple Inc.');
			expect(SyncService.syncSymbols).toHaveBeenCalled();
		});

		it('should handle validation failure gracefully', async () => {
			mockStorage.symbolExists.mockReturnValue(false);
			mockDataSource.validateSymbol.mockResolvedValue(false);

			await symbolAddCommand('config.jsonc', 'INVALID');

			expect(mockStorage.saveSymbol).not.toHaveBeenCalled();
		});

		it('should remove symbol', async () => {
			vi.mocked(SymbolService.removeSymbol).mockResolvedValue();

			await symbolRemoveCommand('config.jsonc', 'AAPL');

			expect(SymbolService.removeSymbol).toHaveBeenCalledWith('AAPL');
		});

		it('should add default symbols', async () => {
			mockStorage.symbolExists.mockReturnValue(false);
			vi.mocked(SyncService.syncSymbols).mockResolvedValue();

			await symbolDefaultsCommand('config.jsonc');

			expect(mockStorage.saveSymbol).toHaveBeenCalled();
			expect(SyncService.syncSymbols).toHaveBeenCalled();
		});
	});
});
