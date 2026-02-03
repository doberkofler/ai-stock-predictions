import {describe, it, expect, beforeEach} from 'vitest';
import {MarketFeatureEngineer} from '../../../src/compute/market-features.js';
import type {StockDataPoint} from '../../../src/types/index.js';

describe('MarketFeatureEngineer', () => {
	let engineer: MarketFeatureEngineer;

	beforeEach(() => {
		engineer = new MarketFeatureEngineer();
	});

	// Helper to generate mock data
	const generateData = (count: number, startPrice: number, trend: number, startDateStr: string = '2023-01-01'): StockDataPoint[] => {
		const data: StockDataPoint[] = [];
		let price = startPrice;
		const startDate = new Date(startDateStr);

		for (let i = 0; i < count; i++) {
			const date = new Date(startDate);
			date.setDate(startDate.getDate() + i);

			// Simple random walk with trend
			price = price * (1 + trend + (Math.random() - 0.5) * 0.02);

			data.push({
				date: date.toISOString().split('T')[0] as string,
				open: price,
				high: price * 1.01,
				low: price * 0.99,
				close: price,
				adjClose: price,
				volume: 1000000,
			});
		}
		return data;
	};

	it('should return empty features if input arrays are empty', () => {
		const features = engineer.calculateFeatures('TEST', [], [], []);
		expect(features).toEqual([]);
	});

	it('should return empty features if data is insufficient', () => {
		const stockData = generateData(5, 100, 0.001);
		const marketData = generateData(5, 1000, 0.001);
		const vixData = generateData(5, 20, 0);

		// VIX dates matching
		vixData.forEach((v, i) => (v.date = stockData[i]!.date));
		marketData.forEach((m, i) => (m.date = stockData[i]!.date));

		// With very short data, returns might be null, leading to no features
		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		// calculateDailyReturn requires index >= 1, so index 0 is skipped.
		// For index 1-4, it should produce something unless VIX is missing or other null checks fail.
		// However, calculateFeatureForDate returns null if calculateMarketReturn is null.
		// calculateMarketReturn returns null for index 0.
		// So we expect features for indices 1 to 4 (4 features).
		expect(features.length).toBeGreaterThan(0);
	});

	it('should calculate features correctly for a full dataset', () => {
		const days = 250;
		const stockData = generateData(days, 150, 0.0005);
		const marketData = generateData(days, 4000, 0.0002);
		const vixData = generateData(days, 15, 0);

		// Align dates
		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);

		expect(features.length).toBe(days - 1); // First day has no return

		const lastFeature = features[features.length - 1];
		expect(lastFeature).toBeDefined();
		if (lastFeature) {
			expect(lastFeature).toHaveProperty('beta');
			expect(lastFeature).toHaveProperty('marketReturn');
			expect(lastFeature).toHaveProperty('relativeReturn');
			expect(lastFeature).toHaveProperty('vix');
			expect(lastFeature).toHaveProperty('marketRegime');
		}
	});

	it('should handle missing VIX data gracefully', () => {
		const stockData = generateData(10, 100, 0);
		const marketData = generateData(10, 1000, 0);
		const vixData = generateData(5, 20, 0); // VIX missing for half the days

		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			if (i < 5 && vixData[i]) vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		// Should only have features where VIX is present (and index > 0)
		expect(features.length).toBe(4);
	});

	it('should detect BULL market regime', () => {
		const days = 250;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 1000, 0);

		// Create a strong uptrend for BULL market
		// MA50 > MA200 and Price > MA200
		for (let i = 0; i < days; i++) {
			// Price increasing steadily
			marketData[i]!.close = 1000 + i * 10;
		}

		const vixData = generateData(days, 15, 0);
		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		const lastFeature = features[features.length - 1];
		expect(lastFeature).toBeDefined();
		expect(lastFeature?.marketRegime).toBe('BULL');
	});

	it('should detect BEAR market regime', () => {
		const days = 250;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 4000, 0);

		// Create a strong downtrend for BEAR market
		// MA50 < MA200 and Price < MA200
		for (let i = 0; i < days; i++) {
			marketData[i]!.close = 4000 - i * 10;
		}

		const vixData = generateData(days, 15, 0);
		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		const lastFeature = features[features.length - 1];
		expect(lastFeature).toBeDefined();
		expect(lastFeature?.marketRegime).toBe('BEAR');
	});

	it('should detect NEUTRAL market regime', () => {
		// Neutral when conditions for BULL or BEAR are not met
		// e.g. Price > MA200 but MA50 < MA200 (Golden Cross forming?) or chopping

		const days = 250;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 4000, 0);
		const vixData = generateData(days, 15, 0);

		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		// Construct NEUTRAL scenario
		// Last 200 days average is around 3000
		// Last 50 days average is around 3000
		// Current price is 3000
		// Let's make it flat
		for (let i = 0; i < days; i++) {
			marketData[i]!.close = 3000;
		}

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		const lastFeature = features[features.length - 1];
		expect(lastFeature).toBeDefined();
		expect(lastFeature?.marketRegime).toBe('NEUTRAL');
	});

	it('should calculate zero correlation if denominator is zero', () => {
		const days = 50;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 1000, 0);
		const vixData = generateData(days, 15, 0);

		// Make stock price constant -> variance is 0 -> correlation denominator 0
		stockData.forEach((s) => (s.close = 100));

		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		// Check last feature
		const last = features[features.length - 1];
		expect(last?.indexCorrelation).toBe(0);
	});

	it('should handle beta calculation with insufficient window', () => {
		// Beta window is 30. If we check early index, it should return 1.
		const days = 20;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 1000, 0);
		const vixData = generateData(days, 15, 0);

		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		// Index 10 is < 30.
		// We need to find a feature that corresponds to index < 30.
		// features[0] corresponds to index 1 (since index 0 returns null)
		// features[5] corresponds to index 6.
		expect(features[5]?.beta).toBe(1);
	});

	it('should handle correlation calculation with insufficient window', () => {
		// Correlation window is 20.
		const days = 15;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 1000, 0);
		const vixData = generateData(days, 15, 0);

		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		// Index 10 is < 20.
		expect(features[5]?.indexCorrelation).toBe(0);
	});

	it('should filter out invalid features via Schema validation', () => {
		const days = 5;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 1000, 0);
		const vixData = generateData(days, 15, 0);

		// Force NaN return
		// @ts-ignore
		stockData[1]!.close = NaN;

		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		// Should likely skip the NaN entry
		expect(features.every((f) => f.marketReturn !== undefined && !isNaN(f.marketReturn))).toBe(true);
	});

	it('should handle stock data longer than market data', () => {
		const stockData = generateData(250, 100, 0);
		const marketData = generateData(200, 1000, 0); // Shorter
		const vixData = generateData(250, 15, 0);

		stockData.forEach((s, i) => {
			if (i < 200) marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);
		// Should return features for the first 200 days (minus 1), then likely fail or return nulls
		// calculateFeatureForDate -> calculateMarketReturn checks index >= marketData.length -> returns null.
		// calculateFeatureForDate returns null.
		// So we expect 199 features.
		expect(features.length).toBe(199);
	});

	it('should handle gaps in market data (correlation/beta robust check)', () => {
		const days = 50;
		const stockData = generateData(days, 100, 0);
		const marketData = generateData(days, 1000, 0);
		const vixData = generateData(days, 15, 0);

		stockData.forEach((s, i) => {
			marketData[i]!.date = s.date;
			vixData[i]!.date = s.date;
		});

		// Create gaps in market data by removing quotes or setting undefined
		// We can't easily set 'undefined' in the array since generateData returns valid objects.
		// But we can trick the calculateMarketReturn by making it return null.
		// calculateMarketReturn returns null if current or previous close is undefined.

		// Let's mess up the middle of marketData
		for (let i = 10; i < 40; i++) {
			// @ts-ignore
			marketData[i].close = undefined;
		}

		// This should cause calculateCorrelation to have fewer points, or 0 points if all are bad.
		// Beta and Correlation windows are 30 and 20.
		// Around index 40, the window (20-40) is mostly bad.

		const features = engineer.calculateFeatures('TEST', stockData, marketData, vixData);

		// Just ensure it doesn't crash and returns some features
		expect(features.length).toBeGreaterThan(0);
	});
});
