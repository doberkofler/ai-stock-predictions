import {describe, it, expect, vi, beforeEach} from 'vitest';
import {ProgressTracker} from '../../../../src/cli/utils/progress.ts';
import {DateUtils} from '../../../../src/cli/utils/date.ts';

vi.mock('../../../../src/cli/utils/date.ts', () => ({
	DateUtils: {
		formatDuration: vi.fn((ms) => `${ms}ms`),
	},
}));

describe('ProgressTracker', () => {
	let tracker: ProgressTracker;

	beforeEach(() => {
		vi.clearAllMocks();
		tracker = new ProgressTracker();
	});

	it('should complete items and get summary', () => {
		tracker.complete('AAPL', 'updated', 100);
		tracker.complete('MSFT', 'up-to-date');
		tracker.complete('GOOG', 'error', 'API fail');

		const summary = tracker.getSummary();
		expect(summary.updated).toBe(1);
		expect(summary['up-to-date']).toBe(1);
		expect(summary.error).toBe(1);
	});

	it('should create progress bar with default color', () => {
		const bar = tracker.createProgressBar(100, 50, 'Loading');
		expect(bar).toContain('Loading');
		expect(bar).toContain('50%');
		expect(bar).toContain('50/100');
		expect(bar).toContain('██████████░░░░░░░░░░');
	});

	it('should create progress bar with blue color', () => {
		const bar = tracker.createProgressBar(100, 25, 'Blue', 'blue');
		expect(bar).toContain('Blue');
		expect(bar).toContain('25%');
	});

	it('should create progress bar with green color', () => {
		const bar = tracker.createProgressBar(100, 75, 'Green', 'green');
		expect(bar).toContain('Green');
		expect(bar).toContain('75%');
	});

	it('should calculate ETA', () => {
		const startTime = Date.now() - 1000;
		const eta = ProgressTracker.calculateEta(startTime, 50, 100);
		expect(eta).toBe('1000ms');
		expect(DateUtils.formatDuration).toHaveBeenCalled();
	});

	it('should return calculating for zero progress in ETA', () => {
		const eta = ProgressTracker.calculateEta(Date.now(), 0, 100);
		expect(eta).toBe('calculating...');
	});
});
