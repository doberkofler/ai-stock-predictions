/**
 * Progress tracking utilities for CLI operations
 * Provides spinners, percentage tracking, and summary reporting
 */

import ora from 'ora';
import type {Ora} from 'ora';
import chalk from 'chalk';

/**
 * Progress status types
 */
export type ProgressStatus =
	| 'pending'
	| 'updated'
	| 'up-to-date'
	| 'error'
	| 'trained'
	| 'no-new-data'
	| 'poor-performance'
	| 'retrained'
	| 'no-improvement'
	| 'predicted';

/**
 * Individual item progress
 */
type ItemProgress = {
	status: ProgressStatus;
	details: string | number | undefined;
	timestamp: Date;
};

/**
 * Progress tracker class for batch operations
 */
export class ProgressTracker {
	private readonly progress: Map<string, ItemProgress> = new Map<string, ItemProgress>();
	private completedItems = 0;

	/**
	 * Mark an item as completed with its status
	 * @param {string} item - Item identifier (e.g., stock symbol)
	 * @param {ProgressStatus} status - Completion status
	 * @param {string | number} [details] - Additional details (e.g., loss value, data points)
	 */
	public complete(item: string, status: ProgressStatus, details?: string | number): void {
		this.progress.set(item, {
			status,
			details: details ?? undefined,
			timestamp: new Date(),
		});
		this.completedItems++;
	}

	/**
	 * Create a spinner for long-running operations
	 * @param {string} text - Initial spinner text
	 * @returns {Ora} Configured spinner instance
	 */
	public createSpinner(text: string): Ora {
		return ora({
			text,
			spinner: 'dots',
			color: 'cyan',
		});
	}

	/**
	 * Create a progress bar for percentage tracking
	 * @param {number} total - Total number of items
	 * @param {number} current - Current progress
	 * @param {string} label - Progress label
	 * @param {string} [color] - Bar color
	 * @returns {string} Formatted progress bar string
	 */
	public createProgressBar(total: number, current: number, label: string, color = 'cyan'): string {
		const percentage = Math.round((current / total) * 100);
		const barLength = 20;
		const filledLength = Math.max(0, Math.min(barLength, Math.round((barLength * current) / total)));
		const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

		let colorFn = chalk.cyan;
		if (color === 'blue') {
			colorFn = chalk.blue;
		} else if (color === 'green') {
			colorFn = chalk.green;
		}

		return `${colorFn(label)} [${bar}] ${percentage}% (${current}/${total})`;
	}

	/**
	 * Update spinner with progress bar
	 * @param {Ora} spinner - Spinner instance
	 * @param {number} current - Current progress
	 * @param {number} total - Total progress
	 * @param {string} label - Progress label
	 */
	public updateSpinnerWithProgress(spinner: Ora, current: number, total: number, label: string): void {
		spinner.text = this.createProgressBar(total, current, label);
	}

	/**
	 * Calculate ETA string
	 * @param {number} startTime - Start time in milliseconds
	 * @param {number} current - Current progress
	 * @param {number} total - Total items
	 * @returns {string} Formatted ETA string
	 */
	public static calculateEta(startTime: number, current: number, total: number): string {
		if (current <= 0) return 'calculating...';
		const elapsed = Date.now() - startTime;
		const remaining = (elapsed / current) * (total - current);

		return ProgressTracker.formatDuration(remaining);
	}

	/**
	 * Format milliseconds into human readable duration
	 * @param {number} ms - Duration in milliseconds
	 * @returns {string} Formatted duration string
	 */
	public static formatDuration(ms: number): string {
		const seconds = Math.floor((ms / 1000) % 60);
		const minutes = Math.floor((ms / (1000 * 60)) % 60);
		const hours = Math.floor(ms / (1000 * 60 * 60));

		const parts = [];
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
		parts.push(`${seconds}s`);

		return parts.join(' ');
	}

	/**
	 * Get summary of all completed items
	 * @returns {Record<string, number>} Summary counts by status
	 */
	public getSummary(): Record<string, number> {
		const summary: Record<string, number> = {};

		for (const progress of this.progress.values()) {
			summary[progress.status] = (summary[progress.status] ?? 0) + 1;
		}

		return summary;
	}

	/**
	 * Get detailed status for all items
	 * @returns {Array<{item: string; status: ProgressStatus; details?: string | number}>} Detailed progress
	 */
	public getDetailedProgress(): {
		item: string;
		status: ProgressStatus;
		details: string | number | undefined;
	}[] {
		return [...this.progress.entries()].map(([item, progress]) => ({
			item,
			status: progress.status,
			details: progress.details,
		}));
	}

	/**
	 * Display color-coded status
	 * @param {ProgressStatus} status - Status to color
	 * @returns {string} Color-coded status string
	 */
	public static getColoredStatus(status: ProgressStatus): string {
		switch (status) {
			case 'updated':
			case 'trained':
			case 'retrained':
			case 'predicted':
				return chalk.green(status);
			case 'up-to-date':
			case 'no-new-data':
			case 'no-improvement':
				return chalk.blue(status);
			case 'poor-performance':
				return chalk.yellow(status);
			case 'error':
				return chalk.red(status);
			default:
				return chalk.gray(status);
		}
	}

	/**
	 * Get status emoji
	 * @param {ProgressStatus} status - Status to get emoji for
	 * @returns {string} Status emoji
	 */
	public static getStatusEmoji(status: ProgressStatus): string {
		switch (status) {
			case 'updated':
				return '✅';
			case 'up-to-date':
				return 'ℹ️';
			case 'trained':
				return '🎯';
			case 'no-new-data':
				return '➡️';
			case 'poor-performance':
				return '⚠️';
			case 'error':
				return '❌';
			case 'retrained':
				return '🔄';
			case 'no-improvement':
				return '↔️';
			case 'predicted':
				return '🔮';
			default:
				return '❓';
		}
	}
}
