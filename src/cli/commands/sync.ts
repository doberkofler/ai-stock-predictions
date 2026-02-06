/**
 * Sync command - Updates historical market data for all symbols
 */

import {SqliteStorage} from '../../gather/storage.ts';
import {SyncService} from '../services/sync-service.ts';
import {runCommand} from '../utils/runner.ts';

/**
 * Sync command implementation
 * @param workspaceDir - Path to the workspace directory
 */
export async function syncCommand(workspaceDir: string): Promise<void> {
	await runCommand(
		{
			workspaceDir,
			description: 'Updating historical market data for all symbols in the portfolio.',
			nextSteps: ['Run: {cli} train to build prediction models'],
			title: 'Data Synchronization',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage(workspaceDir);
			const symbols = storage.getAllSymbols();
			await SyncService.syncSymbols(symbols, config, workspaceDir);
		},
		{},
	);
}
