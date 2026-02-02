import {SqliteStorage} from '../../gather/storage.ts';
import {ModelPersistence} from '../../compute/persistence.ts';
import {join} from 'node:path';

/**
 * Service for managing symbols and associated data/models
 */
export const SymbolService = {
	/**
	 * Removes a symbol and all its associated data and models
	 * @param symbol - The symbol to remove
	 */
	removeSymbol: async (symbol: string): Promise<void> => {
		const storage = new SqliteStorage();
		const modelPersistence = new ModelPersistence(join(process.cwd(), 'data', 'models'));

		storage.deleteSymbol(symbol);
		await modelPersistence.deleteModel(symbol);
	},

	/**
	 * Gets all symbols currently in the database
	 * @returns Array of symbol entries
	 */
	getAllSymbols: (): {symbol: string; name: string}[] => {
		const storage = new SqliteStorage();
		return storage.getAllSymbols();
	},
};
