/**
 * Data quality pipeline for handling missing data and quality assessment
 * Provides interpolation for gaps and quality scoring for stock data
 */

/* eslint-disable @typescript-eslint/no-extraneous-class */

import type {StockDataPoint} from '../types/index.ts';

/**
 * Result of data quality processing
 */
export type DataQualityResult = {
	/**
	 * Processed data with interpolated gaps
	 */
	data: StockDataPoint[];

	/**
	 * Number of gaps detected in the data
	 */
	gapsDetected: number;

	/**
	 * Number of data points that were interpolated
	 */
	interpolatedCount: number;

	/**
	 * Indices of original data points that were interpolated
	 */
	interpolatedIndices: number[];

	/**
	 * Percentage of data points that were interpolated (0-1)
	 */
	interpolatedPercent: number;

	/**
	 * Total number of missing days (including weekends/holidays expected)
	 */
	missingDays: number;

	/**
	 * Quality score (0-100) based on completeness, outliers, and consistency
	 */
	qualityScore: number;
};

/**
 * Maximum gap size (in days) to interpolate
 * Gaps larger than this are considered data quality issues
 */
const MAX_INTERPOLATION_GAP = 3;

/**
 * Maximum percentage of interpolated data allowed (0-1)
 * Symbols exceeding this threshold should be rejected
 */
const MAX_INTERPOLATION_PERCENT = 0.1;

/**
 * Data quality pipeline for processing stock data
 */
export class DataQualityPipeline {
	/**
	 * Check if data quality is acceptable for training
	 * @param result - Data quality result
	 * @returns True if quality is acceptable, false otherwise
	 */
	static isQualityAcceptable(result: DataQualityResult): boolean {
		return result.interpolatedPercent <= MAX_INTERPOLATION_PERCENT && result.qualityScore >= 60;
	}

	/**
	 * Process stock data: detect gaps, interpolate missing values, and calculate quality score
	 * @param data - Raw stock data points (must be sorted by date ascending)
	 * @returns Data quality result with interpolated data and metrics
	 */
	static processData(data: StockDataPoint[]): DataQualityResult {
		if (data.length === 0) {
			return {
				data: [],
				gapsDetected: 0,
				interpolatedCount: 0,
				interpolatedIndices: [],
				interpolatedPercent: 0,
				missingDays: 0,
				qualityScore: 0,
			};
		}

		// Detect gaps
		const gaps = this.detectGaps(data);

		// Interpolate gaps
		const {data: interpolatedData, interpolatedIndices} = this.interpolateGaps(data, gaps);

		// Calculate quality metrics
		const interpolatedCount = interpolatedIndices.length;
		const interpolatedPercent = interpolatedCount / interpolatedData.length;
		const qualityScore = this.calculateQualityScore(interpolatedData, interpolatedPercent, gaps);

		return {
			data: interpolatedData,
			gapsDetected: gaps.length,
			interpolatedCount,
			interpolatedIndices,
			interpolatedPercent,
			missingDays: this.countMissingDays(data),
			qualityScore,
		};
	}

	/**
	 * Calculate quality score (0-100) based on multiple factors
	 * @param data - Processed stock data
	 * @param interpolatedPercent - Percentage of interpolated data (0-1)
	 * @param gaps - Detected gaps
	 * @returns Quality score (0-100)
	 */
	private static calculateQualityScore(data: StockDataPoint[], interpolatedPercent: number, gaps: {gapDays: number}[]): number {
		if (data.length === 0) {
			return 0;
		}

		// Factor 1: Completeness (40% weight)
		// Penalize based on interpolation percentage
		const completeness = 1 - interpolatedPercent;

		// Factor 2: Gap penalty (30% weight)
		// Penalize large gaps more heavily
		const largeGaps = gaps.filter((g) => g.gapDays > MAX_INTERPOLATION_GAP + 1).length;
		const gapPenalty = Math.max(0, 1 - largeGaps / 10); // -10% per large gap, max 100%

		// Factor 3: Data density (30% weight)
		// Measure how much of the expected timespan we have data for
		const startDate = new Date(data[0]?.date ?? '');
		const endDate = new Date(data.at(-1)?.date ?? '');
		const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
		const expectedTradingDays = Math.floor(totalDays * (5 / 7)); // ~5 trading days per week
		const density = expectedTradingDays > 0 ? Math.min(1, data.length / expectedTradingDays) : 1;

		// Weighted average
		const qualityScore = (completeness * 0.4 + gapPenalty * 0.3 + density * 0.3) * 100;

		return Math.round(qualityScore * 10) / 10; // Round to 1 decimal place
	}

	/**
	 * Count total missing days in the data (including weekends/holidays)
	 * @param data - Stock data points
	 * @returns Number of missing days
	 */
	private static countMissingDays(data: StockDataPoint[]): number {
		if (data.length < 2) {
			return 0;
		}

		const startDate = new Date(data[0]?.date ?? '');
		const endDate = new Date(data.at(-1)?.date ?? '');
		const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

		return totalDays - data.length + 1;
	}

	/**
	 * Detect gaps in stock data (missing trading days)
	 * @param data - Stock data points (sorted by date)
	 * @returns Array of gaps with start/end indices and size
	 */
	private static detectGaps(data: StockDataPoint[]): {endIndex: number; gapDays: number; startIndex: number}[] {
		const gaps: {endIndex: number; gapDays: number; startIndex: number}[] = [];

		for (let i = 1; i < data.length; i++) {
			const prevDate = new Date(data[i - 1]?.date ?? '');
			const currDate = new Date(data[i]?.date ?? '');

			const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

			// Detect all gaps > 1 day (more than overnight)
			// This catches both small interpolatable gaps and large data quality issues
			// Weekend gaps (Fri->Mon = 3 days) and holiday gaps will be detected
			// Small gaps (2-4 days) will be interpolated, larger gaps won't be
			if (daysDiff > 1) {
				gaps.push({
					endIndex: i,
					gapDays: daysDiff,
					startIndex: i - 1,
				});
			}
		}

		return gaps;
	}

	/**
	 * Interpolate gaps in stock data using linear interpolation
	 * Only interpolates gaps ≤ MAX_INTERPOLATION_GAP days
	 * @param data - Original stock data
	 * @param gaps - Detected gaps
	 * @returns Interpolated data and indices of interpolated points
	 */
	private static interpolateGaps(
		data: StockDataPoint[],
		gaps: {endIndex: number; gapDays: number; startIndex: number}[],
	): {data: StockDataPoint[]; interpolatedIndices: number[]} {
		const result: StockDataPoint[] = [...data];
		const interpolatedIndices: number[] = [];

		// Process gaps from end to start to maintain indices
		for (const gap of gaps.toReversed()) {
			// Only interpolate small gaps
			if (gap.gapDays <= MAX_INTERPOLATION_GAP + 1) {
				const startPoint = data[gap.startIndex];
				const endPoint = data[gap.endIndex];

				if (!startPoint || !endPoint) {
					continue;
				}

				const interpolatedPoints = this.linearInterpolate(startPoint, endPoint, gap.gapDays - 1);

				// Insert interpolated points
				result.splice(gap.endIndex, 0, ...interpolatedPoints);

				// Track interpolated indices (adjusted for insertions)
				for (let i = 0; i < interpolatedPoints.length; i++) {
					interpolatedIndices.push(gap.endIndex + i);
				}
			}
		}

		return {data: result, interpolatedIndices: interpolatedIndices.toSorted((a, b) => a - b)};
	}

	/**
	 * Perform linear interpolation between two stock data points
	 * @param start - Starting data point
	 * @param end - Ending data point
	 * @param numPoints - Number of points to interpolate between start and end
	 * @returns Array of interpolated stock data points
	 */
	private static linearInterpolate(start: StockDataPoint, end: StockDataPoint, numPoints: number): StockDataPoint[] {
		const result: StockDataPoint[] = [];
		const startDate = new Date(start.date);
		const endDate = new Date(end.date);

		// Calculate total days including interpolated points
		const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
		const step = totalDays / (numPoints + 1);

		for (let i = 1; i <= numPoints; i++) {
			const ratio = (i * step) / totalDays;

			// Interpolate date
			const interpolatedDate = new Date(startDate.getTime() + ratio * (endDate.getTime() - startDate.getTime()));
			const dateStr = interpolatedDate.toISOString().split('T')[0];

			if (!dateStr) {
				throw new Error(`Failed to format interpolated date between ${start.date} and ${end.date}`);
			}

			// Linear interpolation for all numeric fields
			result.push({
				adjClose: start.adjClose + ratio * (end.adjClose - start.adjClose),
				close: start.close + ratio * (end.close - start.close),
				date: dateStr,
				high: start.high + ratio * (end.high - start.high),
				low: start.low + ratio * (end.low - start.low),
				open: start.open + ratio * (end.open - start.open),
				volume: Math.round(start.volume + ratio * (end.volume - start.volume)),
			});
		}

		return result;
	}
}
