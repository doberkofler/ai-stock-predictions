import {describe, it, expect, vi, beforeEach} from 'vitest';
import {HtmlGenerator} from '../../../src/output/html-generator.ts';
import type {Config} from '../../../src/config/schema.ts';
import type {ReportPrediction} from '../../../src/types/index.ts';
import * as fs from 'node:fs/promises';
import {ensureDir} from 'fs-extra';

vi.mock('fs-extra', () => ({
	ensureDir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs/promises', () => ({
	writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('HtmlGenerator', () => {
	let generator: HtmlGenerator;
	const mockOutputConfig = {
		days: 2,
		historyChartDays: 10,
		contextDays: 5,
		directory: 'test-output',
		buyThreshold: 0.05,
		sellThreshold: -0.05,
		minConfidence: 0.6,
	};

	const mockPredictions: ReportPrediction[] = [
		{
			symbol: 'AAPL',
			name: 'Apple Inc.',
			prediction: {
				symbol: 'AAPL',
				currentPrice: 150,
				predictedPrice: 160,
				priceChange: 10,
				percentChange: 0.06,
				predictionDate: new Date(),
				days: 2,
				historicalData: [],
				fullHistory: [
					{date: '2022-12-30', open: 148, high: 152, low: 147, close: 150, volume: 1000, adjClose: 150}
				],
				predictedData: [
					{date: '2023-01-01', price: 155},
					{date: '2023-01-02', price: 160},
				],
				predictedPrices: [155, 160],
				confidence: 0.8,
				meanAbsoluteError: 0.05,
			},
			signal: 'BUY',
			confidence: 0.8,
		},
		{
			symbol: 'MSFT',
			name: 'Microsoft Corporation',
			prediction: {
				symbol: 'MSFT',
				currentPrice: 300,
				predictedPrice: 280,
				priceChange: -20,
				percentChange: -0.06,
				predictionDate: new Date(),
				days: 2,
				historicalData: [],
				fullHistory: [
					{date: '2022-12-30', open: 305, high: 310, low: 295, close: 300, volume: 1000, adjClose: 300}
				],
				predictedData: [
					{date: '2023-01-01', price: 290},
					{date: '2023-01-02', price: 280},
				],
				predictedPrices: [290, 280],
				confidence: 0.7,
				meanAbsoluteError: 0.1,
			},
			signal: 'SELL',
			confidence: 0.7,
		}
	];

	const mockAppConfig: Config = {
		prediction: mockOutputConfig,
		training: {minNewDataPoints: 50},
		dataSource: {timeout: 10000, retries: 3, rateLimit: 1000},
		model: {windowSize: 30, epochs: 50, learningRate: 0.001, batchSize: 128},
	};

	beforeEach(() => {
		vi.clearAllMocks();
		generator = new HtmlGenerator(mockOutputConfig);
	});

	it('should generate an HTML report', async () => {
		const reportPath = await generator.generateReport(mockPredictions, mockAppConfig);
		
		expect(ensureDir).toHaveBeenCalledWith(mockOutputConfig.directory);
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
