import {describe, it, expect, vi, beforeEach} from 'vitest';
import {initCommand} from '../../../../src/cli/commands/init.ts';
import {FsUtils} from '../../../../src/cli/utils/fs.ts';
import {configExists} from '../../../../src/config/config.ts';

vi.mock('../../../../src/cli/utils/fs.ts');
vi.mock('../../../../src/config/config.ts', () => ({
	configExists: vi.fn(),
	getConfigFilePath: vi.fn().mockReturnValue('config.yaml'),
	getDefaultConfig: vi.fn().mockReturnValue({
		dataSource: {},
		training: {},
		model: {},
		prediction: {directory: 'output'},
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
		expect(FsUtils.ensureDir).toHaveBeenCalled();
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

	it('should throw error if writeFile fails', async () => {
		vi.mocked(configExists).mockReturnValue(false);
		vi.mocked(FsUtils.writeText).mockRejectedValue(new Error('Disk full'));
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

		await initCommand('config.yaml');
		expect(process.exit).toHaveBeenCalledWith(1);
	});
});
