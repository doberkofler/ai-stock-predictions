import {describe, it, expect, vi, beforeEach} from 'vitest';
import {loadConfig, saveConfig, configExists, getDefaultConfig} from '../../../src/config/config.ts';
import * as fs from 'node:fs';
import {DefaultConfig} from '../../../src/config/schema.ts';
import {stringify, parse} from 'yaml';
import {FsUtils} from '../../../src/cli/utils/fs.ts';

vi.mock('node:fs');
vi.mock('../../../src/cli/utils/fs.ts', () => ({
	FsUtils: {
		exists: vi.fn(),
		readTextSync: vi.fn(),
		writeText: vi.fn().mockResolvedValue(undefined),
		ensureDir: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('yaml', () => ({
	parse: vi.fn(),
	stringify: vi.fn(),
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
		vi.mocked(FsUtils.readTextSync).mockReturnValue('yaml content');
		vi.mocked(parse).mockReturnValue(mockConfig);
		vi.mocked(FsUtils.exists).mockReturnValue(true);

		const config = loadConfig('config.yaml');
		expect(config.prediction.days).toBe(60);
	});

	it('should throw error if config not found', () => {
		vi.mocked(FsUtils.exists).mockReturnValue(false);
		expect(() => loadConfig('nonexistent.yaml')).toThrow(/Configuration file not found/);
	});

	it('should throw error if config is invalid YAML', () => {
		vi.mocked(FsUtils.exists).mockReturnValue(true);
		vi.mocked(FsUtils.readTextSync).mockReturnValue('invalid yaml');
		vi.mocked(parse).mockImplementation(() => {
			throw new Error('YAML parse error');
		});
		expect(() => loadConfig('config.yaml')).toThrow(/Invalid configuration file/);
	});

	it('should save config correctly', async () => {
		const mockConfig = DefaultConfig;
		vi.mocked(stringify).mockReturnValue('yaml content');
		await saveConfig(mockConfig, 'config.yaml');
		expect(FsUtils.writeText).toHaveBeenCalled();
	});

	it('should check if config exists', () => {
		vi.mocked(FsUtils.exists).mockReturnValueOnce(true).mockReturnValueOnce(false);
		expect(configExists('config.yaml')).toBe(true);
		expect(configExists('missing.yaml')).toBe(false);
	});

	it('should get default config', () => {
		const config = getDefaultConfig();
		expect(config).toEqual(DefaultConfig);
	});

	it('should handle non-Error objects in loadConfig', () => {
		vi.mocked(FsUtils.exists).mockReturnValue(true);
		vi.mocked(FsUtils.readTextSync).mockImplementation(() => {
			// eslint-disable-next-line no-throw-literal
			throw 'Raw string error';
		});
		expect(() => loadConfig('config.yaml')).toThrow('Raw string error');
	});

	it('should handle saveConfig failures', async () => {
		vi.mocked(FsUtils.writeText).mockRejectedValue(new Error('Write failed'));
		await expect(saveConfig(DefaultConfig, 'config.yaml')).rejects.toThrow(/Failed to save configuration file/);
	});
});
