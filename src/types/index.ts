/**
 * Shared type definitions for the entire application
 * Defines common data structures used across modules
 * Uses TypeScript types exclusively (no interfaces) per project standards
 */

import {z} from 'zod';

/**
 * Stock data point with date information
 */
export const StockDataPointSchema = z.object({
	adjClose: z.number(),
	close: z.number(),
	date: z.string(),
	high: z.number(),
	low: z.number(),
	open: z.number(),
	volume: z.number(),
});

export type StockDataPoint = z.infer<typeof StockDataPointSchema>;

/**
 * Symbol type enumeration for categorizing different asset types
 */
export const SymbolTypeSchema = z.enum(['STOCK', 'INDEX', 'ETF', 'CRYPTO', 'VOLATILITY']);

export type SymbolType = z.infer<typeof SymbolTypeSchema>;

/**
 * Market feature configuration schema for enabling/disabling features
 */
export const FeatureConfigSchema = z.object({
	enabled: z.boolean().default(true).describe('Enable market features in model training'),
	includeBeta: z.boolean().default(true).describe('Include beta calculation'),
	includeCorrelation: z.boolean().default(true).describe('Include index correlation'),
	includeDistanceFromMA: z.boolean().default(true).describe('Include S&P 500 % distance from 200-day MA'),
	includeMarketReturn: z.boolean().default(true).describe('Include daily percentage change of S&P 500'),
	includeRegime: z.boolean().default(true).describe('Include market regime classification'),
	includeRelativeReturn: z.boolean().default(true).describe('Include stock return minus market return'),
	includeVix: z.boolean().default(true).describe('Include VIX level'),
	includeVolatilitySpread: z.boolean().default(true).describe('Include stock volatility minus market volatility'),
});

export type FeatureConfig = z.infer<typeof FeatureConfigSchema>;

/**
 * Market features data structure for storing calculated market context features
 */
export const MarketFeaturesSchema = z.object({
	beta: z.number().optional().describe('30-day rolling sensitivity to market'),
	date: z.string().describe('Date of the features'),
	distanceFromMA: z.number().optional().describe('S&P 500 % distance from 200-day MA'),
	indexCorrelation: z.number().optional().describe('20-day rolling correlation with S&P 500'),
	marketRegime: z.enum(['BULL', 'BEAR', 'NEUTRAL']).optional().describe('Market regime based on MAs'),
	marketReturn: z.number().optional().describe('Daily percentage change of S&P 500'),
	relativeReturn: z.number().optional().describe('Stock return minus market return'),
	symbol: z.string().describe('Stock ticker symbol'),
	vix: z.number().optional().describe('Current VIX level'),
	volatilitySpread: z.number().optional().describe('Stock volatility minus market volatility'),
});

export type MarketFeatures = z.infer<typeof MarketFeaturesSchema>;

/**
 * Yahoo Finance Quote Schema for validating API responses
 */
export const YahooQuoteSchema = z.object({
	currency: z.string(),
	longName: z.string().optional(),
	regularMarketPrice: z.number(),
	shortName: z.string().optional(),
});

/**
 * API Configuration for data sources
 */
export type ApiConfig = {
	rateLimit: number;
	retries: number;
	timeout: number;
};

/**
 * Prediction result from the LSTM model
 */
export type PredictionResult = {
	confidence: number;
	currentPrice: number;
	days: number;
	fullHistory: StockDataPoint[];
	historicalData: StockDataPoint[];
	meanAbsoluteError: number;
	percentChange: number;
	predictedData: {date: string; price: number}[];
	predictedPrice: number;
	predictedPrices: number[];
	predictionDate: Date;
	priceChange: number;
	symbol: string;
};

/**
 * Report prediction used for HTML generation
 */
export type ReportPrediction = {
	confidence: number;
	name: string;
	prediction: PredictionResult;
	signal: 'BUY' | 'HOLD' | 'SELL';
	symbol: string;
};

/**
 * Trading signal type
 */
export type TradingSignal = {
	action: 'BUY' | 'HOLD' | 'SELL';
	confidence: number;
	delta: number;
	reason: string;
	symbol: string;
	timestamp: Date;
};

export type YahooQuote = z.infer<typeof YahooQuoteSchema>;
