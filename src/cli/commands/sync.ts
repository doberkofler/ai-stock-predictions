/**
 * Sync command - Updates historical market data for all symbols
 */

import {SqliteStorage} from '../../gather/storage.ts';
import {SyncService} from '../services/sync-service.ts';
import {runCommand} from '../utils/runner.ts';

/**
 * Sync command implementation
 * @param configPath - Path to the configuration file
 */
export async function syncCommand(configPath: string): Promise<void> {
	await runCommand(
		{
			configPath,
			description: 'Updating historical market data for all symbols in the portfolio.',
			nextSteps: ['Run: {cli} train to build prediction models'],
			title: 'Data Synchronization',
		},
		async ({config}) => {
			if (!config) {
				throw new Error('Configuration file missing. Run "init" first to create a default configuration.');
			}
			const storage = new SqliteStorage();
			const symbols = storage.getAllSymbols();
			await SyncService.syncSymbols(symbols, config);
		},
		{},
	);
}
