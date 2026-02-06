import {beforeEach, describe, expect, it, vi} from 'vitest';

import {importCommand} from '../../../../src/cli/commands/import.ts';
import {FsUtils} from '../../../../src/cli/utils/fs.ts';

const mockStorage = {
	close: vi.fn(),
	// eslint-disable-next-line unicorn/no-useless-undefined
	overwriteHistoricalData: vi.fn().mockResolvedValue(undefined),
	// eslint-disable-next-line unicorn/no-useless-undefined
	overwriteSymbols: vi.fn().mockResolvedValue(undefined),
};

// Mock dependencies
vi.mock('../../../../src/cli/utils/fs.ts');

// Mock storage module but keep schemas original
vi.mock('../../../../src/gather/storage.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/gather/storage.ts')>();
	return {
		...actual,
		SqliteStorage: vi.fn().mockImplementation(function () {
			return mockStorage;
		}),
	};
});

// Mock runner to execute handler immediately
vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			await handler({config: {storage: {dataDirectory: 'data'}}, startTime: Date.now()}, commandOptions);
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

describe('importCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock process.exit to prevent actual exit
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: null | number | string) => never);
	});

	it('should import data from json', async () => {
		// Mock readJson to return a valid v2.0.0 export object
		vi.mocked(FsUtils.readJson).mockResolvedValue({
			exportedAt: '2023-01-01T00:00:00.000Z',
			historical_data: [{adjClose: 105, close: 105, date: '2023-01-01', high: 110, low: 90, open: 100, symbol: 'AAPL', volume: 1000}],
			symbols: [{name: 'Apple Inc.', priority: 100, symbol: 'AAPL', type: 'STOCK'}],
			version: '2.0.0',
		});

		await importCommand('import.json');

		expect(FsUtils.readJson).toHaveBeenCalled();
		expect(mockStorage.overwriteSymbols).toHaveBeenCalled();
		expect(mockStorage.overwriteHistoricalData).toHaveBeenCalled();
	});

	it('should handle errors in import', async () => {
		vi.mocked(FsUtils.readJson).mockRejectedValue(new Error('File Error'));

		await importCommand('import.json');
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(process.exit).toHaveBeenCalledWith(1);
	});

	it('should reject v1.x export files', async () => {
		// Mock readJson to return an old v1.x export format
		vi.mocked(FsUtils.readJson).mockResolvedValue({
			historical_data: [{adjClose: 105, close: 105, date: '2023-01-01', high: 110, low: 90, open: 100, symbol: 'AAPL', volume: 1000}],
			models_metadata: [],
			symbols: [{name: 'Apple Inc.', symbol: 'AAPL'}],
			version: '1.1.0',
		});

		await importCommand('import.json');
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(process.exit).toHaveBeenCalledWith(1);
	});
});
