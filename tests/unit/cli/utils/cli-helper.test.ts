import {afterEach, describe, expect, it} from 'vitest';

import {getCliInvocation} from '../../../../src/cli/utils/cli-helper.ts';

describe('getCliInvocation', () => {
	const originalArgv = process.argv;

	afterEach(() => {
		process.argv = originalArgv as never;
	});

	it('should return "node src/index.ts" when running via node', () => {
		process.argv = ['node', '/path/to/src/index.ts', 'command'] as never;
		const result = getCliInvocation();
		expect(result).toBe('node src/index.ts');
	});

	it('should return "ai-stock-predictions" when not running via node', () => {
		process.argv = ['/path/to/bin/ai-stock-predictions', 'command'] as never;
		const result = getCliInvocation();
		expect(result).toBe('ai-stock-predictions');
	});

	it('should return "ai-stock-predictions" when running via node but not src/index.ts', () => {
		process.argv = ['node', '/path/to/dist/cli.js', 'command'] as never;
		const result = getCliInvocation();
		expect(result).toBe('ai-stock-predictions');
	});

	it('should return "ai-stock-predictions" when process.argv[0] does not end with "/node"', () => {
		process.argv = ['/usr/local/bin/node24', '/path/to/src/index.ts', 'command'] as never;
		const result = getCliInvocation();
		expect(result).toBe('ai-stock-predictions');
	});
});
