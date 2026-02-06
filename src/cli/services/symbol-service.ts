import {join} from 'node:path';

import type {Config} from '../../config/schema.ts';

import {ModelPersistence} from '../../compute/persistence.ts';
import {SqliteStorage} from '../../gather/storage.ts';

/**
 * Service for managing symbols and associated data/models
 */
export const SymbolService = {
	/**
	 * Gets all symbols currently in the database
	 * @param workspaceDir - Workspace directory
	 * @returns Array of symbol entries
	 */
	getAllSymbols: (workspaceDir: string): {name: string; symbol: string}[] => {
		const storage = new SqliteStorage(workspaceDir);
		return storage.getAllSymbols();
	},

	/**
	 * Removes a symbol and all its associated data and models
	 * @param symbol - The symbol to remove
	 * @param _config - Application configuration
	 * @param workspaceDir - Workspace directory
	 */
	removeSymbol: async (symbol: string, _config: Config, workspaceDir: string): Promise<void> => {
		const storage = new SqliteStorage(workspaceDir);
		const modelPersistence = new ModelPersistence(join(workspaceDir, 'models'));

		storage.deleteSymbol(symbol);
		await modelPersistence.deleteModel(symbol);
	},
};
