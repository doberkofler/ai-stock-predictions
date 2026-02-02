import {describe, it, expect, vi, beforeEach} from 'vitest';
import {importCommand} from '../../../../src/cli/commands/import.ts';
import {FsUtils} from '../../../../src/cli/utils/fs.ts';

const mockStorage = {
	overwriteSymbols: vi.fn().mockResolvedValue(undefined),
	overwriteHistoricalData: vi.fn().mockResolvedValue(undefined),
	overwriteModelsMetadata: vi.fn().mockResolvedValue(undefined),
	close: vi.fn(),
};

// Mock dependencies
vi.mock('../../../../src/cli/utils/fs.ts');

// Mock storage module but keep schemas original
vi.mock('../../../../src/gather/storage.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../../src/gather/storage.ts')>();
	return {
		...actual,
		SqliteStorage: vi.fn().mockImplementation(function (this: any) {
			return mockStorage;
		}),
	};
});

// Mock runner to execute handler immediately
vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		await handler({config: {}, startTime: Date.now()}, commandOptions);
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

describe('importCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock process.exit to prevent actual exit
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
	});

	it('should import data from json', async () => {
		// Mock readJson to return a valid export object
		vi.mocked(FsUtils.readJson).mockResolvedValue({
			version: '1.1.0',
			symbols: [{symbol: 'AAPL', name: 'Apple Inc.'}],
			historical_data: [{symbol: 'AAPL', date: '2023-01-01', open: 100, high: 110, low: 90, close: 105, volume: 1000, adjClose: 105}],
			models_metadata: [{symbol: 'AAPL', version: '1.0.0', trainedAt: '2023-01-01', dataPoints: 100, loss: 0.01, windowSize: 30, metrics: '{}'}],
		});

		await importCommand('export.json');

		expect(FsUtils.readJson).toHaveBeenCalled();
		expect(mockStorage.overwriteSymbols).toHaveBeenCalled();
		expect(mockStorage.overwriteHistoricalData).toHaveBeenCalled();
		expect(mockStorage.overwriteModelsMetadata).toHaveBeenCalled();
	});

	it('should handle errors in import', async () => {
		vi.mocked(FsUtils.readJson).mockRejectedValue(new Error('File Error'));

		await importCommand('export.json');
		expect(process.exit).toHaveBeenCalledWith(1);
	});
});
