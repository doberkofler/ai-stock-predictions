/**
 * Configuration schema definitions using Zod for runtime validation
 * All external data boundaries must be validated through these schemas
 */

import {z} from 'zod';

/**
 * Stock symbol validation schema
 */
const StockSymbolSchema = z.object({
	symbol: z
		.string()
		.min(1, 'Stock symbol cannot be empty')
		.max(10, 'Stock symbol too long')
		.regex(/^[A-Z0-9.-]+$/, 'Stock symbol must contain only uppercase letters, numbers, dots, and hyphens'),
	name: z.string().min(1, 'Company name cannot be empty'),
});

/**
 * Prediction configuration schema
 */
const PredictionSchema = z.object({
	days: z.number().min(1, 'Prediction days must be at least 1').max(365, 'Prediction days cannot exceed 365').default(30),
	trainSplit: z.number().min(0.5, 'Training split must be at least 50%').max(0.9, 'Training split cannot exceed 90%').default(0.8),
});

/**
 * Training configuration schema
 */
const TrainingSchema = z.object({
	incremental: z.boolean().default(true),
	retrain: z.boolean().default(false),
	minNewDataPoints: z.number().min(10, 'Minimum new data points must be at least 10').max(1000, 'Minimum new data points cannot exceed 1000').default(50),
});

/**
 * Trading configuration schema
 */
const TradingSchema = z.object({
	buyThreshold: z.number().min(0, 'Buy threshold cannot be negative').max(1, 'Buy threshold cannot exceed 100%').default(0.05),
	sellThreshold: z.number().min(-1, 'Sell threshold cannot be less than -100%').max(0, 'Sell threshold cannot be positive').default(-0.05),
	minConfidence: z.number().min(0.5, 'Minimum confidence must be at least 50%').max(1, 'Minimum confidence cannot exceed 100%').default(0.6),
});

/**
 * API configuration schema
 */
const ApiSchema = z.object({
	timeout: z.number().min(1000, 'API timeout must be at least 1000ms').max(60000, 'API timeout cannot exceed 60000ms').default(10000),
	retries: z.number().min(1, 'API retries must be at least 1').max(10, 'API retries cannot exceed 10').default(3),
	rateLimit: z.number().min(100, 'API rate limit must be at least 100ms').max(10000, 'API rate limit cannot exceed 10000ms').default(1000),
});

/**
 * Output configuration schema
 */
const OutputSchema = z.object({
	directory: z.string().min(1, 'Output directory cannot be empty').default('output'),
	template: z.string().min(1, 'Output template cannot be empty').default('default'),
	includeCharts: z.boolean().default(true),
	chartsType: z.enum(['line', 'candlestick', 'both']).default('both'),
});

/**
 * Machine Learning configuration schema
 */
const MlSchema = z.object({
	modelType: z.enum(['lstm', 'regression']).default('lstm'),
	windowSize: z.number().min(10, 'ML window size must be at least 10').max(100, 'ML window size cannot exceed 100').default(30),
	epochs: z.number().min(10, 'ML epochs must be at least 10').max(200, 'ML epochs cannot exceed 200').default(50),
	learningRate: z.number().min(0.0001, 'ML learning rate must be at least 0.0001').max(0.1, 'ML learning rate cannot exceed 0.1').default(0.001),
	batchSize: z.number().min(1, 'ML batch size must be at least 1').max(100, 'ML batch size cannot exceed 100').default(32),
});

/**
 * Main configuration schema
 * This is the root schema for validating the entire config.json file
 */
export const ConfigSchema = z.object({
	symbols: z.array(StockSymbolSchema).min(1, 'At least one stock symbol must be specified').max(1000, 'Cannot specify more than 1000 stock symbols'),
	prediction: PredictionSchema,
	training: TrainingSchema,
	trading: TradingSchema,
	api: ApiSchema,
	output: OutputSchema,
	ml: MlSchema,
});

/**
 * Type inference from the configuration schema
 * Use this type throughout the application for type-safe configuration access
 */
export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 * These are used when initializing a new config.json file
 */
export const DefaultConfig: Config = {
	symbols: [
		{symbol: 'NVDA', name: 'NVIDIA Corporation'},
		{symbol: 'AAPL', name: 'Apple Inc.'},
		{symbol: 'MSFT', name: 'Microsoft Corporation'},
		{symbol: 'GOOGL', name: 'Alphabet Inc.'},
		{symbol: 'AMZN', name: 'Amazon.com Inc.'},
		{symbol: 'META', name: 'Meta Platforms Inc.'},
		{symbol: 'TSLA', name: 'Tesla Inc.'},
		{symbol: 'AVGO', name: 'Broadcom Inc.'},
		{symbol: 'TSM', name: 'Taiwan Semiconductor Manufacturing'},
		{symbol: 'LLY', name: 'Eli Lilly and Company'},
		{symbol: 'V', name: 'Visa Inc.'},
		{symbol: 'JPM', name: 'JPMorgan Chase & Co.'},
		{symbol: 'WMT', name: 'Walmart Inc.'},
		{symbol: 'MA', name: 'Mastercard Incorporated'},
		{symbol: 'XOM', name: 'Exxon Mobil Corporation'},
		{symbol: 'UNH', name: 'UnitedHealth Group Incorporated'},
		{symbol: 'ORCL', name: 'Oracle Corporation'},
		{symbol: 'COST', name: 'Costco Wholesale Corporation'},
		{symbol: 'PG', name: 'Procter & Gamble Company'},
		{symbol: 'HD', name: 'Home Depot Inc.'},
		{symbol: 'JNJ', name: 'Johnson & Johnson'},
		{symbol: 'ASML', name: 'ASML Holding N.V.'},
		{symbol: 'BAC', name: 'Bank of America Corporation'},
		{symbol: 'ABBV', name: 'AbbVie Inc.'},
		{symbol: 'CRM', name: 'Salesforce Inc.'},
		{symbol: 'NFLX', name: 'Netflix Inc.'},
		{symbol: 'CVX', name: 'Chevron Corporation'},
		{symbol: 'KO', name: 'Coca-Cola Company'},
		{symbol: 'MRK', name: 'Merck & Co. Inc.'},
		{symbol: 'ADBE', name: 'Adobe Inc.'},
		{symbol: 'PEP', name: 'PepsiCo Inc.'},
		{symbol: 'TM', name: 'Toyota Motor Corporation'},
		{symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.'},
		{symbol: 'LIN', name: 'Linde plc'},
		{symbol: 'WFC', name: 'Wells Fargo & Company'},
		{symbol: 'DIS', name: 'The Walt Disney Company'},
		{symbol: 'ACN', name: 'Accenture plc'},
		{symbol: 'MCD', name: "McDonald's Corporation"},
		{symbol: 'CSCO', name: 'Cisco Systems Inc.'},
		{symbol: 'PFE', name: 'Pfizer Inc.'},
		{symbol: 'INTC', name: 'Intel Corporation'},
		{symbol: 'SAP', name: 'SAP SE'},
		{symbol: 'HSBC', name: 'HSBC Holdings plc'},
		{symbol: 'NKE', name: 'NIKE Inc.'},
		{symbol: 'DHR', name: 'Danaher Corporation'},
		{symbol: 'AMD', name: 'Advanced Micro Devices Inc.'},
		{symbol: 'TXN', name: 'Texas Instruments Incorporated'},
		{symbol: 'PM', name: 'Philip Morris International Inc.'},
		{symbol: 'INTU', name: 'Intuit Inc.'},
		{symbol: 'VZ', name: 'Verizon Communications Inc.'},
		{symbol: 'AMAT', name: 'Applied Materials Inc.'},
		{symbol: 'QCOM', name: 'QUALCOMM Incorporated'},
		{symbol: 'BKNG', name: 'Booking Holdings Inc.'},
		{symbol: 'LOW', name: "Lowe's Companies Inc."},
		{symbol: 'HON', name: 'Honeywell International Inc.'},
		{symbol: 'RTX', name: 'RTX Corporation'},
		{symbol: 'AXP', name: 'American Express Company'},
		{symbol: 'GS', name: 'The Goldman Sachs Group Inc.'},
		{symbol: 'CAT', name: 'Caterpillar Inc.'},
		{symbol: 'IBM', name: 'International Business Machines Corporation'},
		{symbol: 'MS', name: 'Morgan Stanley'},
		{symbol: 'GE', name: 'General Electric Company'},
		{symbol: 'SPGI', name: 'S&P Global Inc.'},
		{symbol: 'BLK', name: 'BlackRock Inc.'},
		{symbol: 'NOW', name: 'ServiceNow Inc.'},
		{symbol: 'DE', name: 'Deere & Company'},
		{symbol: 'AMGN', name: 'Amgen Inc.'},
		{symbol: 'PLD', name: 'Prologis Inc.'},
		{symbol: 'ISRG', name: 'Intuitive Surgical Inc.'},
		{symbol: 'LMT', name: 'Lockheed Martin Corporation'},
		{symbol: 'SYK', name: 'Stryker Corporation'},
		{symbol: 'ELV', name: 'Elevance Health Inc.'},
		{symbol: 'TJX', name: 'The TJX Companies Inc.'},
		{symbol: 'MDLZ', name: 'Mondelez International Inc.'},
		{symbol: 'GILD', name: 'Gilead Sciences Inc.'},
		{symbol: 'REGN', name: 'Regeneron Pharmaceuticals Inc.'},
		{symbol: 'ADP', name: 'Automatic Data Processing Inc.'},
		{symbol: 'CVS', name: 'CVS Health Corporation'},
		{symbol: 'BMY', name: 'Bristol-Myers Squibb Company'},
		{symbol: 'VRTX', name: 'Vertex Pharmaceuticals Incorporated'},
		{symbol: 'MMC', name: 'Marsh & McLennan Companies Inc.'},
		{symbol: 'CB', name: 'Chubb Limited'},
		{symbol: 'LRCX', name: 'Lam Research Corporation'},
		{symbol: 'ADI', name: 'Analog Devices Inc.'},
		{symbol: 'ZTS', name: 'Zoetis Inc.'},
		{symbol: 'MU', name: 'Micron Technology Inc.'},
		{symbol: 'CI', name: 'The Cigna Group'},
		{symbol: 'EOG', name: 'EOG Resources Inc.'},
		{symbol: 'MO', name: 'Altria Group Inc.'},
		{symbol: 'SLB', name: 'Schlumberger Limited'},
		{symbol: 'ETN', name: 'Eaton Corporation plc'},
		{symbol: 'BSX', name: 'Boston Scientific Corporation'},
		{symbol: 'BDX', name: 'Becton Dickinson and Company'},
		{symbol: 'C', name: 'Citigroup Inc.'},
		{symbol: 'CL', name: 'Colgate-Palmolive Company'},
		{symbol: 'WM', name: 'Waste Management Inc.'},
		{symbol: 'TGT', name: 'Target Corporation'},
		{symbol: 'SO', name: 'The Southern Company'},
		{symbol: 'DUK', name: 'Duke Energy Corporation'},
		{symbol: '005930.KS', name: 'Samsung Electronics Co. Ltd.'},
	],
	prediction: {
		days: 30,
		trainSplit: 0.8,
	},
	training: {
		incremental: true,
		retrain: false,
		minNewDataPoints: 50,
	},
	trading: {
		buyThreshold: 0.05,
		sellThreshold: -0.05,
		minConfidence: 0.6,
	},
	api: {
		timeout: 10000,
		retries: 3,
		rateLimit: 1000,
	},
	output: {
		directory: 'output',
		template: 'default',
		includeCharts: true,
		chartsType: 'both',
	},
	ml: {
		modelType: 'lstm',
		windowSize: 30,
		epochs: 50,
		learningRate: 0.001,
		batchSize: 32,
	},
};
