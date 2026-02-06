import {beforeEach, describe, expect, it, vi} from 'vitest';

import {SymbolService} from '../../../../src/cli/services/symbol-service.ts';
import {DefaultConfig} from '../../../../src/config/schema.ts';

const mockStorage = {
	deleteSymbol: vi.fn(),
	getAllSymbols: vi.fn(),
};

const mockPersistence = {
	deleteModel: vi.fn(),
};

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function (this: any) {
		return mockStorage;
	}),
}));

vi.mock('../../../../src/compute/persistence.ts', () => ({
	ModelPersistence: vi.fn().mockImplementation(function (this: any) {
		return mockPersistence;
	}),
}));

describe('SymbolService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should remove symbol and its model', async () => {
		mockPersistence.deleteModel.mockResolvedValue(undefined);

		await SymbolService.removeSymbol('AAPL', DefaultConfig, 'data');

		expect(mockStorage.deleteSymbol).toHaveBeenCalledWith('AAPL');
		expect(mockPersistence.deleteModel).toHaveBeenCalledWith('AAPL');
	});

	it('should get all symbols', () => {
		mockStorage.getAllSymbols.mockReturnValue([{name: 'Apple Inc.', symbol: 'AAPL'}]);

		const symbols = SymbolService.getAllSymbols('data');
		expect(symbols).toEqual([{name: 'Apple Inc.', symbol: 'AAPL'}]);
	});
});
