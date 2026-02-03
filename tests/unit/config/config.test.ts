import {beforeEach, describe, expect, it, vi} from 'vitest';
import {parse} from 'jsonc-parser';

import {FsUtils} from '../../../src/cli/utils/fs.ts';
import {configExists, getDefaultConfig, loadConfig, saveConfig} from '../../../src/config/config.ts';
import {DefaultConfig} from '../../../src/config/schema.ts';

vi.mock('node:fs');
vi.mock('../../../src/cli/utils/fs.ts', () => ({
	FsUtils: {
		ensureDir: vi.fn().mockResolvedValue(undefined),
		exists: vi.fn(),
		readTextSync: vi.fn(),
		writeText: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('jsonc-parser', () => ({
	parse: vi.fn(),
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
		vi.mocked(FsUtils.readTextSync).mockReturnValue('jsonc content');
		vi.mocked(parse).mockReturnValue(mockConfig);
		vi.mocked(FsUtils.exists).mockReturnValue(true);

		const config = loadConfig('config.jsonc');
		expect(config.prediction.days).toBe(60);
	});

	it('should throw error if config not found', () => {
		vi.mocked(FsUtils.exists).mockReturnValue(false);
		expect(() => loadConfig('nonexistent.jsonc')).toThrow(/Configuration file not found/);
	});

	it('should throw error if config is invalid JSONC', () => {
		vi.mocked(FsUtils.exists).mockReturnValue(true);
		vi.mocked(FsUtils.readTextSync).mockReturnValue('invalid jsonc');
		vi.mocked(parse).mockImplementation(() => {
			throw new Error('JSONC parse error');
		});
		expect(() => loadConfig('config.jsonc')).toThrow(/Invalid configuration file/);
	});

	it('should save config correctly', async () => {
		const mockConfig = DefaultConfig;
		await saveConfig(mockConfig, 'config.jsonc');
		expect(FsUtils.writeText).toHaveBeenCalled();
	});

	it('should check if config exists', () => {
		vi.mocked(FsUtils.exists).mockReturnValueOnce(true).mockReturnValueOnce(false);
		expect(configExists('config.jsonc')).toBe(true);
		expect(configExists('missing.jsonc')).toBe(false);
	});

	it('should get default config', () => {
		const config = getDefaultConfig();
		expect(config).toEqual(DefaultConfig);
	});

	it('should handle non-Error objects in loadConfig', () => {
		vi.mocked(FsUtils.exists).mockReturnValue(true);
		vi.mocked(FsUtils.readTextSync).mockImplementation(() => {
			throw 'Raw string error';
		});
		expect(() => loadConfig('config.jsonc')).toThrow('Raw string error');
	});

	it('should handle saveConfig failures', async () => {
		vi.mocked(FsUtils.writeText).mockRejectedValue(new Error('Write failed'));
		await expect(saveConfig(DefaultConfig, 'config.jsonc')).rejects.toThrow(/Failed to save configuration file/);
	});
});
