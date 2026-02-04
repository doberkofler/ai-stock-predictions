import {describe, expect, it} from 'vitest';

import {calculateReturns, calculateRsi, calculateSma} from '../../../src/compute/indicators.ts';

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
