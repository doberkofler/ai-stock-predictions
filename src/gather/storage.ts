/**
 * SQLite-based storage implementation
 * Provides persistence layer for stock data and model metadata using relational databases
 */

import Database from 'better-sqlite3';
import {join} from 'node:path';
import {z} from 'zod';
import {existsSync, mkdirSync} from 'node:fs';

import {ErrorHandler} from '../cli/utils/errors.ts';
import type {ModelMetadata} from '../compute/lstm-model.ts';
import type {StockDataPoint} from '../types/index.ts';

/**
 * Stock data point schema for validation
 */
const StockDataPointSchema = z.object({
	date: z.string(),
	open: z.number(),
	high: z.number(),
	low: z.number(),
	close: z.number(),
	volume: z.number(),
	adjClose: z.number(),
});

const StockDataSchema = z.array(StockDataPointSchema);

/**
 * Model metadata schema for validation
 */
const ModelMetadataSchema = z.object({
	version: z.string(),
	trainedAt: z.string().or(z.date()),
	dataPoints: z.number(),
	loss: z.number(),
	windowSize: z.number(),
	metrics: z.record(z.string(), z.number()),
	symbol: z.string(),
});

/**
 * Type for historical data row
 */
export type HistoricalRow = {
	symbol: string;
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	adjClose: number;
};

/**
 * Type for model metadata row
 */
export type MetadataRow = {
	symbol: string;
	version: string;
	trainedAt: string;
	dataPoints: number;
	loss: number;
	windowSize: number;
	metrics: string;
};

/**
 * Type for symbol row
 */
export type SymbolRow = {
	symbol: string;
	name: string;
};

/**
 * SQLite storage implementation
 */
export class SqliteStorage {
	private readonly dataDir: string;
	private readonly historicalDb: Database.Database;
	private readonly modelsDb: Database.Database;

	public constructor() {
		this.dataDir = join(process.cwd(), 'data');

		if (!existsSync(this.dataDir)) {
			mkdirSync(this.dataDir, {recursive: true});
		}

		this.historicalDb = new Database(join(this.dataDir, 'historical_data.db'));
		this.modelsDb = new Database(join(this.dataDir, 'models.db'));

		this.initializeDatabases();
	}

	/**
	 * Initialize database schemas
	 */
	private initializeDatabases(): void {
		// Historical Data Schema
		this.historicalDb.exec(`
			CREATE TABLE IF NOT EXISTS quotes (
				symbol TEXT,
				date TEXT,
				open REAL,
				high REAL,
				low REAL,
				close REAL,
				volume REAL,
				adjClose REAL,
				PRIMARY KEY (symbol, date)
			);
			CREATE INDEX IF NOT EXISTS idx_quotes_symbol ON quotes (symbol);
			CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes (date);

			CREATE TABLE IF NOT EXISTS symbols (
				symbol TEXT PRIMARY KEY,
				name TEXT
			);
		`);

		// Models Metadata Schema
		this.modelsDb.exec(`
			CREATE TABLE IF NOT EXISTS metadata (
				symbol TEXT PRIMARY KEY,
				version TEXT,
				trainedAt TEXT,
				dataPoints INTEGER,
				loss REAL,
				windowSize INTEGER,
				metrics TEXT
			);
		`);
	}

	/**
	 * Save symbol information
	 * @param {string} symbol - Stock symbol
	 * @param {string} name - Company name
	 */
	public saveSymbol(symbol: string, name: string): void {
		const upsert = this.historicalDb.prepare(`
			INSERT OR REPLACE INTO symbols (symbol, name)
			VALUES (?, ?)
		`);
		upsert.run(symbol, name);
	}

	/**
	 * Get symbol name
	 * @param {string} symbol - Stock symbol
	 * @returns {string | null} Company name or null if not found
	 */
	public getSymbolName(symbol: string): string | null {
		const stmt = this.historicalDb.prepare('SELECT name FROM symbols WHERE symbol = ?');
		const row = stmt.get(symbol) as {name: string} | undefined;
		return row?.name ?? null;
	}

	/**
	 * Get stock data for a symbol
	 * @param {string} symbol - Stock symbol
	 * @returns {Promise<StockDataPoint[] | null>} Array of stock data points or null if not found
	 */
	public getStockData(symbol: string): Promise<StockDataPoint[] | null> {
		const context = {
			operation: 'get-stock-data',
			symbol,
			step: 'sqlite-read',
		};

		const result = ErrorHandler.wrapSync(() => {
			const stmt = this.historicalDb.prepare('SELECT date, open, high, low, close, volume, adjClose FROM quotes WHERE symbol = ? ORDER BY date ASC');
			const rows = stmt.all(symbol) as StockDataPoint[];

			if (rows.length === 0) {
				return null;
			}

			return StockDataSchema.parse(rows);
		}, context);

		return Promise.resolve(result);
	}

	/**
	 * Save stock data for a symbol
	 * @param {string} symbol - Stock symbol
	 * @param {StockDataPoint[]} data - Array of stock data points
	 * @returns {Promise<void>}
	 */
	public saveStockData(symbol: string, data: StockDataPoint[]): Promise<void> {
		const context = {
			operation: 'save-stock-data',
			symbol,
			step: 'sqlite-write',
		};

		ErrorHandler.wrapSync(() => {
			const insert = this.historicalDb.prepare(`
				INSERT OR REPLACE INTO quotes (symbol, date, open, high, low, close, volume, adjClose)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`);

			const transaction = this.historicalDb.transaction((quotes: StockDataPoint[]) => {
				for (const quote of quotes) {
					insert.run(symbol, quote.date, quote.open, quote.high, quote.low, quote.close, quote.volume, quote.adjClose);
				}
			});

			transaction(data);
		}, context);

		return Promise.resolve();
	}

	/**
	 * Get all available stock symbols from the quotes table
	 * @returns {Promise<string[]>} Array of stock symbols
	 */
	public getAvailableSymbols(): Promise<string[]> {
		const context = {
			operation: 'get-available-symbols',
			step: 'sqlite-read',
		};

		const result = ErrorHandler.wrapSync(() => {
			const stmt = this.historicalDb.prepare('SELECT DISTINCT symbol FROM quotes');
			const rows = stmt.all() as {symbol: string}[];
			return rows.map((r) => r.symbol);
		}, context);

		return Promise.resolve(result);
	}

	/**
	 * Get model metadata for a symbol
	 * @param {string} symbol - Stock symbol
	 * @returns {Promise<ModelMetadata | null>} Model metadata or null if not found
	 */
	public getModelMetadata(symbol: string): Promise<ModelMetadata | null> {
		const context = {
			operation: 'get-model-metadata',
			symbol,
			step: 'sqlite-read',
		};

		const result = ErrorHandler.wrapSync(() => {
			const stmt = this.modelsDb.prepare('SELECT * FROM metadata WHERE symbol = ?');
			const row = stmt.get(symbol) as MetadataRow | undefined;

			if (!row) {
				return null;
			}

			const metadataRaw: unknown = {
				version: row.version,
				trainedAt: row.trainedAt,
				dataPoints: row.dataPoints,
				loss: row.loss,
				windowSize: row.windowSize,
				metrics: JSON.parse(row.metrics) as Record<string, number>,
				symbol: row.symbol,
			};

			const validated = ModelMetadataSchema.parse(metadataRaw);

			return {
				version: validated.version,
				trainedAt: new Date(validated.trainedAt),
				dataPoints: validated.dataPoints,
				loss: validated.loss,
				windowSize: validated.windowSize,
				metrics: validated.metrics,
				symbol: validated.symbol,
			};
		}, context);

		return Promise.resolve(result);
	}

	/**
	 * Save model metadata for a symbol
	 * @param {string} symbol - Stock symbol
	 * @param {ModelMetadata} metadata - Model metadata to save
	 * @returns {Promise<void>}
	 */
	public saveModelMetadata(symbol: string, metadata: ModelMetadata): Promise<void> {
		const context = {
			operation: 'save-model-metadata',
			symbol,
			step: 'sqlite-write',
		};

		ErrorHandler.wrapSync(() => {
			const upsert = this.modelsDb.prepare(`
				INSERT OR REPLACE INTO metadata (symbol, version, trainedAt, dataPoints, loss, windowSize, metrics)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`);

			upsert.run(
				symbol,
				metadata.version,
				metadata.trainedAt instanceof Date ? metadata.trainedAt.toISOString() : metadata.trainedAt,
				metadata.dataPoints,
				metadata.loss,
				metadata.windowSize,
				JSON.stringify(metadata.metrics),
			);
		}, context);

		return Promise.resolve();
	}

	/**
	 * Delete a symbol and all its quotes and metadata
	 * @param {string} symbol - Stock symbol
	 * @returns {void}
	 */
	public deleteSymbol(symbol: string): void {
		const context = {
			operation: 'delete-symbol',
			symbol,
			step: 'sqlite-delete',
		};

		ErrorHandler.wrapSync(() => {
			this.historicalDb.prepare('DELETE FROM quotes WHERE symbol = ?').run(symbol);
			this.historicalDb.prepare('DELETE FROM symbols WHERE symbol = ?').run(symbol);
			this.modelsDb.prepare('DELETE FROM metadata WHERE symbol = ?').run(symbol);
		}, context);
	}

	/**
	 * Check if a symbol exists in the database
	 * @param {string} symbol - Stock symbol
	 * @returns {boolean} True if symbol exists
	 */
	public symbolExists(symbol: string): boolean {
		const stmt = this.historicalDb.prepare('SELECT 1 FROM symbols WHERE symbol = ?');
		return stmt.get(symbol) !== undefined;
	}

	/**
	 * Get the number of quotes for a symbol
	 * @param {string} symbol - Stock symbol
	 * @returns {number} Number of quotes
	 */
	public getQuoteCount(symbol: string): number {
		const stmt = this.historicalDb.prepare('SELECT COUNT(*) as count FROM quotes WHERE symbol = ?');
		const row = stmt.get(symbol) as {count: number} | undefined;
		return row?.count ?? 0;
	}

	/**
	 * Get data update timestamp for a symbol
	 * @param {string} symbol - Stock symbol
	 * @returns {Promise<Date | null>} Last update timestamp or null if not found
	 */
	public getDataTimestamp(symbol: string): Promise<Date | null> {
		const context = {
			operation: 'get-data-timestamp',
			symbol,
			step: 'sqlite-read',
		};

		const result = ErrorHandler.wrapSync(() => {
			const stmt = this.historicalDb.prepare('SELECT MAX(date) as lastDate FROM quotes WHERE symbol = ?');
			const row = stmt.get(symbol) as {lastDate: string | null} | undefined;
			return row?.lastDate ? new Date(row.lastDate) : null;
		}, context);

		return Promise.resolve(result);
	}

	/**
	 * Close database connections
	 */
	public close(): void {
		this.historicalDb.close();
		this.modelsDb.close();
	}

	/**
	 * Get all symbols for export
	 * @returns {SymbolRow[]}
	 */
	public getAllSymbols(): SymbolRow[] {
		return this.historicalDb.prepare('SELECT * FROM symbols').all() as SymbolRow[];
	}

	/**
	 * Get all quotes for export
	 * @returns {HistoricalRow[]}
	 */
	public getAllQuotes(): HistoricalRow[] {
		return this.historicalDb.prepare('SELECT * FROM quotes').all() as HistoricalRow[];
	}

	/**
	 * Get all metadata for export
	 * @returns {MetadataRow[]}
	 */
	public getAllMetadata(): MetadataRow[] {
		return this.modelsDb.prepare('SELECT * FROM metadata').all() as MetadataRow[];
	}

	/**
	 * Overwrite historical data from export
	 * @param {HistoricalRow[]} data
	 * @returns {Promise<void>}
	 */
	public overwriteHistoricalData(data: HistoricalRow[]): Promise<void> {
		const context = {
			operation: 'overwrite-historical-data',
			step: 'sqlite-write',
		};

		ErrorHandler.wrapSync(() => {
			this.historicalDb.exec('DELETE FROM quotes');
			const insert = this.historicalDb.prepare(`
				INSERT INTO quotes (symbol, date, open, high, low, close, volume, adjClose)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`);
			const transaction = this.historicalDb.transaction((rows: HistoricalRow[]) => {
				for (const row of rows) {
					insert.run(row.symbol, row.date, row.open, row.high, row.low, row.close, row.volume, row.adjClose);
				}
			});
			transaction(data);
		}, context);

		return Promise.resolve();
	}

	/**
	 * Overwrite symbols from export
	 * @param {SymbolRow[]} data
	 * @returns {Promise<void>}
	 */
	public overwriteSymbols(data: SymbolRow[]): Promise<void> {
		const context = {
			operation: 'overwrite-symbols',
			step: 'sqlite-write',
		};

		ErrorHandler.wrapSync(() => {
			this.historicalDb.exec('DELETE FROM symbols');
			const insert = this.historicalDb.prepare(`
				INSERT INTO symbols (symbol, name)
				VALUES (?, ?)
			`);
			const transaction = this.historicalDb.transaction((rows: SymbolRow[]) => {
				for (const row of rows) {
					insert.run(row.symbol, row.name);
				}
			});
			transaction(data);
		}, context);

		return Promise.resolve();
	}

	/**
	 * Overwrite models metadata from export
	 * @param {MetadataRow[]} data
	 * @returns {Promise<void>}
	 */
	public overwriteModelsMetadata(data: MetadataRow[]): Promise<void> {
		const context = {
			operation: 'overwrite-models-metadata',
			step: 'sqlite-write',
		};

		ErrorHandler.wrapSync(() => {
			this.modelsDb.exec('DELETE FROM metadata');
			const insert = this.modelsDb.prepare(`
				INSERT INTO metadata (symbol, version, trainedAt, dataPoints, loss, windowSize, metrics)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`);
			const transaction = this.modelsDb.transaction((rows: MetadataRow[]) => {
				for (const row of rows) {
					insert.run(row.symbol, row.version, row.trainedAt, row.dataPoints, row.loss, row.windowSize, row.metrics);
				}
			});
			transaction(data);
		}, context);

		return Promise.resolve();
	}

	/**
	 * Clear all quotes, symbols and model metadata from the databases
	 * @returns {Promise<void>}
	 */
	public clearAllData(): Promise<void> {
		const context = {
			operation: 'clear-all-data',
			step: 'sqlite-delete',
		};

		ErrorHandler.wrapSync(() => {
			this.historicalDb.exec('DELETE FROM quotes');
			this.historicalDb.exec('DELETE FROM symbols');
			this.modelsDb.exec('DELETE FROM metadata');
		}, context);

		return Promise.resolve();
	}
}
