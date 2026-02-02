import {describe, it, expect, vi, beforeEach} from 'vitest';
import {portfolioCommand} from '@/cli/commands/portfolio.ts';
import {SqliteStorage} from '@/gather/storage.ts';
import {YahooFinanceDataSource} from '@/gather/yahoo-finance.ts';
import {ModelPersistence} from '@/compute/persistence.ts';
import {loadConfig} from '@/config/config.ts';
import defaults from '@/constants/defaults.json' with {type: 'json'};

vi.mock('@/gather/storage.ts');
vi.mock('@/gather/yahoo-finance.ts');
vi.mock('@/compute/persistence.ts');
vi.mock('@/config/config.ts');
vi.mock('@/constants/defaults.json', () => ({
	default: [
		{symbol: 'AAPL', name: 'Apple Inc.'},
		{symbol: 'MSFT', name: 'Microsoft Corporation'},
	],
}));

describe('Portfolio Command', () => {
	const mockConfig = {
		api: {timeout: 10000, retries: 3, rateLimit: 1000},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(loadConfig).mockReturnValue(mockConfig as any);
		vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit');
		});
	});

	it('should list portfolio symbols when no options provided', async () => {
		const mockSymbols = [{symbol: 'AAPL', name: 'Apple Inc.'}];
		vi.mocked(SqliteStorage.prototype.getAllSymbols).mockReturnValue(mockSymbols);

		const consoleSpy = vi.spyOn(console, 'log');
		await portfolioCommand('config.json', {});

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('AAPL'));
	});

	it('should add default symbols', async () => {
		vi.mocked(SqliteStorage.prototype.symbolExists).mockReturnValue(false);
		const saveSpy = vi.mocked(SqliteStorage.prototype.saveSymbol);

		await portfolioCommand('config.json', {addDefaults: true});

		expect(saveSpy).toHaveBeenCalledTimes(2); // From mock defaults.json
		expect(saveSpy).toHaveBeenCalledWith('AAPL', 'Apple Inc.');
	});

	it('should add a specific symbol', async () => {
		vi.mocked(SqliteStorage.prototype.symbolExists).mockReturnValue(false);
		vi.mocked(YahooFinanceDataSource.prototype.validateSymbol).mockResolvedValue(true);
		vi.mocked(YahooFinanceDataSource.prototype.getCurrentQuote).mockResolvedValue({price: 150, currency: 'USD', name: 'Tesla Inc.'});
		const saveSpy = vi.mocked(SqliteStorage.prototype.saveSymbol);

		await portfolioCommand('config.json', {add: 'TSLA'});

		expect(saveSpy).toHaveBeenCalledWith('TSLA', 'Tesla Inc.');
	});

	it('should throw error if adding existing symbol', async () => {
		vi.mocked(SqliteStorage.prototype.symbolExists).mockReturnValue(true);

		await expect(portfolioCommand('config.json', {add: 'AAPL'})).rejects.toThrow('process.exit');
	});

	it('should throw error if adding invalid symbol', async () => {
		vi.mocked(SqliteStorage.prototype.symbolExists).mockReturnValue(false);
		vi.mocked(YahooFinanceDataSource.prototype.validateSymbol).mockResolvedValue(false);

		await expect(portfolioCommand('config.json', {add: 'INVALID'})).rejects.toThrow('process.exit');
	});

	it('should remove a specific symbol', async () => {
		vi.mocked(SqliteStorage.prototype.symbolExists).mockReturnValue(true);
		const deleteSpy = vi.mocked(SqliteStorage.prototype.deleteSymbol);
		const deleteModelSpy = vi.mocked(ModelPersistence.prototype.deleteModel);

		await portfolioCommand('config.json', {remove: 'AAPL'});

		expect(deleteSpy).toHaveBeenCalledWith('AAPL');
		expect(deleteModelSpy).toHaveBeenCalledWith('AAPL');
	});

	it('should throw error if removing non-existent symbol', async () => {
		vi.mocked(SqliteStorage.prototype.symbolExists).mockReturnValue(false);

		await expect(portfolioCommand('config.json', {remove: 'AAPL'})).rejects.toThrow('process.exit');
	});
});
