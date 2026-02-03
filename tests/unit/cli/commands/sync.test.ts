import {beforeEach, describe, expect, it, vi} from 'vitest';

import {syncCommand} from '../../../../src/cli/commands/sync.ts';
import {SyncService} from '../../../../src/cli/services/sync-service.ts';

const mockStorage = {
	getAllSymbols: vi.fn(),
};

vi.mock('../../../../src/cli/services/sync-service.ts', () => ({
	SyncService: {
		syncSymbols: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('../../../../src/gather/storage.ts', () => ({
	SqliteStorage: vi.fn().mockImplementation(function () {
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
		mockStorage.getAllSymbols.mockReturnValue([{name: 'Apple Inc.', symbol: 'AAPL'}]);
		await syncCommand('config.jsonc');
		expect(SyncService.syncSymbols).toHaveBeenCalledWith([{name: 'Apple Inc.', symbol: 'AAPL'}], expect.any(Object));
	});
});
