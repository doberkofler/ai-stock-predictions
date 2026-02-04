/**
 * Unit tests for DataQualityPipeline
 */

import {describe, expect, it} from 'vitest';

import type {StockDataPoint} from '../../../src/types/index.ts';

import {isQualityAcceptable, processData} from '../../../src/gather/data-quality.ts';

describe('DataQualityPipeline', () => {
	describe('processData', () => {
		it('should handle empty data', () => {
			const result = processData([]);

			expect(result.data).toEqual([]);
			expect(result.interpolatedCount).toBe(0);
			expect(result.qualityScore).toBe(0);
			expect(result.gapsDetected).toBe(0);
		});

		it('should handle data with no gaps', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 102, close: 102, date: '2024-01-02', high: 103, low: 101, open: 101, volume: 1200000},
				{adjClose: 105, close: 105, date: '2024-01-03', high: 106, low: 104, open: 103, volume: 1100000},
			];

			const result = processData(mockData);

			expect(result.data).toHaveLength(3);
			expect(result.interpolatedCount).toBe(0);
			expect(result.gapsDetected).toBe(0);
			expect(result.qualityScore).toBeGreaterThan(90); // High quality score
		});

		it('should detect gaps larger than 4 days', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 105, close: 105, date: '2024-01-08', high: 106, low: 104, open: 103, volume: 1100000}, // 7-day gap
			];

			const result = processData(mockData);

			expect(result.gapsDetected).toBe(1);
		});

		it('should interpolate small gaps (≤3 days)', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 103, close: 103, date: '2024-01-04', high: 104, low: 102, open: 102, volume: 1100000}, // 3-day gap
			];

			const result = processData(mockData);

			expect(result.interpolatedCount).toBeGreaterThan(0);
			expect(result.data.length).toBeGreaterThan(mockData.length);
			expect(result.interpolatedIndices).toHaveLength(result.interpolatedCount);
		});

		it('should not interpolate large gaps (>3 days)', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 110, close: 110, date: '2024-01-10', high: 111, low: 109, open: 109, volume: 1100000}, // 9-day gap
			];

			const result = processData(mockData);

			expect(result.interpolatedCount).toBe(0);
			expect(result.data).toHaveLength(2); // No interpolation
			expect(result.gapsDetected).toBe(1);
		});

		it('should linearly interpolate values correctly', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 100, low: 100, open: 100, volume: 1000000},
				{adjClose: 106, close: 106, date: '2024-01-04', high: 106, low: 106, open: 106, volume: 1300000}, // 3-day gap
			];

			const result = processData(mockData);

			// Should have interpolated 2 points (Jan 2 and Jan 3)
			expect(result.interpolatedCount).toBe(2);
			expect(result.data).toHaveLength(4);

			// Check interpolated values are between start and end
			const interpolatedPoints = result.data.slice(1, 3);
			for (const point of interpolatedPoints) {
				expect(point.close).toBeGreaterThan(100);
				expect(point.close).toBeLessThan(106);
			}
		});

		it('should calculate quality score based on interpolation percentage', () => {
			const mockDataHighQuality: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 102, close: 102, date: '2024-01-02', high: 103, low: 101, open: 101, volume: 1200000},
				{adjClose: 105, close: 105, date: '2024-01-03', high: 106, low: 104, open: 103, volume: 1100000},
			];

			const mockDataLowQuality: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 110, close: 110, date: '2024-01-10', high: 111, low: 109, open: 109, volume: 1100000}, // Large gap
				{adjClose: 120, close: 120, date: '2024-01-20', high: 121, low: 119, open: 119, volume: 1200000}, // Another large gap
			];

			const resultHigh = processData(mockDataHighQuality);
			const resultLow = processData(mockDataLowQuality);

			expect(resultHigh.qualityScore).toBeGreaterThan(resultLow.qualityScore);
			expect(resultHigh.qualityScore).toBeGreaterThan(80);
		});

		it('should track interpolated indices correctly', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 103, close: 103, date: '2024-01-04', high: 104, low: 102, open: 102, volume: 1100000}, // 3-day gap
			];

			const result = processData(mockData);

			expect(result.interpolatedIndices).toHaveLength(result.interpolatedCount);
			for (const index of result.interpolatedIndices) {
				expect(index).toBeGreaterThanOrEqual(0);
				expect(index).toBeLessThan(result.data.length);
			}
		});

		it('should calculate interpolated percent correctly', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 103, close: 103, date: '2024-01-04', high: 104, low: 102, open: 102, volume: 1100000}, // 3-day gap -> 2 interpolated
			];

			const result = processData(mockData);

			expect(result.interpolatedPercent).toBe(result.interpolatedCount / result.data.length);
			expect(result.interpolatedPercent).toBeGreaterThan(0);
			expect(result.interpolatedPercent).toBeLessThanOrEqual(1);
		});

		it('should maintain data order after interpolation', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 103, close: 103, date: '2024-01-04', high: 104, low: 102, open: 102, volume: 1100000},
				{adjClose: 106, close: 106, date: '2024-01-08', high: 107, low: 105, open: 105, volume: 1200000},
			];

			const result = processData(mockData);

			// Check dates are in ascending order
			for (let i = 1; i < result.data.length; i++) {
				const prevDate = new Date(result.data[i - 1]?.date ?? '');
				const currDate = new Date(result.data[i]?.date ?? '');
				expect(currDate.getTime()).toBeGreaterThan(prevDate.getTime());
			}
		});
	});

	describe('isQualityAcceptable', () => {
		it('should accept high-quality data', () => {
			const goodResult = {
				data: [],
				gapsDetected: 0,
				interpolatedCount: 5,
				interpolatedIndices: [],
				interpolatedPercent: 0.05, // 5% interpolated
				missingDays: 10,
				outlierCount: 0,
				outlierIndices: [],
				outlierPercent: 0,
				qualityScore: 85,
			};

			expect(isQualityAcceptable(goodResult)).toBe(true);
		});

		it('should reject data with too much interpolation', () => {
			const badResult = {
				data: [],
				gapsDetected: 5,
				interpolatedCount: 50,
				interpolatedIndices: [],
				interpolatedPercent: 0.15, // 15% interpolated (>10% threshold)
				missingDays: 100,
				outlierCount: 0,
				outlierIndices: [],
				outlierPercent: 0,
				qualityScore: 70,
			};

			expect(isQualityAcceptable(badResult)).toBe(false);
		});

		it('should reject data with low quality score', () => {
			const badResult = {
				data: [],
				gapsDetected: 10,
				interpolatedCount: 5,
				interpolatedIndices: [],
				interpolatedPercent: 0.05, // Low interpolation
				missingDays: 200,
				outlierCount: 0,
				outlierIndices: [],
				outlierPercent: 0,
				qualityScore: 50, // <60 threshold
			};

			expect(isQualityAcceptable(badResult)).toBe(false);
		});

		it('should accept data at the threshold boundaries', () => {
			const boundaryResult = {
				data: [],
				gapsDetected: 2,
				interpolatedCount: 10,
				interpolatedIndices: [],
				interpolatedPercent: 0.1, // Exactly 10%
				missingDays: 50,
				outlierCount: 0,
				outlierIndices: [],
				outlierPercent: 0,
				qualityScore: 60, // Exactly 60
			};

			expect(isQualityAcceptable(boundaryResult)).toBe(true);
		});
	});

	describe('outlier detection', () => {
		it('should detect statistical outliers in prices', () => {
			const mockData: StockDataPoint[] = Array.from({length: 30}, (_, i) => ({
				adjClose: 100,
				close: 100,
				date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
				high: 100,
				low: 100,
				open: 100,
				volume: 1000,
			}));

			// Add an outlier (huge price jump)
			if (mockData[15]) {
				mockData[15].close = 200;
				mockData[15].adjClose = 200;
			}

			const result = processData(mockData);

			expect(result.outlierCount).toBeGreaterThan(0);
			expect(result.outlierIndices).toContain(15);
			expect(result.qualityScore).toBeLessThan(90); // Should be penalized
		});

		it('should not flag steady data as outliers', () => {
			const mockData: StockDataPoint[] = Array.from({length: 30}, (_, i) => ({
				adjClose: 100 + i,
				close: 100 + i,
				date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
				high: 100 + i,
				low: 100 + i,
				open: 100 + i,
				volume: 1000,
			}));

			const result = processData(mockData);

			expect(result.outlierCount).toBe(0);
		});
	});

	describe('edge cases', () => {
		it('should handle single data point', () => {
			const mockData: StockDataPoint[] = [{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000}];

			const result = processData(mockData);

			expect(result.data).toHaveLength(1);
			expect(result.interpolatedCount).toBe(0);
			expect(result.gapsDetected).toBe(0);
		});

		it('should handle multiple small gaps', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 103, close: 103, date: '2024-01-04', high: 104, low: 102, open: 102, volume: 1100000}, // Gap 1
				{adjClose: 106, close: 106, date: '2024-01-07', high: 107, low: 105, open: 105, volume: 1200000}, // Gap 2
			];

			const result = processData(mockData);

			expect(result.gapsDetected).toBe(2);
			expect(result.interpolatedCount).toBeGreaterThan(0);
		});

		it('should handle mix of small and large gaps', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 101, low: 99, open: 100, volume: 1000000},
				{adjClose: 103, close: 103, date: '2024-01-04', high: 104, low: 102, open: 102, volume: 1100000}, // Small gap
				{adjClose: 110, close: 110, date: '2024-01-15', high: 111, low: 109, open: 109, volume: 1200000}, // Large gap
			];

			const result = processData(mockData);

			expect(result.gapsDetected).toBe(2);
			expect(result.interpolatedCount).toBeGreaterThan(0); // Only small gap interpolated
			expect(result.data.length).toBeLessThan(mockData.length + 10); // Large gap not interpolated
		});

		it('should handle weekend gaps correctly (≤3 days)', () => {
			// Friday to Monday is 3 days - will be detected and interpolated
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-05', high: 101, low: 99, open: 100, volume: 1000000}, // Friday
				{adjClose: 102, close: 102, date: '2024-01-08', high: 103, low: 101, open: 101, volume: 1200000}, // Monday
			];

			const result = processData(mockData);

			// 3-day gap will be detected and interpolated (weekend days will be filled)
			expect(result.gapsDetected).toBe(1);
			expect(result.interpolatedCount).toBeGreaterThan(0);
		});

		it('should round volume to integer after interpolation', () => {
			const mockData: StockDataPoint[] = [
				{adjClose: 100, close: 100, date: '2024-01-01', high: 100, low: 100, open: 100, volume: 1000000},
				{adjClose: 103, close: 103, date: '2024-01-04', high: 103, low: 103, open: 103, volume: 1300000},
			];

			const result = processData(mockData);

			for (const point of result.data) {
				expect(Number.isInteger(point.volume)).toBe(true);
			}
		});
	});
});
