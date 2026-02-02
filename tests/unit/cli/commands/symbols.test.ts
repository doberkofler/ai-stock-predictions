import {describe, it, expect, vi, beforeEach} from 'vitest';
import {symbolAddCommand, symbolRemoveCommand, symbolDefaultsCommand, symbolListCommand} from '../../../../src/cli/commands/symbols.ts';
import {SqliteStorage} from '../../../../src/gather/storage.ts';
import {YahooFinanceDataSource} from '../../../../src/gather/yahoo-finance.ts';
import {ModelPersistence} from '../../../../src/compute/persistence.ts';
import {SyncService} from '../../../../src/cli/services/sync-service.ts';
import {SymbolService} from '../../../../src/cli/services/symbol-service.ts';

const mockStorage = {
	symbolExists: vi.fn(),
	saveSymbol: vi.fn(),
	getSymbolName: vi.fn(),
	getAllSymbols: vi.fn(),
	getQuoteCount: vi.fn(),
	getDataTimestamp: vi.fn(),
	getAvailableSymbols: vi.fn(),
};

const mockDataSource = {
	validateSymbol: vi.fn(),
	getCurrentQuote: vi.fn(),
};

const mockPersistence = {
	getModelMetadata: vi.fn(),
	deleteModel: vi.fn(),
};

vi.mock('../../../../src/gather/storage.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/gather/storage.ts')>();
	return {
		...actual,
		SqliteStorage: vi.fn().mockImplementation(function (this: any) {
			return mockStorage;
		}),
	};
});

vi.mock('../../../../src/gather/yahoo-finance.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/gather/yahoo-finance.ts')>();
	return {
		...actual,
		YahooFinanceDataSource: vi.fn().mockImplementation(function (this: any) {
			return mockDataSource;
		}),
	};
});

vi.mock('../../../../src/compute/persistence.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/compute/persistence.ts')>();
	return {
		...actual,
		ModelPersistence: vi.fn().mockImplementation(function (this: any) {
			return mockPersistence;
		}),
	};
});

vi.mock('../../../../src/cli/services/sync-service.ts', () => ({
	SyncService: {
		syncSymbols: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('../../../../src/cli/services/symbol-service.ts', () => ({
	SymbolService: {
		removeSymbol: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		await handler({config: {dataSource: {}}, startTime: Date.now()}, commandOptions);
	}),
}));

// Mock UI
vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		log: vi.fn(),
		error: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			fail: vi.fn().mockReturnThis(),
			info: vi.fn().mockReturnThis(),
			text: '',
		}),
	},
}));

describe('Symbol Commands', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('symbolAddCommand', () => {
		it('should add a new symbol and trigger sync', async () => {
			mockStorage.symbolExists.mockReturnValue(false);
			mockStorage.getSymbolName.mockReturnValue('Apple Inc.');
			mockDataSource.validateSymbol.mockResolvedValue(true);
			mockDataSource.getCurrentQuote.mockResolvedValue({name: 'Apple Inc.'});

			await symbolAddCommand('config.yaml', 'AAPL');

			expect(mockStorage.saveSymbol).toHaveBeenCalledWith('AAPL', 'Apple Inc.');
			expect(SyncService.syncSymbols).toHaveBeenCalled();
		});

		it('should handle existing symbols', async () => {
			mockStorage.symbolExists.mockReturnValue(true);
			mockStorage.getSymbolName.mockReturnValue('Apple Inc.');

			await symbolAddCommand('config.yaml', 'AAPL');

			expect(SyncService.syncSymbols).toHaveBeenCalledWith([{name: 'Apple Inc.', symbol: 'AAPL'}], expect.any(Object));
		});

		it('should handle invalid symbols', async () => {
			mockStorage.symbolExists.mockReturnValue(false);
			mockDataSource.validateSymbol.mockResolvedValue(false);

			await symbolAddCommand('config.yaml', 'INVALID');
			expect(mockStorage.saveSymbol).not.toHaveBeenCalled();
		});
	});

	describe('symbolRemoveCommand', () => {
		it('should remove a symbol', async () => {
			await symbolRemoveCommand('config.yaml', 'AAPL');
			expect(SymbolService.removeSymbol).toHaveBeenCalledWith('AAPL');
		});
	});

	describe('symbolDefaultsCommand', () => {
		it('should add default symbols and sync', async () => {
			mockStorage.symbolExists.mockReturnValue(false);

			await symbolDefaultsCommand('config.yaml');

			expect(mockStorage.saveSymbol).toHaveBeenCalled();
			expect(SyncService.syncSymbols).toHaveBeenCalled();
		});
	});

	describe('symbolListCommand', () => {
		it('should list symbols', async () => {
			mockStorage.getAllSymbols.mockReturnValue([{symbol: 'AAPL', name: 'Apple Inc.'}]);
			mockStorage.getQuoteCount.mockReturnValue(100);
			mockStorage.getDataTimestamp.mockResolvedValue(new Date());
			mockPersistence.getModelMetadata.mockResolvedValue({trainedAt: new Date(), loss: 0.01});

			await symbolListCommand('config.yaml');

			expect(mockStorage.getAllSymbols).toHaveBeenCalled();
		});

		it('should handle empty portfolio', async () => {
			mockStorage.getAllSymbols.mockReturnValue([]);
			await symbolListCommand('config.yaml');
			expect(mockStorage.getAllSymbols).toHaveBeenCalled();
		});
	});
});
