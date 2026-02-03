import * as fs from 'node:fs/promises';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {Config} from '../../../src/config/schema.ts';
import type {ReportPrediction} from '../../../src/types/index.ts';

import {HtmlGenerator} from '../../../src/output/html-generator.ts';

vi.mock('node:fs/promises', () => ({
	mkdir: vi.fn().mockResolvedValue(undefined),
	writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('HtmlGenerator', () => {
	let generator: HtmlGenerator;
	const mockOutputConfig = {
		buyThreshold: 0.05,
		contextDays: 5,
		days: 2,
		directory: 'test-output',
		historyChartDays: 10,
		minConfidence: 0.6,
		sellThreshold: -0.05,
	};

	const mockPredictions: ReportPrediction[] = [
		{
			confidence: 0.8,
			name: 'Apple Inc.',
			prediction: {
				confidence: 0.8,
				currentPrice: 150,
				days: 2,
				fullHistory: [{adjClose: 150, close: 150, date: '2022-12-30', high: 152, low: 147, open: 148, volume: 1000}],
				historicalData: [],
				meanAbsoluteError: 0.05,
				percentChange: 0.06,
				predictedData: [
					{date: '2023-01-01', price: 155},
					{date: '2023-01-02', price: 160},
				],
				predictedPrice: 160,
				predictedPrices: [155, 160],
				predictionDate: new Date(),
				priceChange: 10,
				symbol: 'AAPL',
			},
			signal: 'BUY',
			symbol: 'AAPL',
		},
		{
			confidence: 0.7,
			name: 'Microsoft Corporation',
			prediction: {
				confidence: 0.7,
				currentPrice: 300,
				days: 2,
				fullHistory: [{adjClose: 300, close: 300, date: '2022-12-30', high: 310, low: 295, open: 305, volume: 1000}],
				historicalData: [],
				meanAbsoluteError: 0.1,
				percentChange: -0.06,
				predictedData: [
					{date: '2023-01-01', price: 290},
					{date: '2023-01-02', price: 280},
				],
				predictedPrice: 280,
				predictedPrices: [290, 280],
				predictionDate: new Date(),
				priceChange: -20,
				symbol: 'MSFT',
			},
			signal: 'SELL',
			symbol: 'MSFT',
		},
	];

	const mockAppConfig: Config = {
		aBTesting: {enabled: false},
		dataSource: {rateLimit: 1000, retries: 3, timeout: 10000},
		market: {
			featureConfig: {
				enabled: true,
				includeBeta: true,
				includeCorrelation: true,
				includeDistanceFromMA: true,
				includeMarketReturn: true,
				includeRegime: true,
				includeRelativeReturn: true,
				includeVix: true,
				includeVolatilitySpread: true,
			},
			primaryIndex: "^GSPC",
			volatilityIndex: "^VIX",
		},
		model: {batchSize: 128, epochs: 50, learningRate: 0.001, windowSize: 30},
		prediction: mockOutputConfig,
		training: {minNewDataPoints: 50},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		generator = new HtmlGenerator(mockOutputConfig);
	});

	it('should generate an HTML report', async () => {
		const reportPath = await generator.generateReport(mockPredictions, mockAppConfig);

		expect(fs.mkdir).toHaveBeenCalledWith(mockOutputConfig.directory, {recursive: true});
		expect(fs.writeFile).toHaveBeenCalled();
		expect(reportPath).toContain('index.html');
	});

	it('should include all symbols and names in the report', async () => {
		await generator.generateReport(mockPredictions, mockAppConfig);
		const call = vi.mocked(fs.writeFile).mock.calls[0];
		const html = (call ? call[1] : '') as string;

		expect(html).toContain('AAPL');
		expect(html).toContain('Apple Inc.');
		expect(html).toContain('MSFT');
		expect(html).toContain('Microsoft Corporation');
		expect(html).toContain('BUY');
		expect(html).toContain('SELL');
	});
});
