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

describe('exportCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should export data to json', async () => {
		mockStorage.getAllSymbols.mockReturnValue([]);
		mockStorage.getAllQuotes.mockReturnValue([]);
		mockStorage.getAllMetadata.mockReturnValue([]);

		await exportCommand('export.json');
		expect(FsUtils.writeJson).toHaveBeenCalled();
	});

	it('should handle errors in export', async () => {
		mockStorage.getAllSymbols.mockImplementation(() => {
			throw new Error('DB Error');
		});
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

		await exportCommand('export.json');
		expect(process.exit).toHaveBeenCalledWith(1);
	});
});
