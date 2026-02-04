import {describe, it, expect, vi} from 'vitest';
import {BacktestEngine} from '../../../src/compute/backtest/engine.ts';
import type {Config} from '../../../src/config/schema.ts';
import type {StockDataPoint} from '../../../src/types/index.ts';

describe('BacktestEngine', () => {
	const mockConfig = {
		backtest: {initialCapital: 10000, transactionCost: 0.001},
		model: {windowSize: 10},
		prediction: {buyThreshold: 0.01, sellThreshold: -0.01, minConfidence: 0.5},
	} as unknown as Config;

	const mockPredictionEngine = {
		predict: vi.fn(),
		generateSignal: vi.fn(),
	} as any;

	const historicalData: StockDataPoint[] = Array.from({length: 50}, (_, i) => ({
		date: `2023-01-${(i + 1).toString().padStart(2, '0')}`,
		open: 100 + i,
		high: 105 + i,
		low: 95 + i,
		close: 101 + i,
		adjClose: 101 + i,
		volume: 1000,
	}));

	it('should calculate metrics correctly for a simple profit scenario', async () => {
		const engine = new BacktestEngine(mockConfig, mockPredictionEngine);

		// startIndex = 50 - 20 - 1 = 29
		// We want BUY on day 35 (index 35) and SELL on day 40 (index 40)
		mockPredictionEngine.generateSignal.mockImplementation((pred: any) => {
			if (pred.id === 35) return {action: 'BUY', confidence: 0.8};
			if (pred.id === 40) return {action: 'SELL', confidence: 0.8};
			return {action: 'HOLD', confidence: 0.8};
		});

		mockPredictionEngine.predict.mockImplementation((_m: any, data: any) => {
			return {id: data.length - 1};
		});

		const result = await engine.run('AAPL', {} as any, historicalData, [], 20);

		expect(result.trades.length).toBeGreaterThanOrEqual(1);
		expect(result.totalReturn).toBeDefined();
	});

	it('should handle zero trades gracefully', async () => {
		const engine = new BacktestEngine(mockConfig, mockPredictionEngine);
		mockPredictionEngine.generateSignal.mockReturnValue({action: 'HOLD', confidence: 0.8});

		const result = await engine.run('AAPL', {} as any, historicalData, [], 10);

		expect(result.trades.length).toBe(0);
		expect(result.totalReturn).toBe(0);
	});

	it('should report progress correctly', async () => {
		const engine = new BacktestEngine(mockConfig, mockPredictionEngine);
		mockPredictionEngine.generateSignal.mockReturnValue({action: 'HOLD', confidence: 0.8});

		const onProgress = vi.fn();
		const days = 10;
		await engine.run('AAPL', {} as any, historicalData, [], days, onProgress);

		// With days=10, historicalData.length=50, windowSize=10
		// startIndex = 50 - 10 - 1 = 39
		// Loop from i=39 to i<50 (39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49) -> 11 iterations
		expect(onProgress).toHaveBeenCalled();
		expect(onProgress).toHaveBeenCalledWith(1, 11);
		expect(onProgress).toHaveBeenCalledWith(11, 11);
	});
});
