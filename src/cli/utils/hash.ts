/**
 * Data Hashing Utilities
 * Provides functions for calculating hashes of stock data for change detection
 */

import {createHash} from 'node:crypto';

import type {StockDataPoint} from '../../types/index.ts';

/**
 * Calculate a SHA-256 hash of stock data for change detection
 * Uses the last N data points to create a fingerprint of the most recent data
 * @param data - Stock data points (sorted by date)
 * @param sampleSize - Number of recent points to hash (default: 100)
 * @returns SHA-256 hash string
 */
export function calculateDataHash(data: StockDataPoint[], sampleSize = 100): string {
	if (data.length === 0) {
		return '';
	}

	// Take last N points for hashing
	const recentData = data.slice(-sampleSize);

	// Create a deterministic string representation
	// Include date, close price, and volume for uniqueness
	const dataString = recentData.map((point) => `${point.date}:${point.close.toFixed(6)}:${point.volume}`).join('|');

	// Calculate SHA-256 hash
	return createHash('sha256').update(dataString).digest('hex');
}
