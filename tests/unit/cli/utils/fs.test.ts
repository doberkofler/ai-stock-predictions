import {describe, it, expect, vi, beforeEach} from 'vitest';
import {FsUtils} from '../../../../src/cli/utils/fs.ts';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('FsUtils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('exists', () => {
		it('should return true if file exists', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			expect(FsUtils.exists('test.txt')).toBe(true);
		});

		it('should return false if file does not exist', () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			expect(FsUtils.exists('test.txt')).toBe(false);
		});
	});

	describe('readTextSync', () => {
		it('should read text from a file', () => {
			vi.mocked(fs.readFileSync).mockReturnValue('hello world');
			expect(FsUtils.readTextSync('test.txt')).toBe('hello world');
		});
	});

	describe('ensureDir', () => {
		it('should create a directory recursively', async () => {
			await FsUtils.ensureDir('some/dir');
			expect(fsPromises.mkdir).toHaveBeenCalledWith('some/dir', {recursive: true});
		});
	});

	describe('ensureDirSync', () => {
		it('should create a directory if it does not exist', () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			FsUtils.ensureDirSync('some/dir');
			expect(fs.mkdirSync).toHaveBeenCalledWith('some/dir', {recursive: true});
		});

		it('should not create a directory if it exists', () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			FsUtils.ensureDirSync('some/dir');
			expect(fs.mkdirSync).not.toHaveBeenCalled();
		});
	});

	describe('deletePath', () => {
		it('should delete a path', async () => {
			await FsUtils.deletePath('some/path');
			expect(fsPromises.rm).toHaveBeenCalledWith('some/path', {force: true, recursive: true});
		});
	});

	describe('recreateDir', () => {
		it('should delete and then create a directory', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(true);
			await FsUtils.recreateDir('some/dir');
			expect(fsPromises.rm).toHaveBeenCalledWith('some/dir', {force: true, recursive: true});
			expect(fsPromises.mkdir).toHaveBeenCalledWith('some/dir', {recursive: true});
		});

		it('should just create a directory if it does not exist', async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);
			await FsUtils.recreateDir('some/dir');
			expect(fsPromises.rm).not.toHaveBeenCalled();
			expect(fsPromises.mkdir).toHaveBeenCalledWith('some/dir', {recursive: true});
		});
	});

	describe('readText', () => {
		it('should read text from a file', async () => {
			vi.mocked(fsPromises.readFile).mockResolvedValue('content');
			const content = await FsUtils.readText('test.txt');
			expect(content).toBe('content');
		});
	});

	describe('writeText', () => {
		it('should write text to a file', async () => {
			await FsUtils.writeText('test.txt', 'content');
			expect(fsPromises.writeFile).toHaveBeenCalledWith('test.txt', 'content', 'utf8');
		});
	});

	describe('readJson', () => {
		it('should read and parse JSON from a file', async () => {
			vi.mocked(fsPromises.readFile).mockResolvedValue('{"key": "value"}');
			const data = await FsUtils.readJson<{key: string}>('test.json');
			expect(data).toEqual({key: 'value'});
		});
	});

	describe('writeJson', () => {
		it('should stringify and write JSON to a file', async () => {
			await FsUtils.writeJson('test.json', {key: 'value'});
			expect(fsPromises.writeFile).toHaveBeenCalledWith('test.json', '{\n  "key": "value"\n}', 'utf8');
		});
	});
});
