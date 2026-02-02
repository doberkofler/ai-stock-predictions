import {describe, it, expect, vi, beforeEach} from 'vitest';
import {loadConfig, saveConfig, configExists, getDefaultConfig} from '../../../src/config/config.ts';
import * as fs from 'node:fs';
import {DefaultConfig} from '../../../src/config/schema.ts';
import {stringify} from 'yaml';

vi.mock('node:fs');
vi.mock('yaml', () => ({
	parse: vi.fn(),
	stringify: vi.fn(),
}));
import {parse} from 'yaml';

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
			prediction: {...DefaultConfig.prediction, days: 60},
		};
		vi.mocked(fs.readFileSync).mockReturnValue('yaml content');
		vi.mocked(parse).mockReturnValue(mockConfig);
		vi.mocked(fs.existsSync).mockReturnValue(true);

		const config = loadConfig('config.yaml');
		expect(config.prediction.days).toBe(60);
	});

	it('should throw error if config not found', () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);
		expect(() => loadConfig('nonexistent.yaml')).toThrow(/Configuration file not found/);
	});

	it('should throw error if config is invalid YAML', () => {
		vi.mocked(fs.existsSync).mockReturnValue(true);
		vi.mocked(fs.readFileSync).mockReturnValue('invalid yaml');
		vi.mocked(parse).mockImplementation(() => {
			throw new Error('YAML parse error');
		});
		expect(() => loadConfig('config.yaml')).toThrow(/Invalid configuration file/);
	});

	it('should save config correctly', async () => {
		const mockConfig = DefaultConfig;
		vi.mocked(stringify).mockReturnValue('yaml content');
		await saveConfig(mockConfig, 'config.yaml');
		expect(fs.writeFileSync).toHaveBeenCalled();
	});

	it('should check if config exists', () => {
		vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
		expect(configExists('config.yaml')).toBe(true);
		expect(configExists('missing.yaml')).toBe(false);
	});

	it('should get default config', () => {
		const config = getDefaultConfig();
		expect(config).toEqual(DefaultConfig);
	});
});
