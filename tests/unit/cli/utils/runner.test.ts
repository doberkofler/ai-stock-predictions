import {describe, it, expect, vi, beforeEach} from 'vitest';
import {runCommand} from '../../../../src/cli/utils/runner.ts';
import {initializeEnvironment} from '../../../../src/env.ts';
import {loadConfig} from '../../../../src/config/config.ts';
import {ui} from '../../../../src/cli/utils/ui.ts';
import chalk from 'chalk';

vi.mock('../../../../src/env.ts');
vi.mock('../../../../src/config/config.ts');
vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		log: vi.fn(),
		error: vi.fn(),
	},
}));

describe('runCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	it('should execute handler correctly', async () => {
		const mockConfig = {test: true};
		vi.mocked(loadConfig).mockReturnValue(mockConfig as any);
		const handler = vi.fn().mockResolvedValue(undefined);

		await runCommand({title: 'Test', configPath: 'config.yaml'}, handler, {opts: 1});

		expect(initializeEnvironment).toHaveBeenCalled();
		expect(loadConfig).toHaveBeenCalledWith('config.yaml');
		expect(handler).toHaveBeenCalledWith(expect.objectContaining({config: mockConfig}), {opts: 1});
		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('Process completed'));
	});

	it('should execute handler without description correctly', async () => {
		const mockConfig = {test: true};
		vi.mocked(loadConfig).mockReturnValue(mockConfig as any);
		const handler = vi.fn().mockResolvedValue(undefined);

		await runCommand({title: 'Test', configPath: 'config.yaml'}, handler, {});

		expect(ui.log).not.toHaveBeenCalledWith(expect.stringMatching(/\n$/));
	});

	it('should handle errors correctly', async () => {
		vi.mocked(loadConfig).mockImplementation(() => {
			throw new Error('Load failed');
		});

		await runCommand({title: 'Test', configPath: 'config.yaml'}, vi.fn(), {});

		expect(ui.error).toHaveBeenCalledWith(expect.stringContaining('Error: Load failed'));
		expect(process.exit).toHaveBeenCalledWith(1);
	});
});
