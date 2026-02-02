import {describe, it, expect, vi, beforeEach} from 'vitest';
import {syncCommand} from '../../../../src/cli/commands/sync.ts';
import {SyncService} from '../../../../src/cli/services/sync-service.ts';
import {SqliteStorage} from '../../../../src/gather/storage.ts';

const mockStorage = {
	getAllSymbols: vi.fn(),
};

vi.mock('../../../../src/cli/services/sync-service.ts', () => ({
	SyncService: {
		syncSymbols: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function (this: any) {
		return mockStorage;
	}),
}));

vi.mock('../../../../src/cli/utils/runner.ts', () => ({
	runCommand: vi.fn().mockImplementation(async (_options, handler, commandOptions) => {
		await handler({config: {}, startTime: Date.now()}, commandOptions);
	}),
}));

describe('syncCommand', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should call syncSymbols with all symbols', async () => {
		mockStorage.getAllSymbols.mockReturnValue([{symbol: 'AAPL', name: 'Apple Inc.'}]);
		await syncCommand('config.yaml');
		expect(SyncService.syncSymbols).toHaveBeenCalledWith([{symbol: 'AAPL', name: 'Apple Inc.'}], expect.any(Object));
	});
});
