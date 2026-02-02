import {describe, it, expect, vi, beforeEach} from 'vitest';
import {predictCommand} from '../../../../src/cli/commands/predict.ts';
import {SqliteStorage} from '../../../../src/gather/storage.ts';
import {ModelPersistence} from '../../../../src/compute/persistence.ts';
import {PredictionEngine} from '../../../../src/compute/prediction.ts';
import {HtmlGenerator} from '../../../../src/output/html-generator.ts';

const mockStorage = {
	getAvailableSymbols: vi.fn(),
	getSymbolName: vi.fn(),
	getStockData: vi.fn(),
};

const mockPersistence = {
	loadModel: vi.fn(),
};

vi.mock('../../../../src/compute/persistence.ts', () => ({
	ModelPersistence: vi.fn().mockImplementation(function (this: any) {
		return mockPersistence;
	}),
}));

const mockPredictionEngine = {
	predict: vi.fn().mockResolvedValue({}),
	generateSignal: vi.fn().mockReturnValue({action: 'BUY', confidence: 0.8}),
};

vi.mock('../../../../src/compute/prediction.ts', () => ({
	PredictionEngine: vi.fn().mockImplementation(function (this: any) {
		return mockPredictionEngine;
	}),
}));

const mockHtmlGenerator = {
	generateReport: vi.fn().mockResolvedValue('output/index.html'),
};

vi.mock('../../../../src/output/html-generator.ts', () => ({
	HtmlGenerator: vi.fn().mockImplementation(function (this: any) {
		return mockHtmlGenerator;
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
					model: {windowSize: 10},
					prediction: {days: 30, directory: 'output'},
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

describe('predictCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	it('should generate predictions and report', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockStorage.getSymbolName.mockReturnValue('Apple Inc.');
		mockStorage.getStockData.mockResolvedValue(new Array(100).fill({}));
		mockPersistence.loadModel.mockResolvedValue({});

		await predictCommand('config.yaml');
		expect(mockPredictionEngine.predict).toHaveBeenCalled();
		expect(mockHtmlGenerator.generateReport).toHaveBeenCalled();
	});

	it('should handle specific symbols list', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockStorage.getSymbolName.mockReturnValue('Apple Inc.');
		mockStorage.getStockData.mockResolvedValue(new Array(100).fill({}));
		mockPersistence.loadModel.mockResolvedValue({});

		await predictCommand('config.yaml', false, 'AAPL');
		expect(mockStorage.getStockData).toHaveBeenCalled();
	});

	it('should handle errors in symbol request', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockPersistence.loadModel.mockResolvedValue(null);

		await predictCommand('config.yaml', false, 'AAPL');
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should handle quick-test mode', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL', 'MSFT', 'GOOG', 'TSLA']);
		mockStorage.getSymbolName.mockReturnValue('Company');
		mockStorage.getStockData.mockResolvedValue(new Array(100).fill({}));
		mockPersistence.loadModel.mockResolvedValue({});

		await predictCommand('config.yaml', true);
		// Should only process 3 symbols
		expect(mockStorage.getStockData).toHaveBeenCalledTimes(3);
	});
});
