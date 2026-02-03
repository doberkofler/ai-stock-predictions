/**
 * Schema definitions for defaults.jsonc file
 * Validates default symbols configuration at load time
 */

import {z} from 'zod';

import {SymbolTypeSchema} from '../types/index.ts';

/**
 * Default symbol entry schema
 * Represents a single symbol with its metadata
 */
export const DefaultSymbolSchema = z.object({
	name: z.string().min(1, 'Symbol name cannot be empty'),
	priority: z.number().int().min(1).max(1000).describe('Gathering priority (lower = higher priority)'),
	symbol: z.string().min(1, 'Symbol ticker cannot be empty'),
	type: SymbolTypeSchema.describe('Symbol type: STOCK, INDEX, ETF, CRYPTO, or VOLATILITY'),
});

export type DefaultSymbol = z.infer<typeof DefaultSymbolSchema>;

/**
 * Defaults file structure schema
 * Validates the entire defaults.jsonc file
 */
export const DefaultsSchema = z.object({
	defaultSymbols: z.array(DefaultSymbolSchema).min(1, 'At least one default symbol must be defined'),
});

export type Defaults = z.infer<typeof DefaultsSchema>;
