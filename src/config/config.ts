/**
 * Configuration management with file operations and validation
 * Handles loading, saving, and validating config.json files
 */

import chalk from 'chalk';
import {dirname, join} from 'node:path';
import {parse, stringify} from 'yaml';

import type {Config} from './schema.ts';

import {FsUtils} from '../cli/utils/fs.ts';
import {ConfigSchema, DefaultConfig} from './schema.ts';

/**
 * Check if configuration file exists
 * @param [configPath] - Optional custom path
 * @returns True if configuration file exists
 */
export function configExists(configPath?: string): boolean {
	return FsUtils.exists(getConfigFilePath(configPath));
}

/**
 * Get configuration file path
 * @param [configPath] - Optional custom path
 * @returns Resolved configuration file path
 */
export function getConfigFilePath(configPath?: string): string {
	return join(process.cwd(), configPath ?? 'config.yaml');
}

/**
 * Get default configuration
 * @returns Default configuration object
 */
export function getDefaultConfig(): Config {
	return {...DefaultConfig};
}

/**
 * Load and validate configuration from file
 * @param [configPath] - Optional custom path
 * @throws {Error} If configuration file doesn't exist or is invalid
 * @returns Validated configuration object
 */
export function loadConfig(configPath?: string): Config {
	const resolvedPath = getConfigFilePath(configPath);
	if (!FsUtils.exists(resolvedPath)) {
		throw new Error(
			`${chalk.red('Configuration file not found')}: ${resolvedPath}\n` + `Run ${chalk.cyan('ai-stock-predictions init')} to create a configuration file.`,
		);
	}

	try {
		const content = FsUtils.readTextSync(resolvedPath);
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
		await FsUtils.ensureDir(dirname(resolvedPath));

		// Write configuration file with YAML comments
		const yamlContent = stringify(validatedConfig);
		await FsUtils.writeText(resolvedPath, yamlContent);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`${chalk.red('Failed to save configuration file')}: ${resolvedPath}\n` + `Error: ${error.message}`);
		}
		throw error;
	}
}
