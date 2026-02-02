import {describe, it, expect, vi, beforeEach} from 'vitest';
import {trainCommand} from '../../../../src/cli/commands/train.ts';
import {SqliteStorage} from '../../../../src/gather/storage.ts';
import {LstmModel} from '../../../../src/compute/lstm-model.ts';
import {ModelPersistence} from '../../../../src/compute/persistence.ts';

const mockStorage = {
	getAvailableSymbols: vi.fn(),
	getSymbolName: vi.fn(),
	getStockData: vi.fn(),
};

const mockPersistence = {
	saveModel: vi.fn(),
};

vi.mock('../../../../src/compute/lstm-model.ts', () => ({
	LstmModel: vi.fn().mockImplementation(function (this: any) {
		return {
			train: vi.fn().mockImplementation((_data, _config, onProgress) => {
				if (onProgress) onProgress(1, 0.1);
				return Promise.resolve({});
			}),
			evaluate: vi.fn().mockResolvedValue({isValid: true, loss: 0.01}),
			getMetadata: vi.fn().mockReturnValue({}),
			getModel: vi.fn().mockReturnValue({}),
		};
	}),
}));

vi.mock('../../../../src/compute/persistence.ts', () => ({
	ModelPersistence: vi.fn().mockImplementation(function (this: any) {
		return mockPersistence;
	}),
}));

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function (this: any) {
		return mockStorage;
	}),
}));

vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		await handler(
			{
				config: {
					model: {windowSize: 30, epochs: 50},
				},
				startTime: Date.now(),
			},
			commandOptions,
		);
	}),
}));

vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		log: vi.fn(),
		error: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			fail: vi.fn().mockReturnThis(),
			warn: vi.fn().mockReturnThis(),
			text: '',
		}),
	},
}));

describe('trainCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	it('should train models for available symbols', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL', 'MSFT', 'GOOG']);
		mockStorage.getSymbolName.mockReturnValue('Company');
		mockStorage.getStockData
			.mockResolvedValueOnce(new Array(100).fill({})) // AAPL
			.mockResolvedValueOnce(new Array(5).fill({})) // MSFT (insufficient)
			.mockResolvedValueOnce(new Array(100).fill({})); // GOOG

		await trainCommand('config.yaml');
		expect(LstmModel).toHaveBeenCalled();
		expect(mockPersistence.saveModel).toHaveBeenCalled();
	});

	it('should handle specific symbols list', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockStorage.getSymbolName.mockReturnValue('Apple Inc.');
		mockStorage.getStockData.mockResolvedValue(new Array(100).fill({}));

		await trainCommand('config.yaml', false, 'AAPL');
		expect(mockStorage.getStockData).toHaveBeenCalled();
	});

	it('should throw error if requested symbol has no data', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue([]);

		await trainCommand('config.yaml', false, 'AAPL');
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should handle quick-test mode', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL', 'MSFT', 'GOOG', 'TSLA']);
		mockStorage.getSymbolName.mockReturnValue('Company');
		mockStorage.getStockData.mockResolvedValue(new Array(100).fill({}));

		await trainCommand('config.yaml', true);
		// Should only process 3 symbols
		expect(mockStorage.getStockData).toHaveBeenCalledTimes(3);
	});
});
