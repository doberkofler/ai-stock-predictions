import {beforeEach, describe, expect, it, vi} from 'vitest';

import {exportCommand} from '../../../../src/cli/commands/export.ts';
import {FsUtils} from '../../../../src/cli/utils/fs.ts';

const mockStorage = {
	close: vi.fn(),
	getAllQuotes: vi.fn(),
	getAllSymbols: vi.fn(),
};

vi.mock('../../../../src/cli/utils/fs.ts');
vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function () {
		return mockStorage;
	}),
}));

// Mock runner to execute handler immediately
vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			await handler({config: {}, startTime: Date.now()}, commandOptions);
		} catch {
			process.exit(1);
		}
	}),
}));

// Mock UI
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

describe('exportCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: null | number | string) => never);
	});

	it('should export data to json', async () => {
		mockStorage.getAllSymbols.mockReturnValue([]);
		mockStorage.getAllQuotes.mockReturnValue([]);

		await exportCommand('export.json');
		expect(FsUtils.writeJson).toHaveBeenCalled();
	});

	it('should handle errors in export', async () => {
		mockStorage.getAllSymbols.mockImplementation(() => {
			throw new Error('DB Error');
		});

		await exportCommand('export.json');
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(process.exit).toHaveBeenCalledWith(1);
	});
});
