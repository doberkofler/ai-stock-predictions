/**
 * Date utility functions
 * Centralizes date formatting, arithmetic, and sequence generation
 */

/**
 * Date utilities
 */
export const DateUtils = {
	/**
	 * Add days to a date
	 * @param date - Base date
	 * @param days - Number of days to add
	 * @returns New Date object
	 */
	addDays: (date: Date, days: number): Date => {
		const newDate = new Date(date);
		newDate.setDate(newDate.getDate() + days);
		return newDate;
	},

	/**
	 * Format milliseconds into human readable duration
	 * @param ms - Duration in milliseconds
	 * @returns Formatted duration string (e.g. "1h 2m 3s")
	 */
	formatDuration: (ms: number): string => {
		const seconds = Math.floor((ms / 1000) % 60);
		const minutes = Math.floor((ms / (1000 * 60)) % 60);
		const hours = Math.floor(ms / (1000 * 60 * 60));

		const parts = [];
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
		parts.push(`${seconds}s`);

		return parts.join(' ');
	},

	/**
	 * Format a date as YYYY-MM-DD
	 * @param date - Date object to format
	 * @returns Formatted date string
	 */
	formatIso: (date: Date): string => {
		return date.toISOString().split('T')[0] ?? '';
	},

	/**
	 * Generate a sequence of ISO date strings starting from a base date
	 * @param start - Starting date
	 * @param count - Number of dates to generate
	 * @returns Array of YYYY-MM-DD strings
	 */
	generateSequence: (start: Date, count: number): string[] => {
		return Array.from({length: count}, (_, i) => {
			const d = new Date(start);
			d.setDate(d.getDate() + i + 1);
			return d.toISOString().split('T')[0] ?? '';
		});
	},

	/**
	 * Get the start of today (00:00:00.000)
	 * @returns Date object for today at midnight
	 */
	getStartOfToday: (): Date => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return today;
	},

	/**
	 * Subtract years from a date
	 * @param date - Base date
	 * @param years - Number of years to subtract
	 * @returns New Date object
	 */
	subtractYears: (date: Date, years: number): Date => {
		const newDate = new Date(date);
		newDate.setFullYear(newDate.getFullYear() - years);
		return newDate;
	},
};
