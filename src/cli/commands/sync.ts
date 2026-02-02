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
			title: 'Data Synchronization',
			description: 'Updating historical market data for all symbols in the portfolio.',
			configPath,
		},
		async ({config}) => {
			const storage = new SqliteStorage();
			const symbols = storage.getAllSymbols();
			await SyncService.syncSymbols(symbols, config);
		},
		{},
	);
}
