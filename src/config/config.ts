/**
 * Configuration management with file operations and validation
 * Handles loading, saving, and validating config.json files
 */

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {parse, stringify} from 'yaml';
import type {Config} from './schema.ts';
import {ConfigSchema, DefaultConfig} from './schema.ts';
import chalk from 'chalk';
import {ensureDir} from 'fs-extra';

/**
 * Get configuration file path
 * @param [configPath] - Optional custom path
 * @returns Resolved configuration file path
 */
export function getConfigFilePath(configPath?: string): string {
	return join(process.cwd(), configPath ?? 'config.yaml');
}

/**
 * Load and validate configuration from file
 * @param [configPath] - Optional custom path
 * @throws {Error} If configuration file doesn't exist or is invalid
 * @returns Validated configuration object
 */
export function loadConfig(configPath?: string): Config {
	const resolvedPath = getConfigFilePath(configPath);
	if (!existsSync(resolvedPath)) {
		throw new Error(
			`${chalk.red('Configuration file not found')}: ${resolvedPath}\n` + `Run ${chalk.cyan('ai-stock-predictions init')} to create a configuration file.`,
		);
	}

	try {
		const content = readFileSync(resolvedPath, 'utf8');
		const rawConfig = parse(content) as unknown;
		return ConfigSchema.parse(rawConfig);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(
				`${chalk.red('Invalid configuration file')}: ${resolvedPath}\n` +
					`Error: ${error.message}\n` +
					`Run ${chalk.cyan('ai-stock-predictions init')} to create a new configuration file.`,
			);
		}
		throw error;
	}
}

/**
 * Save configuration to file with validation
 * @param config - Configuration object to save
 * @param [configPath] - Optional custom path
 * @throws {Error} If configuration is invalid or file cannot be written
 */
export async function saveConfig(config: Config, configPath?: string): Promise<void> {
	const resolvedPath = getConfigFilePath(configPath);
	try {
		// Validate configuration before saving
		const validatedConfig = ConfigSchema.parse(config);

		// Ensure directory exists
		await ensureDir(dirname(resolvedPath));

		// Write configuration file with YAML comments
		const yamlContent = stringify(validatedConfig);
		writeFileSync(resolvedPath, yamlContent, 'utf8');
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`${chalk.red('Failed to save configuration file')}: ${resolvedPath}\n` + `Error: ${error.message}`);
		}
		throw error;
	}
}

/**
 * Check if configuration file exists
 * @param [configPath] - Optional custom path
 * @returns True if configuration file exists
 */
export function configExists(configPath?: string): boolean {
	return existsSync(getConfigFilePath(configPath));
}

/**
 * Get default configuration
 * @returns Default configuration object
 */
export function getDefaultConfig(): Config {
	return {...DefaultConfig};
}
