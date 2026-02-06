import {beforeEach, describe, expect, it, vi} from 'vitest';

import {runCommand} from '../../../../src/cli/utils/runner.ts';
import {getCliInvocation} from '../../../../src/cli/utils/cli-helper.ts';
import {ui} from '../../../../src/cli/utils/ui.ts';
import {configExists, loadConfig} from '../../../../src/config/config.ts';
import {initializeEnvironment} from '../../../../src/env.ts';

vi.mock('../../../../src/env.ts');
vi.mock('../../../../src/config/config.ts');
vi.mock('../../../../src/cli/utils/cli-helper.ts');
vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		error: vi.fn(),
		log: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			fail: vi.fn().mockReturnThis(),
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			text: '',
		}),
	},
}));

describe('runCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: null | number | string) => never);
	});

	it('should execute handler correctly', async () => {
		const mockConfig = {
			aBTesting: {enabled: false},
			backtest: {enabled: true, initialCapital: 10000, transactionCost: 0.001},
			dataSource: {rateLimit: 1000, retries: 3, timeout: 10000},
			market: {
				featureConfig: {
					enabled: true,
					includeBeta: true,
					includeCorrelation: true,
					includeDistanceFromMA: true,
					includeMarketReturn: true,
					includeRegime: true,
					includeRelativeReturn: true,
					includeVix: true,
					includeVolatilitySpread: true,
				},
				indices: [],
			},
			model: {
				batchSize: 128,
				dropout: 0.2,
				epochs: 50,
				l1Regularization: 0.001,
				l2Regularization: 0.001,
				learningRate: 0.001,
				recurrentDropout: 0.1,
				windowSize: 30,
			},
			prediction: {buyThreshold: 0.05, contextDays: 15, days: 30, directory: 'output', historyChartDays: 1825, minConfidence: 0.6, sellThreshold: -0.05},
			training: {minNewDataPoints: 50},
		};
		vi.mocked(configExists).mockReturnValue(true);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		vi.mocked(loadConfig).mockReturnValue(mockConfig as any);
		const handler = vi.fn().mockResolvedValue(undefined);

		await runCommand({workspaceDir: 'data', title: 'Test'}, handler, {opts: 1});

		expect(initializeEnvironment).toHaveBeenCalled();
		expect(configExists).toHaveBeenCalledWith('data');
		expect(loadConfig).toHaveBeenCalledWith('data');

		expect(handler).toHaveBeenCalledWith(expect.objectContaining({config: mockConfig}), {opts: 1});

		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('Process completed'));
	});

	it('should execute handler without config correctly', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		const handler = vi.fn().mockResolvedValue(undefined);

		await runCommand({workspaceDir: 'data', title: 'Test'}, handler, {opts: 1});

		expect(loadConfig).not.toHaveBeenCalled();

		expect(handler).toHaveBeenCalledWith(expect.objectContaining({config: undefined}), {opts: 1});
	});

	it('should execute handler without description correctly', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		const handler = vi.fn().mockResolvedValue(undefined);

		await runCommand({workspaceDir: 'data', title: 'Test'}, handler, {});

		expect(ui.log).not.toHaveBeenCalledWith(expect.stringMatching(/\n$/));
	});

	it('should handle errors correctly', async () => {
		vi.mocked(configExists).mockReturnValue(true);
		vi.mocked(loadConfig).mockImplementation(() => {
			throw new Error('Load failed');
		});

		await runCommand({workspaceDir: 'data', title: 'Test'}, vi.fn(), {});

		expect(ui.error).toHaveBeenCalledWith(expect.stringContaining('Error: Load failed'));
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should handle non-Error exceptions', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		const handler = vi.fn().mockRejectedValue('string error');

		await runCommand({workspaceDir: 'data', title: 'Test'}, handler, {});

		expect(ui.error).toHaveBeenCalledWith(expect.stringContaining('Unknown error occurred during Test'));
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should display next steps when provided and command succeeds', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		const handler = vi.fn().mockResolvedValue(undefined);
		vi.mocked(getCliInvocation).mockReturnValue('cli-command');

		await runCommand({workspaceDir: 'data', nextSteps: ['Step 1: {cli} command1', 'Step 2: {cli} command2'], title: 'Test'}, handler, {});

		expect(handler).toHaveBeenCalled();
		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('1. Step 1: cli-command command1'));
		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('2. Step 2: cli-command command2'));
	});

	it('should not display next steps when not provided', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		const handler = vi.fn().mockResolvedValue(undefined);

		await runCommand({workspaceDir: 'data', title: 'Test'}, handler, {});

		expect(handler).toHaveBeenCalled();
		expect(ui.log).not.toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
	});

	it('should replace {cli} placeholder with actual invocation', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		const handler = vi.fn().mockResolvedValue(undefined);
		vi.mocked(getCliInvocation).mockReturnValue('node src/index.ts');

		await runCommand({workspaceDir: 'data', nextSteps: ['Run: {cli} sync'], title: 'Test'}, handler, {});

		expect(handler).toHaveBeenCalled();
		expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('Run: node src/index.ts sync'));
	});

	it('should not display next steps when command fails', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		const handler = vi.fn().mockRejectedValue(new Error('Test error'));

		await runCommand({workspaceDir: 'data', nextSteps: ['Step 1'], title: 'Test'}, handler, {});

		expect(process.exit).toHaveBeenCalledWith(1);
		expect(ui.log).not.toHaveBeenCalledWith(expect.stringContaining('Next steps:'));
	});
});
