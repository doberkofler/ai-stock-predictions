import {describe, it, expect, vi, beforeEach} from 'vitest';
import {tuneCommand} from '../../../src/cli/commands/tune.ts';
import {runCommand} from '../../../src/cli/utils/runner.ts';
import {SqliteStorage} from '../../../src/gather/storage.ts';
import {HyperparameterTuner} from '../../../src/compute/tuner.ts';
import {ui} from '../../../src/cli/utils/ui.ts';

vi.mock('../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn((_opts, handler) =>
		handler({
			config: {
				storage: {dataDirectory: 'test-data'},
				market: {featureConfig: {enabled: false}},
			},
		}),
	),
}));

vi.mock('../../../src/gather/storage.ts', () => {
	const SqliteStorage = vi.fn();
	SqliteStorage.prototype.symbolExists = vi.fn().mockReturnValue(true);
	SqliteStorage.prototype.getSymbolName = vi.fn().mockReturnValue('Apple Inc.');
	SqliteStorage.prototype.getStockData = vi.fn().mockResolvedValue(Array(300).fill({close: 100}));
	SqliteStorage.prototype.getMarketFeatures = vi.fn().mockReturnValue([]);
	return {SqliteStorage};
});

vi.mock('../../../src/compute/tuner.ts', () => {
	const HyperparameterTuner = vi.fn();
	HyperparameterTuner.prototype.tune = vi.fn().mockResolvedValue({
		params: {
			architecture: 'lstm',
			windowSize: 10,
			learningRate: 0.001,
			batchSize: 32,
			epochs: 50,
		},
		mape: 0.05,
		valLoss: 0.01,
		duration: 1000,
	});
	return {HyperparameterTuner};
});

vi.mock('../../../src/cli/utils/ui.ts', () => ({
	ui: {
		log: vi.fn(),
		error: vi.fn(),
		spinner: vi.fn(() => ({
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			fail: vi.fn().mockReturnThis(),
			warn: vi.fn().mockReturnThis(),
		})),
	},
}));

describe('tuneCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should run tuning for a valid symbol', async () => {
		await tuneCommand('config.json', 'AAPL');

		expect(runCommand).toHaveBeenCalled();
		expect(HyperparameterTuner.prototype.tune).toHaveBeenCalled();
		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('Best Configuration Found'));
	});

	it('should throw error if symbol does not exist', async () => {
		vi.mocked(SqliteStorage.prototype.symbolExists).mockReturnValueOnce(false);

		await expect(tuneCommand('config.json', 'INVALID')).rejects.toThrow('Symbol INVALID not found');
	});

	it('should throw error if insufficient data', async () => {
		vi.mocked(SqliteStorage.prototype.getStockData).mockResolvedValueOnce(Array(100).fill({close: 100}));

		await expect(tuneCommand('config.json', 'AAPL')).rejects.toThrow('Insufficient data');
	});
});
