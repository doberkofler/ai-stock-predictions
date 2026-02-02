import {describe, it, expect, vi, beforeEach} from 'vitest';
import {exportCommand} from '../../../../src/cli/commands/export.ts';
import {SqliteStorage} from '../../../../src/gather/storage.ts';
import {FsUtils} from '../../../../src/cli/utils/fs.ts';

const mockStorage = {
	getAllSymbols: vi.fn(),
	getAllQuotes: vi.fn(),
	getAllMetadata: vi.fn(),
	close: vi.fn(),
};

vi.mock('../../../../src/cli/utils/fs.ts');
vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function (this: any) {
		return mockStorage;
	}),
}));

// Mock runner to execute handler immediately
vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		try {
			await handler({config: {}, startTime: Date.now()}, commandOptions);
		} catch (error) {
			process.exit(1);
		}
	}),
}));

// Mock UI
vi.mock('../../../../src/cli/utils/ui.ts', () => ({
	ui: {
		log: vi.fn(),
		error: vi.fn(),
		spinner: vi.fn().mockReturnValue({
			start: vi.fn().mockReturnThis(),
			succeed: vi.fn().mockReturnThis(),
			fail: vi.fn().mockReturnThis(),
			text: '',
		}),
	},
}));

describe('exportCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	it('should export data to json', async () => {
		mockStorage.getAllSymbols.mockReturnValue([]);
		mockStorage.getAllQuotes.mockReturnValue([]);
		mockStorage.getAllMetadata.mockReturnValue([]);

		await exportCommand('config.yaml', 'export.json');
		expect(FsUtils.writeJson).toHaveBeenCalled();
	});

	it('should handle errors in export', async () => {
		mockStorage.getAllSymbols.mockImplementation(() => {
			throw new Error('DB Error');
		});

		await exportCommand('config.yaml', 'export.json');
		expect(process.exit).toHaveBeenCalledWith(1);
	});
});
