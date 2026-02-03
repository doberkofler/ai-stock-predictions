import ora from 'ora';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {ui} from '../../../../src/cli/utils/ui.ts';

vi.mock('ora', () => ({
	default: vi.fn().mockReturnValue({
		fail: vi.fn().mockReturnThis(),
		info: vi.fn().mockReturnThis(),
		start: vi.fn().mockReturnThis(),
		stop: vi.fn().mockReturnThis(),
		succeed: vi.fn().mockReturnThis(),
		text: '',
		warn: vi.fn().mockReturnThis(),
	}),
}));

describe('UiService', () => {
	const originalEnv = process.env;
	const originalIsTTY = process.stdout.isTTY;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env = {...originalEnv};
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		process.env = originalEnv;
		// @ts-ignore
		process.stdout.isTTY = originalIsTTY;
	});

	it('should not log when not interactive', () => {
		// Mock non-interactive state
		process.env.VITEST = 'true';

		ui.log('test message');
		expect(console.log).not.toHaveBeenCalled();
	});

	it('should not log errors when not interactive', () => {
		// Mock non-interactive state
		process.env.VITEST = 'true';

		ui.error('error message');
		expect(console.error).not.toHaveBeenCalled();
	});

	it('should return mock spinner when not interactive', () => {
		const spinner = ui.spinner('test');
		spinner.start().succeed();
		expect(ora).not.toHaveBeenCalled();
		expect(spinner.text).toBe('test');
	});

	it('should have divider logic', () => {
		ui.divider();
		// In test env, divider calls log which is disabled
		expect(console.log).not.toHaveBeenCalled();
	});
});
