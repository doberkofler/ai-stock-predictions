/**
 * Technical indicators utility for feature engineering
 */

/**
 * Calculate Daily Returns
 * @param prices - Array of prices
 * @returns Returns array
 */
export function calculateReturns(prices: number[]): number[] {
	const returns: number[] = [0];
	for (let i = 1; i < prices.length; i++) {
		const prev = prices[i - 1] ?? 0;
		const current = prices[i] ?? 0;
		returns.push(prev === 0 ? 0 : (current - prev) / prev);
	}
	return returns;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param prices - Array of prices
 * @param period - RSI period (default 14)
 * @returns RSI array
 */
export function calculateRsi(prices: number[], period = 14): number[] {
	const rsi: number[] = [];
	let avgGain = 0;
	let avgLoss = 0;

	for (let i = 0; i < prices.length; i++) {
		if (i === 0) {
			rsi.push(50); // Neutral starting point
			continue;
		}

		const change = (prices[i] ?? 0) - (prices[i - 1] ?? 0);
		const gain = Math.max(0, change);
		const loss = Math.max(0, -change);

		if (i <= period) {
			avgGain += gain / period;
			avgLoss += loss / period;
			rsi.push(50);
		} else {
			avgGain = (avgGain * (period - 1) + gain) / period;
			avgLoss = (avgLoss * (period - 1) + loss) / period;
			const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
			rsi.push(100 - 100 / (1 + rs));
		}
	}
	return rsi;
}

/**
 * Calculate Simple Moving Average (SMA)
 * @param prices - Array of prices
 * @param period - Window period
 * @returns SMA array
 */
export function calculateSma(prices: number[], period: number): number[] {
	const sma: number[] = [];
	for (let i = 0; i < prices.length; i++) {
		if (i < period - 1) {
			sma.push(prices[i] ?? 0);
			continue;
		}
		let sum = 0;
		for (let j = 0; j < period; j++) {
			sum += prices[i - j] ?? 0;
		}
		sma.push(sum / period);
	}
	return sma;
}
