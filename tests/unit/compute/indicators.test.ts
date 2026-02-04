import {describe, expect, it} from 'vitest';

import {calculateOBV, calculateReturns, calculateRsi, calculateSma, calculateVolumeMA, calculateVolumeRatio} from '../../../src/compute/indicators.ts';

describe('calculateReturns', () => {
	it('should calculate returns correctly', () => {
		const prices = [100, 110, 121];
		const returns = calculateReturns(prices);

		expect(returns).toHaveLength(3);
		expect(returns[0]).toBe(0);
		expect(returns[1]).toBeCloseTo(0.1, 5);
		expect(returns[2]).toBeCloseTo(0.1, 5);
	});

	it('should handle zero previous price', () => {
		const prices = [0, 10, 20];
		const returns = calculateReturns(prices);

		expect(returns[0]).toBe(0);
		expect(returns[1]).toBe(0); // prev === 0, so return 0
		expect(returns[2]).toBe(1);
	});

	it('should handle single price', () => {
		const prices = [100];
		const returns = calculateReturns(prices);

		expect(returns).toHaveLength(1);
		expect(returns[0]).toBe(0);
	});
});

describe('calculateRsi', () => {
	it('should calculate RSI correctly', () => {
		const prices = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46];
		const rsi = calculateRsi(prices, 14);

		expect(rsi).toHaveLength(16);
		expect(rsi[0]).toBe(50); // Neutral starting point
		expect(rsi.at(-1)).toBeGreaterThan(0);
		expect(rsi.at(-1)).toBeLessThan(100);
	});

	it('should handle constant gains (avgLoss === 0)', () => {
		// Create 16 prices with consistent gains
		const prices = Array.from({length: 16}, (_, i) => 100 + i * 10);
		const rsi = calculateRsi(prices, 14);

		expect(rsi).toHaveLength(16);
		expect(rsi[15]).toBeGreaterThan(98); // avgLoss very small, so RSI should be near 100
	});

	it('should handle constant losses', () => {
		// Create 16 prices with consistent losses
		const prices = Array.from({length: 16}, (_, i) => 200 - i * 10);
		const rsi = calculateRsi(prices, 14);

		expect(rsi).toHaveLength(16);
		expect(rsi[15]).toBeCloseTo(0, 1); // avgGain === 0, so RSI should be near 0
	});

	it('should handle custom period', () => {
		const prices = [100, 105, 103, 107, 110, 108, 112, 115];
		const rsi = calculateRsi(prices, 5);

		expect(rsi).toHaveLength(8);
		expect(rsi[0]).toBe(50);
	});
});

describe('calculateSma', () => {
	it('should calculate SMA correctly', () => {
		const prices = [10, 20, 30, 40, 50];
		const sma = calculateSma(prices, 3);

		expect(sma).toHaveLength(5);
		expect(sma[0]).toBe(10); // Before period
		expect(sma[1]).toBe(20); // Before period
		expect(sma[2]).toBe(20); // (10 + 20 + 30) / 3
		expect(sma[3]).toBe(30); // (20 + 30 + 40) / 3
		expect(sma[4]).toBe(40); // (30 + 40 + 50) / 3
	});

	it('should handle period equal to array length', () => {
		const prices = [10, 20, 30];
		const sma = calculateSma(prices, 3);

		expect(sma).toHaveLength(3);
		expect(sma[2]).toBe(20); // (10 + 20 + 30) / 3
	});

	it('should handle period of 1', () => {
		const prices = [10, 20, 30];
		const sma = calculateSma(prices, 1);

		expect(sma).toHaveLength(3);
		expect(sma[0]).toBe(10);
		expect(sma[1]).toBe(20);
		expect(sma[2]).toBe(30);
	});

	it('should handle large period', () => {
		const prices = [10, 20, 30];
		const sma = calculateSma(prices, 20);

		expect(sma).toHaveLength(3);
		expect(sma[0]).toBe(10); // All values before period
		expect(sma[1]).toBe(20);
		expect(sma[2]).toBe(30);
	});
});

describe('calculateVolumeMA', () => {
	it('should calculate Volume MA correctly with default period', () => {
		const volumes = Array.from({length: 25}, (_, i) => 1000 + i * 100);
		const vma = calculateVolumeMA(volumes);

		expect(vma).toHaveLength(25);
		// Before period (first 19 values)
		for (let i = 0; i < 19; i++) {
			expect(vma[i]).toBe(volumes[i]);
		}
		// After period (20-day MA)
		// Average of volumes[0] to volumes[19]: (1000 + 1100 + ... + 2900) / 20
		const sum = Array.from({length: 20}, (_, i) => 1000 + i * 100).reduce((a, b) => a + b, 0);
		expect(vma[19]).toBe(sum / 20);
	});

	it('should calculate Volume MA with custom period', () => {
		const volumes = [100, 200, 300, 400, 500];
		const vma = calculateVolumeMA(volumes, 3);

		expect(vma).toHaveLength(5);
		expect(vma[0]).toBe(100); // Before period
		expect(vma[1]).toBe(200); // Before period
		expect(vma[2]).toBe(200); // (100 + 200 + 300) / 3
		expect(vma[3]).toBe(300); // (200 + 300 + 400) / 3
		expect(vma[4]).toBe(400); // (300 + 400 + 500) / 3
	});

	it('should handle period equal to array length', () => {
		const volumes = [100, 200, 300];
		const vma = calculateVolumeMA(volumes, 3);

		expect(vma).toHaveLength(3);
		expect(vma[2]).toBe(200); // (100 + 200 + 300) / 3
	});
});

describe('calculateVolumeRatio', () => {
	it('should calculate volume ratio correctly', () => {
		const volumes = Array.from({length: 25}, () => 1000);
		volumes[24] = 2000; // Last day has 2x volume
		const ratio = calculateVolumeRatio(volumes);

		expect(ratio).toHaveLength(25);
		// MA of last 20 days includes 19 days of 1000 and 1 day of 2000
		// MA = (19 * 1000 + 2000) / 20 = 21000 / 20 = 1050
		// Ratio = 2000 / 1050 = 1.904...
		expect(ratio[24]).toBeCloseTo(1.905, 2);
	});

	it('should handle volume surge (>2.0)', () => {
		const volumes = Array.from({length: 25}, () => 1000);
		volumes[24] = 3000; // Last day has 3x volume
		const ratio = calculateVolumeRatio(volumes);

		// MA = (19 * 1000 + 3000) / 20 = 22000 / 20 = 1100
		// Ratio = 3000 / 1100 = 2.727...
		expect(ratio[24]).toBeCloseTo(2.727, 2);
	});

	it('should handle low volume (<0.5)', () => {
		const volumes = Array.from({length: 25}, () => 1000);
		volumes[24] = 400; // Last day has 0.4x volume
		const ratio = calculateVolumeRatio(volumes);

		expect(ratio[24]).toBeCloseTo(0.4, 1);
	});

	it('should handle zero volume average (edge case)', () => {
		const volumes = Array.from({length: 25}, () => 0);
		volumes[24] = 100;
		const ratio = calculateVolumeRatio(volumes);

		// MA of last 20 days = (19 * 0 + 100) / 20 = 5
		// Ratio = 100 / 5 = 20
		expect(ratio[24]).toBe(20);
	});

	it('should handle division by zero in moving average', () => {
		const volumes = [0, 0, 0];
		const ratio = calculateVolumeRatio(volumes);

		expect(ratio).toHaveLength(3);
		expect(ratio[2]).toBe(1); // 0 / 0 handled as 1
	});
});

describe('calculateOBV', () => {
	it('should calculate OBV correctly with price increases', () => {
		const prices = [100, 105, 110, 115];
		const volumes = [1000, 1500, 2000, 2500];
		const obv = calculateOBV(prices, volumes);

		expect(obv).toHaveLength(4);
		expect(obv[0]).toBe(0); // Initial OBV
		expect(obv[1]).toBe(1500); // Price up: 0 + 1500
		expect(obv[2]).toBe(3500); // Price up: 1500 + 2000
		expect(obv[3]).toBe(6000); // Price up: 3500 + 2500
	});

	it('should calculate OBV correctly with price decreases', () => {
		const prices = [100, 95, 90, 85];
		const volumes = [1000, 1500, 2000, 2500];
		const obv = calculateOBV(prices, volumes);

		expect(obv).toHaveLength(4);
		expect(obv[0]).toBe(0); // Initial OBV
		expect(obv[1]).toBe(-1500); // Price down: 0 - 1500
		expect(obv[2]).toBe(-3500); // Price down: -1500 - 2000
		expect(obv[3]).toBe(-6000); // Price down: -3500 - 2500
	});

	it('should calculate OBV correctly with mixed price movements', () => {
		const prices = [100, 105, 105, 102, 108];
		const volumes = [1000, 1500, 2000, 2500, 3000];
		const obv = calculateOBV(prices, volumes);

		expect(obv).toHaveLength(5);
		expect(obv[0]).toBe(0); // Initial OBV
		expect(obv[1]).toBe(1500); // Price up: 0 + 1500
		expect(obv[2]).toBe(1500); // Price unchanged: 1500 + 0
		expect(obv[3]).toBe(-1000); // Price down: 1500 - 2500
		expect(obv[4]).toBe(2000); // Price up: -1000 + 3000
	});

	it('should handle single price point', () => {
		const prices = [100];
		const volumes = [1000];
		const obv = calculateOBV(prices, volumes);

		expect(obv).toHaveLength(1);
		expect(obv[0]).toBe(0); // Initial OBV
	});

	it('should handle no price change', () => {
		const prices = [100, 100, 100];
		const volumes = [1000, 1500, 2000];
		const obv = calculateOBV(prices, volumes);

		expect(obv).toHaveLength(3);
		expect(obv[0]).toBe(0);
		expect(obv[1]).toBe(0); // No change
		expect(obv[2]).toBe(0); // No change
	});
});
