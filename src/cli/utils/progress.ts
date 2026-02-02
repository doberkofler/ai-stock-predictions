/**
 * Progress tracking utilities for CLI operations
 * Provides spinners, percentage tracking, and summary reporting
 */

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

	/**
	 * Mark an item as completed with its status
	 * @param item - Item identifier (e.g., stock symbol)
	 * @param status - Completion status
	 * @param [details] - Additional details (e.g., loss value, data points)
	 */
	public complete(item: string, status: ProgressStatus, details?: string | number): void {
		this.progress.set(item, {
			status,
			details: details ?? undefined,
			timestamp: new Date(),
		});
	}

	/**
	 * Create a progress bar for percentage tracking
	 * @param total - Total number of items
	 * @param current - Current progress
	 * @param label - Progress label
	 * @param [color] - Bar color
	 * @returns Formatted progress bar string
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
	 * Calculate ETA string
	 * @param startTime - Start time in milliseconds
	 * @param current - Current progress
	 * @param total - Total items
	 * @returns Formatted ETA string
	 */
	public static calculateEta(startTime: number, current: number, total: number): string {
		if (current <= 0) return 'calculating...';
		const elapsed = Date.now() - startTime;
		const remaining = (elapsed / current) * (total - current);

		return ProgressTracker.formatDuration(remaining);
	}

	/**
	 * Format milliseconds into human readable duration
	 * @param ms - Duration in milliseconds
	 * @returns Formatted duration string
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
	 * @returns Summary counts by status
	 */
	public getSummary(): Record<string, number> {
		const summary: Record<string, number> = {};

		for (const progress of this.progress.values()) {
			summary[progress.status] = (summary[progress.status] ?? 0) + 1;
		}

		return summary;
	}
}
