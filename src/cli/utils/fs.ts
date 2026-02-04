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
	 * Delete a file or directory (recursive and forced)
	 * @param path - Path to delete
	 */
	deletePath: async (path: string): Promise<void> => {
		await rm(path, {force: true, recursive: true});
	},

	/**
	 * Ensure a directory exists (creates recursively)
	 * @param path - Directory path
	 */
	ensureDir: async (path: string): Promise<void> => {
		await mkdir(path, {recursive: true});
	},

	/**
	 * Ensure a directory exists synchronously
	 * @param path - Directory path
	 */
	ensureDirSync: (path: string): void => {
		if (!existsSync(path)) {
			mkdirSync(path, {recursive: true});
		}
	},

	/**
	 * Check if a path exists
	 * @param path - Path to check
	 */
	exists: (path: string): boolean => {
		return existsSync(path);
	},

	/**
	 * Read JSON from a file
	 * @param path - File path
	 */
	readJson: async <T>(path: string): Promise<T> => {
		const content = await readFile(path, 'utf8');
		return JSON.parse(content) as T;
	},

	/**
	 * Read text from a file
	 * @param path - File path
	 */
	readText: async (path: string): Promise<string> => {
		return await readFile(path, 'utf8');
	},

	/**
	 * Read text from a file synchronously
	 * @param path - File path
	 */
	readTextSync: (path: string): string => {
		return readFileSync(path, 'utf8');
	},

	/**
	 * Recreate a directory by deleting it if it exists and then creating it
	 * @param path - Directory path
	 */
	recreateDir: async (path: string): Promise<void> => {
		if (existsSync(path)) {
			await rm(path, {force: true, recursive: true});
		}
		await mkdir(path, {recursive: true});
	},

	/**
	 * Write JSON to a file
	 * @param path - File path
	 * @param data - Object to serialize
	 */
	writeJson: async (path: string, data: unknown): Promise<void> => {
		const content = JSON.stringify(data, null, 2);
		await writeFile(path, content, 'utf8');
	},

	/**
	 * Write text to a file
	 * @param path - File path
	 * @param content - Text content
	 */
	writeText: async (path: string, content: string): Promise<void> => {
		await writeFile(path, content, 'utf8');
	},
};
