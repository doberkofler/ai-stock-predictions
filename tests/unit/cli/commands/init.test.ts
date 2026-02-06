import {parse} from 'jsonc-parser';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {initCommand} from '../../../../src/cli/commands/init.ts';
import {FsUtils} from '../../../../src/cli/utils/fs.ts';
import {configExists} from '../../../../src/config/config.ts';
import {ConfigSchema} from '../../../../src/config/schema.ts';

vi.mock('../../../../src/cli/utils/fs.ts');
vi.mock('../../../../src/config/config.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/config/config.ts')>();
	return {
		...actual,
		configExists: vi.fn(),
	};
});

vi.mock('../../../../src/cli/utils/fs.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/cli/utils/fs.ts')>();
	return {
		...actual,
		FsUtils: {
			...actual.FsUtils,
			deletePath: vi.fn().mockResolvedValue(undefined),
			ensureDir: vi.fn().mockResolvedValue(undefined),
			readText: vi.fn().mockResolvedValue('template content'),
			writeText: vi.fn().mockResolvedValue(undefined),
		},
	};
});

// Mock runner to execute handler immediately
vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		try {
			await handler({config: undefined, startTime: Date.now()}, commandOptions);
		} catch {
			process.exit(1);
		}
	}),
}));

vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		error: vi.fn(),
		log: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			fail: vi.fn().mockReturnThis(),
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			text: '',
			warn: vi.fn().mockReturnThis(),
		}),
	},
}));

describe('initCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should create config if it does not exist', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		await initCommand('config.yaml');
		expect(FsUtils.writeText).toHaveBeenCalled();
	});

	it('should wipe data if force is true', async () => {
		await initCommand('config.yaml', true);
		expect(FsUtils.deletePath).toHaveBeenCalled();
	});

	it('should not overwrite if config exists and no force', async () => {
		vi.mocked(configExists).mockReturnValue(true);
		await initCommand('config.yaml', false);
		expect(FsUtils.writeText).not.toHaveBeenCalled();
	});

	it('should create config with custom workspace directory', async () => {
		vi.mocked(configExists).mockReturnValue(false);

		let capturedJsonc = '';
		vi.mocked(FsUtils.writeText).mockImplementation((_path, content) => {
			capturedJsonc = content;
			return Promise.resolve();
		});

		await initCommand('custom-data');

		const parsed = parse(capturedJsonc);
		expect(ConfigSchema.parse(parsed)).toBeDefined();
	});

	it('should throw error if writeFile fails', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		vi.mocked(FsUtils.writeText).mockRejectedValue(new Error('Disk full'));
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

		await initCommand('config.yaml');
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should generate a valid configuration file', async () => {
		vi.mocked(configExists).mockReturnValue(false);

		// Use the real writeText to capture the content
		let capturedJsonc = '';
		vi.mocked(FsUtils.writeText).mockImplementation((_path, content) => {
			capturedJsonc = content;
			return Promise.resolve();
		});

		await initCommand('config.jsonc');

		const parsed = parse(capturedJsonc);
		expect(() => ConfigSchema.parse(parsed)).not.toThrow();
	});
});
