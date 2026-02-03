import {beforeEach, describe, expect, it, vi} from 'vitest';

import {predictCommand} from '../../../../src/cli/commands/predict.ts';

const mockStorage = {
	getAvailableSymbols: vi.fn(),
	getMarketFeatures: vi.fn(),
	getStockData: vi.fn(),
	getSymbolName: vi.fn(),
};

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function () {
		return mockStorage;
	}),
}));

const mockPersistence = {
	loadModel: vi.fn(),
};

vi.mock('../../../../src/compute/persistence.ts', () => ({
	ModelPersistence: vi.fn().mockImplementation(function () {
		return mockPersistence;
	}),
}));

const viMockPredict = vi.fn().mockResolvedValue({});
const viMockGenerateSignal = vi.fn().mockReturnValue({action: 'BUY', confidence: 0.8});

vi.mock('../../../../src/compute/prediction.ts', () => ({
	PredictionEngine: vi.fn().mockImplementation(function () {
		return {
			generateSignal: viMockGenerateSignal,
			predict: viMockPredict,
		};
	}),
}));

const viMockGenerateReport = vi.fn().mockResolvedValue('output/index.html');

vi.mock('../../../../src/output/html-generator.ts', () => ({
	HtmlGenerator: vi.fn().mockImplementation(function () {
		return {
			generateReport: viMockGenerateReport,
		};
	}),
}));

const mockAppConfig = {
	aBTesting: {enabled: false},
	market: {
		featureConfig: {
			enabled: true,
			includeBeta: true,
			includeCorrelation: true,
			includeRegime: true,
			includeVix: true,
		},
		indices: [],
	},
	model: {learningRate: 0.001, windowSize: 10},
	prediction: {days: 30, directory: 'output'},
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

describe('predictCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: null | number | string) => never);
	});

	it('should generate predictions and report', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockStorage.getSymbolName.mockReturnValue('Apple Inc.');
		mockStorage.getStockData.mockResolvedValue(Array.from({length: 100}).fill({}));
		mockPersistence.loadModel.mockResolvedValue({});

		await predictCommand('config.jsonc');
	});

	it('should predict specific symbols', async () => {
		await predictCommand('config.jsonc', false, 'AAPL');
	});

	it('should handle errors in symbol request', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL']);
		mockPersistence.loadModel.mockResolvedValue(null);

		await predictCommand('config.jsonc', false, 'AAPL');
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should handle quick-test mode', async () => {
		mockStorage.getAvailableSymbols.mockResolvedValue(['AAPL', 'MSFT', 'GOOG', 'TSLA']);
		mockStorage.getSymbolName.mockReturnValue('Company');
		mockStorage.getStockData.mockResolvedValue(Array.from({length: 100}).fill({}));
		mockPersistence.loadModel.mockResolvedValue({});

		await predictCommand('config.jsonc', true);
		// Should only process 3 symbols
		expect(mockStorage.getStockData).toHaveBeenCalledTimes(3);
	});

	it('should handle init mode', async () => {
		await predictCommand('config.jsonc', true);
		// Should only process 3 symbols
		expect(mockStorage.getStockData).toHaveBeenCalledTimes(3);
	});
});
