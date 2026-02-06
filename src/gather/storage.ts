/**
 * SQLite-based storage implementation
 * Provides persistence layer for stock data and model metadata using relational databases
 */

import Database from 'better-sqlite3';
import {join, resolve} from 'node:path';
import {z} from 'zod';

import type {ModelMetadata} from '../compute/lstm-model.ts';
import type {MarketFeatures, StockDataPoint} from '../types/index.ts';

import {ErrorHandler} from '../cli/utils/errors.ts';
import {FsUtils} from '../cli/utils/fs.ts';
import {getMarketIndices} from '../constants/defaults-loader.ts';
import {FeatureConfigSchema, MarketFeaturesSchema} from '../types/index.ts';

/**
 * Stock data point schema for validation
 */
const StockDataPointSchema = z.object({
	adjClose: z.number(),
	close: z.number(),
	date: z.string(),
	high: z.number(),
	low: z.number(),
	open: z.number(),
	volume: z.number(),
});

const StockDataSchema = z.array(StockDataPointSchema);

/**
 * Model metadata schema for validation
 */
export const ModelMetadataSchema = z.object({
	dataHash: z.string().optional(),
	dataPoints: z.number(),
	featureConfig: FeatureConfigSchema.optional(),
	lastDataDate: z.string().optional(),
	loss: z.number(),
	mape: z.number().optional(),
	metrics: z.record(z.string(), z.number()),
	symbol: z.string(),
	trainedAt: z.string().or(z.date()),
	version: z.string(),
	windowSize: z.number(),
});

/**
 * Historical data row schema
 */
export const HistoricalRowSchema = z.object({
	adjClose: z.number(),
	close: z.number(),
	date: z.string(),
	high: z.number(),
	low: z.number(),
	open: z.number(),
	symbol: z.string(),
	volume: z.number(),
});

/**
 * Type for historical data row
 */
export type HistoricalRow = z.infer<typeof HistoricalRowSchema>;

/**
 * Model metadata row schema
 */
const MetadataRowSchema = z.object({
	dataHash: z.string().nullable().optional(),
	dataPoints: z.number(),
	lastDataDate: z.string().nullable().optional(),
	loss: z.number(),
	metrics: z.string(),
	symbol: z.string(),
	trainedAt: z.string(),
	version: z.string(),
	windowSize: z.number(),
});

/**
 * Type for model metadata row
 */
export type MetadataRow = z.infer<typeof MetadataRowSchema>;

/**
 * Symbol row schema
 */
export const SymbolRowSchema = z.object({
	name: z.string(),
	priority: z.number().default(100),
	symbol: z.string(),
	type: z.string().default('STOCK'),
});

/**
 * Type for symbol row
 */
export type SymbolRow = z.infer<typeof SymbolRowSchema>;

/**
 * SQLite storage implementation
 */
export class SqliteStorage {
	private readonly dataDir: string;
	private readonly historicalDb: Database.Database;
	private readonly modelsDb: Database.Database;

	public constructor(workspaceDir?: string) {
		this.dataDir = workspaceDir ? resolve(process.cwd(), workspaceDir) : join(process.cwd(), 'data');
		FsUtils.ensureDirSync(this.dataDir);

		this.historicalDb = new Database(join(this.dataDir, 'historical_data.db'));
		this.modelsDb = new Database(join(this.dataDir, 'models.db'));

		this.initializeDatabases();
	}

	/**
	 * Clear all quotes, symbols and model metadata from the databases
	 */
	public clearAllData(): Promise<void> {
		const context = {
			operation: 'clear-all-data',
			step: 'sqlite-delete',
		};

		ErrorHandler.wrapSync(() => {
			this.historicalDb.exec('DELETE FROM quotes');
			this.historicalDb.exec('DELETE FROM symbols');
			this.historicalDb.exec('DELETE FROM market_features');
			this.modelsDb.exec('DELETE FROM metadata');
		}, context);

		return Promise.resolve();
	}

	/**
	 * Close database connections
	 */
	public close(): void {
		this.historicalDb.close();
		this.modelsDb.close();
	}

	/**
	 * Delete a symbol and all its quotes and metadata
	 * @param symbol - Stock symbol
	 */
	public deleteSymbol(symbol: string): void {
		const context = {
			operation: 'delete-symbol',
			step: 'sqlite-delete',
			symbol,
		};

		ErrorHandler.wrapSync(() => {
			this.historicalDb.prepare('DELETE FROM quotes WHERE symbol = ?').run(symbol);
			this.historicalDb.prepare('DELETE FROM symbols WHERE symbol = ?').run(symbol);
			this.historicalDb.prepare('DELETE FROM market_features WHERE symbol = ?').run(symbol);
			this.modelsDb.prepare('DELETE FROM metadata WHERE symbol = ?').run(symbol);
		}, context);
	}

	/**
	 * Get all metadata for export
	 */
	public getAllMetadata(): MetadataRow[] {
		const rows: unknown = this.modelsDb.prepare('SELECT * FROM metadata').all();
		return z.array(MetadataRowSchema).parse(rows);
	}

	/**
	 * Get all quotes for export
	 */
	public getAllQuotes(): HistoricalRow[] {
		const rows: unknown = this.historicalDb.prepare('SELECT * FROM quotes').all();
		return z.array(HistoricalRowSchema).parse(rows);
	}

	/**
	 * Get all symbols for export
	 */
	public getAllSymbols(): SymbolRow[] {
		const rows: unknown = this.historicalDb.prepare('SELECT symbol, name, type, priority FROM symbols').all();
		return z.array(SymbolRowSchema).parse(rows);
	}

	/**
	 * Get all available stock symbols from the quotes table
	 * @returns Array of stock symbols
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
	 * Get data quality metrics for a symbol
	 * @param symbol - Stock symbol
	 * @returns Data quality metrics or null if not found
	 */
	public getDataQuality(symbol: string): null | {
		gapsDetected: number;
		interpolatedCount: number;
		interpolatedPercent: number;
		lastUpdated: string;
		missingDays: number;
		outlierCount: number;
		outlierPercent: number;
		qualityScore: number;
		symbol: string;
	} {
		const stmt = this.historicalDb.prepare('SELECT * FROM data_quality WHERE symbol = ?');
		const row = stmt.get(symbol) as
			| undefined
			| {
					gapsDetected: number;
					interpolatedCount: number;
					interpolatedPercent: number;
					lastUpdated: string;
					missingDays: number;
					outlierCount: number;
					outlierPercent: number;
					qualityScore: number;
					symbol: string;
			  };
		return row ?? null;
	}

	/**
	 * Get data update timestamp for a symbol
	 * @param symbol - Stock symbol
	 * @returns Last update timestamp or null if not found
	 */
	public getDataTimestamp(symbol: string): Promise<Date | null> {
		const context = {
			operation: 'get-data-timestamp',
			step: 'sqlite-read',
			symbol,
		};

		const result = ErrorHandler.wrapSync(() => {
			const stmt = this.historicalDb.prepare('SELECT MAX(date) as lastDate FROM quotes WHERE symbol = ?');
			const row = stmt.get(symbol) as undefined | {lastDate: null | string};
			return row?.lastDate ? new Date(row.lastDate) : null;
		}, context);

		return Promise.resolve(result);
	}

	/**
	 * Get market features for a symbol
	 * @param symbol - Stock symbol
	 * @param sinceDate - Optional start date (YYYY-MM-DD)
	 * @returns Array of market features
	 */
	public getMarketFeatures(symbol: string, sinceDate?: string): MarketFeatures[] | null {
		const sql = sinceDate
			? 'SELECT * FROM market_features WHERE symbol = ? AND date >= ? ORDER BY date ASC'
			: 'SELECT * FROM market_features WHERE symbol = ? ORDER BY date ASC';
		const params = sinceDate ? [symbol, sinceDate] : [symbol];

		const stmt = this.historicalDb.prepare(sql);
		const rows = stmt.all(...params);

		if (!Array.isArray(rows) || rows.length === 0) {
			return null;
		}

		return z.array(MarketFeaturesSchema).parse(rows);
	}

	/**
	 * Get model metadata for a symbol
	 * @param symbol - Stock symbol
	 * @returns Model metadata or null if not found
	 */
	public getModelMetadata(symbol: string): Promise<ModelMetadata | null> {
		const context = {
			operation: 'get-model-metadata',
			step: 'sqlite-read',
			symbol,
		};

		const result = ErrorHandler.wrapSync(() => {
			const stmt = this.modelsDb.prepare('SELECT * FROM metadata WHERE symbol = ?');
			const row: unknown = stmt.get(symbol);

			if (!row) {
				return null;
			}

			const metadataRow = MetadataRowSchema.parse(row);

			const metricsData = JSON.parse(metadataRow.metrics) as unknown;
			const metricsObj = z
				.object({
					featureConfig: FeatureConfigSchema.optional(),
					metrics: z.record(z.string(), z.number()).optional(),
				})
				.catchall(z.any())
				.parse(metricsData);

			const metadataRaw: unknown = {
				dataHash: metadataRow.dataHash ?? undefined,
				dataPoints: metadataRow.dataPoints,
				featureConfig: metricsObj.featureConfig,
				lastDataDate: metadataRow.lastDataDate ?? undefined,
				loss: metadataRow.loss,
				metrics: metricsObj.metrics ?? metricsData,
				symbol: metadataRow.symbol,
				trainedAt: metadataRow.trainedAt,
				version: metadataRow.version,
				windowSize: metadataRow.windowSize,
			};

			const validated = ModelMetadataSchema.parse(metadataRaw);

			return {
				...(validated.dataHash ? {dataHash: validated.dataHash} : {}),
				dataPoints: validated.dataPoints,
				featureConfig: validated.featureConfig,
				...(validated.lastDataDate ? {lastDataDate: validated.lastDataDate} : {}),
				loss: validated.loss,
				metrics: validated.metrics,
				symbol: validated.symbol,
				trainedAt: new Date(validated.trainedAt),
				version: validated.version,
				windowSize: validated.windowSize,
			};
		}, context);

		return Promise.resolve(result);
	}

	/**
	 * Get the number of quotes for a symbol
	 * @param symbol - Stock symbol
	 * @returns Number of quotes
	 */
	public getQuoteCount(symbol: string): number {
		const stmt = this.historicalDb.prepare('SELECT COUNT(*) as count FROM quotes WHERE symbol = ?');
		const row = stmt.get(symbol) as undefined | {count: number};
		return row?.count ?? 0;
	}

	/**
	 * Get stock data for a symbol
	 * @param symbol - Stock symbol
	 * @param sinceDate - Optional start date (YYYY-MM-DD)
	 * @returns Array of stock data points or null if not found
	 */
	public getStockData(symbol: string, sinceDate?: string): Promise<null | StockDataPoint[]> {
		const context = {
			operation: 'get-stock-data',
			sinceDate,
			step: 'sqlite-read',
			symbol,
		};

		const result = ErrorHandler.wrapSync(() => {
			const sql = sinceDate
				? 'SELECT date, open, high, low, close, volume, adjClose FROM quotes WHERE symbol = ? AND date >= ? ORDER BY date ASC'
				: 'SELECT date, open, high, low, close, volume, adjClose FROM quotes WHERE symbol = ? ORDER BY date ASC';
			const params = sinceDate ? [symbol, sinceDate] : [symbol];

			const stmt = this.historicalDb.prepare(sql);
			const rows: unknown = stmt.all(...params);

			if (!Array.isArray(rows) || rows.length === 0) {
				return null;
			}

			return StockDataSchema.parse(rows);
		}, context);

		return Promise.resolve(result);
	}

	/**
	 * Get symbol name
	 * @param symbol - Stock symbol
	 * @returns Company name or null if not found
	 */
	public getSymbolName(symbol: string): null | string {
		const stmt = this.historicalDb.prepare('SELECT name FROM symbols WHERE symbol = ?');
		const row = stmt.get(symbol) as undefined | {name: string};
		return row?.name ?? null;
	}

	/**
	 * Overwrite historical data from export
	 * @param data
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
	 * Overwrite models metadata from export
	 * @param data
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
	 * Overwrite symbols from export
	 * @param data
	 */
	public overwriteSymbols(data: SymbolRow[]): Promise<void> {
		const context = {
			operation: 'overwrite-symbols',
			step: 'sqlite-write',
		};

		ErrorHandler.wrapSync(() => {
			this.historicalDb.exec('DELETE FROM symbols');
			const insert = this.historicalDb.prepare(`
				INSERT INTO symbols (symbol, name, type, priority)
				VALUES (?, ?, ?, ?)
			`);
			const transaction = this.historicalDb.transaction((rows: SymbolRow[]) => {
				for (const row of rows) {
					const rowData = row as {name: string; priority?: number; symbol: string; type?: string};
					const type = rowData.type ?? 'STOCK';
					const priority = rowData.priority ?? 100;
					insert.run(row.symbol, row.name, type, priority);
				}
			});
			transaction(data);
		}, context);

		return Promise.resolve();
	}

	/**
	 * Save data quality metrics for a symbol
	 * @param symbol - Stock symbol
	 * @param qualityScore - Quality score (0-100)
	 * @param interpolatedCount - Number of interpolated data points
	 * @param interpolatedPercent - Percentage of interpolated data (0-1)
	 * @param outlierCount - Number of outliers detected
	 * @param outlierPercent - Percentage of outliers detected (0-1)
	 * @param gapsDetected - Number of gaps detected
	 * @param missingDays - Total missing days
	 */
	public saveDataQuality(
		symbol: string,
		qualityScore: number,
		interpolatedCount: number,
		interpolatedPercent: number,
		outlierCount: number,
		outlierPercent: number,
		gapsDetected: number,
		missingDays: number,
	): void {
		const upsert = this.historicalDb.prepare(`
			INSERT OR REPLACE INTO data_quality (
				symbol, qualityScore, interpolatedCount, interpolatedPercent, 
				outlierCount, outlierPercent, gapsDetected, missingDays, lastUpdated
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);
		upsert.run(symbol, qualityScore, interpolatedCount, interpolatedPercent, outlierCount, outlierPercent, gapsDetected, missingDays, new Date().toISOString());
	}

	/**
	 * Save market features for a symbol
	 * @param symbol - Stock symbol
	 * @param data - Array of market features
	 */
	public saveMarketFeatures(symbol: string, data: MarketFeatures[]): void {
		const insert = this.historicalDb.prepare(`
			INSERT OR REPLACE INTO market_features (
				symbol, date, marketReturn, relativeReturn, beta, 
				indexCorrelation, vix, volatilitySpread, marketRegime, distanceFromMA
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);

		const transaction = this.historicalDb.transaction((features: MarketFeatures[]) => {
			for (const f of features) {
				insert.run(symbol, f.date, f.marketReturn, f.relativeReturn, f.beta, f.indexCorrelation, f.vix, f.volatilitySpread, f.marketRegime, f.distanceFromMA);
			}
		});

		transaction(data);
	}

	/**
	 * Save model metadata for a symbol
	 * @param symbol - Stock symbol
	 * @param metadata - Model metadata to save
	 */
	public saveModelMetadata(symbol: string, metadata: ModelMetadata): Promise<void> {
		const context = {
			operation: 'save-model-metadata',
			step: 'sqlite-write',
			symbol,
		};

		ErrorHandler.wrapSync(() => {
			const upsert = this.modelsDb.prepare(`
				INSERT OR REPLACE INTO metadata (symbol, version, trainedAt, dataPoints, dataHash, lastDataDate, loss, windowSize, metrics)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`);

			upsert.run(
				symbol,
				metadata.version,
				metadata.trainedAt instanceof Date ? metadata.trainedAt.toISOString() : metadata.trainedAt,
				metadata.dataPoints,
				metadata.dataHash ?? null,
				metadata.lastDataDate ?? null,
				metadata.loss,
				metadata.windowSize,
				JSON.stringify({
					featureConfig: metadata.featureConfig,
					metrics: metadata.metrics,
				}),
			);
		}, context);

		return Promise.resolve();
	}

	/**
	 * Save stock data for a symbol
	 * @param symbol - Stock symbol
	 * @param data - Array of stock data points
	 */
	public saveStockData(symbol: string, data: StockDataPoint[]): Promise<void> {
		const context = {
			operation: 'save-stock-data',
			step: 'sqlite-write',
			symbol,
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
	 * Save symbol information
	 * @param symbol - Stock symbol
	 * @param name - Company name
	 * @param type - Symbol type
	 * @param priority - Gathering priority
	 */
	public saveSymbol(symbol: string, name: string, type = 'STOCK', priority = 100): void {
		const upsert = this.historicalDb.prepare(`
			INSERT OR REPLACE INTO symbols (symbol, name, type, priority)
			VALUES (?, ?, ?, ?)
		`);
		upsert.run(symbol, name, type, priority);
	}

	/**
	 * Check if a symbol exists in the database
	 * @param symbol - Stock symbol
	 * @returns True if symbol exists
	 */
	public symbolExists(symbol: string): boolean {
		const stmt = this.historicalDb.prepare('SELECT 1 FROM symbols WHERE symbol = ?');
		return stmt.get(symbol) !== undefined;
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
				name TEXT,
				type TEXT DEFAULT 'STOCK',
				priority INTEGER DEFAULT 100
			);

			CREATE TABLE IF NOT EXISTS market_features (
				symbol TEXT,
				date TEXT,
				marketReturn REAL,
				relativeReturn REAL,
				beta REAL,
				indexCorrelation REAL,
				vix REAL,
				volatilitySpread REAL,
				marketRegime TEXT,
				distanceFromMA REAL,
				PRIMARY KEY (symbol, date)
			);
			CREATE INDEX IF NOT EXISTS idx_market_features_symbol ON market_features (symbol);

			CREATE TABLE IF NOT EXISTS data_quality (
				symbol TEXT PRIMARY KEY,
				qualityScore REAL,
				interpolatedCount INTEGER,
				interpolatedPercent REAL,
				outlierCount INTEGER,
				outlierPercent REAL,
				gapsDetected INTEGER,
				missingDays INTEGER,
				lastUpdated TEXT
			);
		`);

		// Models Metadata Schema
		this.modelsDb.exec(`
			CREATE TABLE IF NOT EXISTS metadata (
				symbol TEXT PRIMARY KEY,
				version TEXT,
				trainedAt TEXT,
				dataPoints INTEGER,
				dataHash TEXT,
				lastDataDate TEXT,
				loss REAL,
				windowSize INTEGER,
				metrics TEXT
			);
		`);

		// Populate default indices if the symbols table is empty
		const symbolCount = (this.historicalDb.prepare('SELECT COUNT(*) as count FROM symbols').get() as {count: number}).count;
		if (symbolCount === 0) {
			const indices = getMarketIndices();
			const insert = this.historicalDb.prepare('INSERT INTO symbols (symbol, name, type, priority) VALUES (?, ?, ?, ?)');
			for (const idx of indices) {
				insert.run(idx.symbol, idx.name, idx.type, idx.priority);
			}
		}
	}
}
