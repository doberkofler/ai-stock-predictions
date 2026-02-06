import {describe, it, expect, vi, beforeEach} from 'vitest';
import {backtestCommand} from '../../../src/cli/commands/backtest.ts';
import {runCommand} from '../../../src/cli/utils/runner.ts';
import {SqliteStorage} from '../../../src/gather/storage.ts';
import {ModelPersistence} from '../../../src/compute/persistence.ts';
import {BacktestEngine} from '../../../src/compute/backtest/engine.ts';
import {ui} from '../../../src/cli/utils/ui.ts';

vi.mock('../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn((_opts, handler) =>
		handler({
			config: {
				storage: {dataDirectory: 'test-data'},
				model: {windowSize: 10},
			},
		}),
	),
}));

vi.mock('../../../src/gather/storage.ts', () => {
	const SqliteStorage = vi.fn();
	SqliteStorage.prototype.getAvailableSymbols = vi.fn().mockResolvedValue(['AAPL']);
	SqliteStorage.prototype.getStockData = vi.fn().mockResolvedValue(Array(50).fill({close: 100}));
	SqliteStorage.prototype.getMarketFeatures = vi.fn().mockReturnValue([]);
	return {SqliteStorage};
});

vi.mock('../../../src/compute/persistence.ts', () => {
	const ModelPersistence = vi.fn();
	ModelPersistence.prototype.loadModel = vi.fn().mockResolvedValue({});
	return {ModelPersistence};
});

vi.mock('../../../src/compute/backtest/engine.ts', () => {
	const BacktestEngine = vi.fn();
	BacktestEngine.prototype.run = vi.fn().mockResolvedValue({
		totalReturn: 0.1,
		benchmarkReturn: 0.05,
		alpha: 0.05,
		drawdown: 0.02,
		winRate: 0.6,
		sharpeRatio: 1.5,
		trades: [],
		finalValue: 1100,
	});
	return {BacktestEngine};
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

describe('backtestCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should run backtest for provided symbols', async () => {
		await backtestCommand('config.json', 'AAPL');

		expect(runCommand).toHaveBeenCalled();
		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('Results for AAPL'));
	});

	it('should use available symbols if none provided', async () => {
		await backtestCommand('config.json');
		expect(SqliteStorage.prototype.getAvailableSymbols).toHaveBeenCalled();
	});

	it('should handle missing model', async () => {
		vi.mocked(ModelPersistence.prototype.loadModel).mockResolvedValueOnce(null);

		await backtestCommand('config.json', 'AAPL');
		// Should not call backtestEngine.run
		expect(BacktestEngine.prototype.run).not.toHaveBeenCalled();
	});
});
