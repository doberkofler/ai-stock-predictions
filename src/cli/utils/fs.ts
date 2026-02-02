/**
 * File system utility functions
 * Centralizes filesystem operations and security suppressions
 */

import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';

/**
 * File system utilities
 */
export const FsUtils = {
	/**
	 * Check if a path exists
	 * @param path - Path to check
	 */
	exists: (path: string): boolean => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		return existsSync(path);
	},

	/**
	 * Read text from a file synchronously
	 * @param path - File path
	 */
	readTextSync: (path: string): string => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		return readFileSync(path, 'utf8');
	},

	/**
	 * Ensure a directory exists (creates recursively)
	 * @param path - Directory path
	 */
	ensureDir: async (path: string): Promise<void> => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		await mkdir(path, {recursive: true});
	},

	/**
	 * Ensure a directory exists synchronously
	 * @param path - Directory path
	 */
	ensureDirSync: (path: string): void => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		if (!existsSync(path)) {
			// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
			mkdirSync(path, {recursive: true});
		}
	},

	/**
	 * Delete a file or directory (recursive and forced)
	 * @param path - Path to delete
	 */
	deletePath: async (path: string): Promise<void> => {
		 
		await rm(path, {force: true, recursive: true});
	},

	/**
	 * Recreate a directory by deleting it if it exists and then creating it
	 * @param path - Directory path
	 */
	recreateDir: async (path: string): Promise<void> => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		if (existsSync(path)) {
			 
			await rm(path, {force: true, recursive: true});
		}
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		await mkdir(path, {recursive: true});
	},

	/**
	 * Read text from a file
	 * @param path - File path
	 */
	readText: async (path: string): Promise<string> => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		return await readFile(path, 'utf8');
	},

	/**
	 * Write text to a file
	 * @param path - File path
	 * @param content - Text content
	 */
	writeText: async (path: string, content: string): Promise<void> => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		await writeFile(path, content, 'utf8');
	},

	/**
	 * Read JSON from a file
	 * @param path - File path
	 */
	readJson: async <T>(path: string): Promise<T> => {
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		const content = await readFile(path, 'utf8');
		return JSON.parse(content) as T;
	},

	/**
	 * Write JSON to a file
	 * @param path - File path
	 * @param data - Object to serialize
	 */
	writeJson: async (path: string, data: unknown): Promise<void> => {
		const content = JSON.stringify(data, null, 2);
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
		await writeFile(path, content, 'utf8');
	},
};
