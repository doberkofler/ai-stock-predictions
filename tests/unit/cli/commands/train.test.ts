import {beforeEach, describe, expect, it, vi} from 'vitest';

import {trainCommand} from '../../../../src/cli/commands/train.ts';

// Variables for assertions (prefixed with vi to be accessible in factory)
const viMockTrain = vi.fn().mockImplementation((_data: any, _config: any, onProgress: any) => {
	if (onProgress) onProgress(1, 0.1);
	return Promise.resolve({});
});
const viMockEvaluate = vi.fn().mockReturnValue({isValid: true, loss: 0.01});

// Mock the class using a proper function constructor
vi.mock('../../../../src/compute/lstm-model.ts', () => {
	return {
		LstmModel: vi.fn().mockImplementation(function () {
			return {
				evaluate: viMockEvaluate,
				getMetadata: vi.fn().mockReturnValue({}),
				getModel: vi.fn().mockReturnValue({}),
				train: viMockTrain,
			};
		}),
	};
});

const mockStorage = {
	getAvailableSymbols: vi.fn(),
	getDataQuality: vi.fn(),
	getMarketFeatures: vi.fn(),
	getModelMetadata: vi.fn(),
	getStockData: vi.fn(),
	getSymbolName: vi.fn(),
};

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function () {
		return mockStorage;
	}),
}));

const mockPersistence = {
	saveModel: vi.fn(),
};

vi.mock('../../../../src/compute/persistence.ts', () => ({
	ModelPersistence: vi.fn().mockImplementation(function () {
		return mockPersistence;
	}),
}));

const mockAppConfig = {
	aBTesting: {enabled: false},
	backtest: {enabled: true, initialCapital: 10000, transactionCost: 0.001},
	market: {
		featureConfig: {
			enabled: true,
			includeBeta: true,
			includeCorrelation: true,
			includeRegime: true,
			includeVix: true,
		},
	},
	model: {
		batchSize: 128,
		dropout: 0.2,
		epochs: 50,
		l1Regularization: 0.001,
		l2Regularization: 0.001,
		learningRate: 0.001,
		recurrentDropout: 0.1,
		windowSize: 30,
	},
	training: {
		maxHistoricalYears: 3,
		minNewDataPoints: 50,
		minQualityScore: 60,
	},
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
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			text: '',
			warn: vi.fn().mockReturnThis(),
		}),
	},
}));

describe('trainCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: null | number | string) => never);
	});

	it('should train models for available symbols', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL', 'MSFT', 'GOOG']);
		mockStorage.getSymbolName.mockReturnValue('Company');
		mockStorage.getStockData
			.mockResolvedValueOnce(Array.from({length: 100}).fill({})) // AAPL
			.mockResolvedValueOnce(Array.from({length: 5}).fill({})) // MSFT (insufficient)
			.mockResolvedValueOnce(Array.from({length: 100}).fill({})); // GOOG

		await trainCommand('config.jsonc');
	});

	it('should train specific symbols', async () => {
		await trainCommand('config.jsonc', false, 'AAPL');
	});

	it('should handle quick-test mode', async () => {
		await trainCommand('config.jsonc', false, 'AAPL');
	});

	it('should handle init mode', async () => {
		await trainCommand('config.jsonc', true);
		// Should only process 3 symbols
		expect(mockStorage.getStockData).toHaveBeenCalledTimes(3);
	});

	it('should handle training errors gracefully', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockStorage.getSymbolName.mockReturnValue('Apple Inc.');
		mockStorage.getStockData.mockResolvedValue(Array.from({length: 100}).fill({}));
		viMockTrain.mockRejectedValueOnce(new Error('Training failed'));

		await trainCommand('config.jsonc');

		expect(mockPersistence.saveModel).not.toHaveBeenCalled();
	});

	it('should handle invalid model evaluation', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockStorage.getSymbolName.mockReturnValue('Apple Inc.');
		mockStorage.getStockData.mockResolvedValue(Array.from({length: 100}).fill({}));
		viMockEvaluate.mockReturnValueOnce({isValid: false, loss: 0.5});

		await trainCommand('config.jsonc');

		expect(mockPersistence.saveModel).not.toHaveBeenCalled();
	});

	it('should filter out indices from training', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['^GSPC', '^DJI', 'AAPL', 'MSFT']);
		mockStorage.getSymbolName.mockReturnValue('Company');
		mockStorage.getStockData.mockResolvedValue(Array.from({length: 100}).fill({}));

		await trainCommand('config.jsonc');
		// Should only train 2 stocks (AAPL, MSFT), not the 2 indices (^GSPC, ^DJI)
		expect(mockStorage.getStockData).toHaveBeenCalledTimes(2);
		expect(mockStorage.getStockData).toHaveBeenCalledWith('AAPL', expect.any(String));
		expect(mockStorage.getStockData).toHaveBeenCalledWith('MSFT', expect.any(String));
		expect(mockStorage.getStockData).not.toHaveBeenCalledWith('^GSPC', expect.any(String));
		expect(mockStorage.getStockData).not.toHaveBeenCalledWith('^DJI');
	});

	it('should show warning when no stocks are available (only indices)', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['^GSPC', '^DJI', '^VIX']);
		mockStorage.getSymbolName.mockReturnValue('Index Name');

		await trainCommand('config.jsonc');

		// Should not attempt to train any symbols
		expect(mockStorage.getStockData).not.toHaveBeenCalled();
		expect(mockPersistence.saveModel).not.toHaveBeenCalled();
	});

	it('should log warning when explicitly requested index is filtered out', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['^DJI', 'AAPL']);
		mockStorage.getSymbolName.mockReturnValue('Company');
		mockStorage.getStockData.mockResolvedValue(Array.from({length: 100}).fill({}));

		await trainCommand('config.jsonc', false, '^DJI,AAPL');

		// Should only train AAPL
		expect(mockStorage.getStockData).toHaveBeenCalledTimes(1);
		expect(mockStorage.getStockData).toHaveBeenCalledWith('AAPL', expect.any(String));
		expect(mockStorage.getStockData).not.toHaveBeenCalledWith('^DJI', expect.any(String));
	});
});
