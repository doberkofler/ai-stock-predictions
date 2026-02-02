import {describe, it, expect, vi, beforeEach} from 'vitest';
import {loadConfig, saveConfig, configExists, getDefaultConfig} from '../../../src/config/config.ts';
import * as fs from 'node:fs';
import {DefaultConfig} from '../../../src/config/schema.ts';

vi.mock('node:fs');
vi.mock('fs-extra', () => ({
	ensureDir: vi.fn().mockResolvedValue(undefined),
}));

describe('Config', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should load config correctly', () => {
		const mockConfig = {
			...DefaultConfig,
			prediction: {days: 60, trainSplit: 0.7},
		};
		vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));
		vi.mocked(fs.existsSync).mockReturnValue(true);

		const config = loadConfig('config.json');
		expect(config.prediction.days).toBe(60);
	});

	it('should throw error if config not found', () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		expect(() => loadConfig('nonexistent.json')).toThrow(/Configuration file not found/);
	});

	it('should throw error if config is invalid JSON', () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
		expect(() => loadConfig('config.json')).toThrow(/Invalid configuration file/);
	});

	it('should throw error if config parsing throws non-Error', () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			// eslint-disable-next-line no-throw-literal
			throw 'Non-error throw';
		});
		expect(() => loadConfig('config.json')).toThrow('Non-error throw');
	});

	it('should save config correctly', async () => {
		const mockConfig = DefaultConfig;
		await saveConfig(mockConfig, 'config.json');
		expect(fs.writeFileSync).toHaveBeenCalled();
	});

	it('should throw error if save fails', async () => {
		vi.mocked(fs.writeFileSync).mockImplementation(() => {
			throw new Error('Write failed');
		});
		await expect(saveConfig(DefaultConfig, 'config.json')).rejects.toThrow(/Failed to save configuration file/);
	});

	it('should throw error if save throws non-Error', async () => {
		vi.mocked(fs.writeFileSync).mockImplementation(() => {
			// eslint-disable-next-line no-throw-literal
			throw 'Write failed non-error';
		});
		await expect(saveConfig(DefaultConfig, 'config.json')).rejects.toThrow('Write failed non-error');
	});

	it('should check if config exists', () => {
		vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
		expect(configExists('config.json')).toBe(true);
		expect(configExists('missing.json')).toBe(false);
	});

	it('should get default config', () => {
		const config = getDefaultConfig();
		expect(config).toEqual(DefaultConfig);
	});
});
