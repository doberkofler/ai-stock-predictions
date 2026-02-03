import {describe, expect, it} from 'vitest';

import {DateUtils} from '../../../../src/cli/utils/date.ts';

describe('DateUtils', () => {
	describe('formatIso', () => {
		it('should format date as YYYY-MM-DD', () => {
			const date = new Date('2023-01-01T12:00:00');
			expect(DateUtils.formatIso(date)).toBe('2023-01-01');
		});
	});

	describe('addDays', () => {
		it('should add days correctly', () => {
			const date = new Date('2023-01-01');
			const nextDay = DateUtils.addDays(date, 1);
			expect(DateUtils.formatIso(nextDay)).toBe('2023-01-02');
		});

		it('should handle negative days', () => {
			const date = new Date('2023-01-02');
			const prevDay = DateUtils.addDays(date, -1);
			expect(DateUtils.formatIso(prevDay)).toBe('2023-01-01');
		});
	});

	describe('getStartOfToday', () => {
		it('should return date with time at midnight', () => {
			const today = DateUtils.getStartOfToday();
			expect(today.getHours()).toBe(0);
			expect(today.getMinutes()).toBe(0);
			expect(today.getSeconds()).toBe(0);
			expect(today.getMilliseconds()).toBe(0);
		});
	});

	describe('formatDuration', () => {
		it('should format seconds only', () => {
			expect(DateUtils.formatDuration(5000)).toBe('5s');
		});

		it('should format minutes and seconds', () => {
			expect(DateUtils.formatDuration(65000)).toBe('1m 5s');
		});

		it('should format hours, minutes and seconds', () => {
			expect(DateUtils.formatDuration(3665000)).toBe('1h 1m 5s');
		});
	});

	describe('generateSequence', () => {
		it('should generate a sequence of dates', () => {
			const start = new Date('2023-01-01');
			const sequence = DateUtils.generateSequence(start, 3);
			expect(sequence).toEqual(['2023-01-02', '2023-01-03', '2023-01-04']);
		});
	});
});
