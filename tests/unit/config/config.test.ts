import {describe, it, expect, vi, beforeEach} from 'vitest';
import {loadConfig, saveConfig, configExists, getConfigFilePath, getDefaultConfig} from '@/config/config.ts';
import * as fs from 'node:fs';
import {ensureDir} from 'fs-extra';
import {DefaultConfig} from '@/config/schema.ts';
import {join} from 'node:path';

vi.mock('node:fs', () => ({
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	existsSync: vi.fn(),
}));

vi.mock('fs-extra', () => ({
	ensureDir: vi.fn().mockResolvedValue(undefined),
}));

describe('Config Manager', () => {
	const mockCwd = '/test/cwd';

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);
	});

	describe('getConfigFilePath', () => {
		it('should return default path if no path provided', () => {
			const path = getConfigFilePath();
			expect(path).toBe(join(mockCwd, 'config.json'));
		});

		it('should return custom path if provided', () => {
			const path = getConfigFilePath('custom.json');
			expect(path).toBe(join(mockCwd, 'custom.json'));
		});
	});

	describe('loadConfig', () => {
		it('should throw error if config file does not exist', () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			expect(() => loadConfig()).toThrow(/Configuration file not found/);
		});

		it('should return parsed config if file exists and is valid', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(DefaultConfig));
			const config = loadConfig();
			expect(config).toEqual(DefaultConfig);
		});

		it('should use custom path when provided', () => {
			const customPath = 'custom.json';
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(DefaultConfig));
			loadConfig(customPath);
			expect(fs.existsSync).toHaveBeenCalledWith(join(mockCwd, customPath));
		});
	});

	describe('saveConfig', () => {
		it('should save config to file if valid', async () => {
			await saveConfig(DefaultConfig);
			expect(fs.writeFileSync).toHaveBeenCalled();
		});

		it('should use custom path when provided', async () => {
			const customPath = 'custom.json';
			await saveConfig(DefaultConfig, customPath);
			expect(fs.writeFileSync).toHaveBeenCalledWith(join(mockCwd, customPath), expect.any(String), 'utf8');
		});
	});

	describe('configExists', () => {
		it('should return true if file exists', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			expect(configExists()).toBe(true);
		});

		it('should respect custom path', () => {
			const customPath = 'custom.json';
			vi.mocked(fs.existsSync).mockReturnValue(true);
			expect(configExists(customPath)).toBe(true);
			expect(fs.existsSync).toHaveBeenCalledWith(join(mockCwd, customPath));
		});
	});

	describe('getDefaultConfig', () => {
		it('should return a copy of the default config', () => {
			const config = getDefaultConfig();
			expect(config).toEqual(DefaultConfig);
			expect(config).not.toBe(DefaultConfig);
		});
	});
});
