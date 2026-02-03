/**
 * Defaults loader utility
 * Loads and validates defaults.jsonc file using jsonc-parser
 */

import {parse} from 'jsonc-parser';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import type {Defaults, DefaultSymbol} from './defaults-schema.ts';

import {DefaultsSchema} from './defaults-schema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get all default symbols
 * @returns Array of default symbols
 */
export function getDefaultSymbols(): DefaultSymbol[] {
	return loadDefaults().defaultSymbols;
}

/**
 * Get market indices (INDEX and VOLATILITY types)
 * @returns Array of market index symbols
 */
export function getMarketIndices(): DefaultSymbol[] {
	return getDefaultSymbols().filter((symbol) => symbol.type === 'INDEX' || symbol.type === 'VOLATILITY');
}

/**
 * Get symbols by type
 * @param type - Symbol type to filter by
 * @returns Filtered array of default symbols
 */
export function getSymbolsByType(type: DefaultSymbol['type']): DefaultSymbol[] {
	return getDefaultSymbols().filter((symbol) => symbol.type === type);
}

/**
 * Load and validate defaults.jsonc file
 * @throws {Error} If file cannot be read or validation fails
 * @returns Validated defaults configuration
 */
export function loadDefaults(): Defaults {
	const defaultsPath = join(__dirname, 'defaults.jsonc');

	try {
		const content = readFileSync(defaultsPath, 'utf8');
		const rawDefaults = parse(content) as unknown;
		return DefaultsSchema.parse(rawDefaults);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to load defaults.jsonc: ${error.message}`);
		}
		throw error;
	}
}
