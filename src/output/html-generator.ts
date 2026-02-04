/**
 * HTML report generator
 * Generates a static index.html file with interactive Chart.js visualizations
 */

import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

import type {Config} from '../config/schema.ts';
import type {ReportPrediction} from '../types/index.ts';

import {ErrorHandler} from '../cli/utils/errors.ts';

import type {SqliteStorage} from '../gather/storage.ts';

/**
 * HTML report generator class
 */
export class HtmlGenerator {
	private readonly config: Config['prediction'];
	private readonly storage: SqliteStorage | undefined;

	public constructor(config: Config['prediction'], storage?: SqliteStorage) {
		this.config = config;
		this.storage = storage ?? undefined;
	}

	/**
	 * Generate a comprehensive HTML report for all predictions
	 * @param predictions - Array of prediction results
	 * @param appConfig - Full application configuration
	 * @returns Path to the generated report
	 */
	public async generateReport(predictions: ReportPrediction[], appConfig: Config): Promise<string> {
		const context = {
			operation: 'generate-report',
			step: 'html-rendering',
		};

		return ErrorHandler.wrapAsync(async () => {
			// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
			await mkdir(this.config.directory, {recursive: true});
			const reportPath = join(this.config.directory, 'index.html');

			const html = this.renderHtml(predictions, appConfig);
			// eslint-disable-next-line security/detect-non-literal-fs-filename -- Justification: CLI requires dynamic path resolution for user-provided config and data storage.
			await writeFile(reportPath, html, 'utf8');

			return reportPath;
		}, context);
	}

	/**
	 * Render the Chart.js initialization script for a stock
	 * @param p - Prediction data
	 * @param appConfig - Application configuration
	 * @returns JavaScript code string
	 */
	private renderChartScript(p: ReportPrediction, appConfig: Config): string {
		// Full History Chart Data - limited by config
		const historyLimit = appConfig.prediction.historyChartDays;
		const historicalData = p.prediction.fullHistory.slice(-historyLimit);
		const historyLabels = historicalData.map((d) => d.date);
		const historyPrices = historicalData.map((d) => d.close);

		// Prediction Chart Data - limited context by config
		const contextLimit = appConfig.prediction.contextDays;
		const recentHistory = p.prediction.fullHistory.slice(-contextLimit);
		const contextLabels = recentHistory.map((d) => d.date);
		const contextPrices = recentHistory.map((d) => d.close);

		const predictionLabels = p.prediction.predictedData.map((d) => d.date);
		const predictionPrices = p.prediction.predictedData.map((d) => d.price);

		// Combine for labels
		const combinedLabels = [...contextLabels, ...predictionLabels];

		// We create two datasets for the prediction chart to show different colors
		// The actual data will end exactly where the prediction starts
		const actualDataset = [...contextPrices, ...Array.from({length: predictionPrices.length}, () => null)];

		// The predicted dataset starts with the last actual price to connect the lines
		const lastActualPrice = contextPrices.at(-1);
		const predictedDataset = [...Array.from({length: contextPrices.length - 1}, () => null), lastActualPrice, ...predictionPrices];

		let signalColor = '#007bff';
		let signalRgb = '0, 123, 255';
		if (p.signal === 'BUY') {
			signalColor = '#28a745';
			signalRgb = '40, 167, 69';
		} else if (p.signal === 'SELL') {
			signalColor = '#dc3545';
			signalRgb = '220, 53, 69';
		}

		return `
			// Full History Chart
			new Chart(document.getElementById('chart-history-${p.symbol}'), {
				type: 'line',
				data: {
					labels: ${JSON.stringify(historyLabels)},
					datasets: [{
						label: 'Actual Price',
						data: ${JSON.stringify(historyPrices)},
						borderColor: '#6c757d',
						backgroundColor: 'rgba(108, 117, 125, 0.1)',
						borderWidth: 1,
						pointRadius: 0,
						fill: true,
						tension: 0.1
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: { intersect: false, mode: 'index' },
					plugins: { legend: { display: false } },
					scales: { x: { display: false }, y: { beginAtZero: false } }
				}
			});

			// Prediction Chart
			new Chart(document.getElementById('chart-prediction-${p.symbol}'), {
				type: 'line',
				data: {
					labels: ${JSON.stringify(combinedLabels)},
					datasets: [
						{
							label: 'Recent Actual',
							data: ${JSON.stringify(actualDataset)},
							borderColor: '#6c757d',
							backgroundColor: 'transparent',
							borderDash: [5, 5],
							borderWidth: 2,
							pointRadius: 2,
							tension: 0.1,
							spanGaps: false
						},
						{
							label: 'Forecast',
							data: ${JSON.stringify(predictedDataset)},
							borderColor: '${signalColor}',
							backgroundColor: 'rgba(${signalRgb}, 0.1)',
							borderWidth: 3,
							pointRadius: 3,
							fill: true,
							tension: 0.1,
							spanGaps: false
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: { intersect: false, mode: 'index' },
					scales: { 
						y: { beginAtZero: false },
						x: { ticks: { maxRotation: 45, minRotation: 45 } }
					}
				}
			});
		`;
	}

	/**
	 * Render the full HTML document
	 * @param predictions - Prediction data
	 * @param appConfig - App configuration
	 * @returns HTML string
	 */
	private renderHtml(predictions: ReportPrediction[], appConfig: Config): string {
		const generatedAt = new Date().toLocaleString();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AI Stock Predictions Report</title>
	<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
	<style>
		:root {
			--bg-color: #f4f7f6;
			--card-bg: #ffffff;
			--text-main: #333333;
			--buy-color: #28a745;
			--sell-color: #dc3545;
			--hold-color: #6c757d;
			--accent-color: #007bff;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			background-color: var(--bg-color);
			color: var(--text-main);
			margin: 0;
			padding: 20px;
		}
		.container {
			max-width: 1200px;
			margin: 0 auto;
		}
		header {
			margin-bottom: 30px;
			text-align: center;
		}
		.summary-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 20px;
			margin-bottom: 40px;
		}
		.card {
			background: var(--card-bg);
			border-radius: 8px;
			padding: 20px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		.stock-grid {
			display: grid;
			grid-template-columns: 1fr;
			gap: 40px;
		}
		.stock-card {
			background: var(--card-bg);
			border-radius: 12px;
			padding: 25px;
			box-shadow: 0 4px 6px rgba(0,0,0,0.05);
		}
		.stock-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 25px;
			border-bottom: 1px solid #eee;
			padding-bottom: 15px;
		}
		.symbol-info {
			display: flex;
			flex-direction: column;
		}
		.symbol {
			font-size: 28px;
			font-weight: bold;
		}
		.company-name {
			font-size: 16px;
			color: #666;
			margin-bottom: 5px;
		}
		.signal {
			padding: 8px 20px;
			border-radius: 20px;
			font-weight: bold;
			text-transform: uppercase;
			font-size: 18px;
		}
		.signal-buy { background-color: #e8f5e9; color: var(--buy-color); }
		.signal-sell { background-color: #ffebee; color: var(--sell-color); }
		.signal-hold { background-color: #f5f5f5; color: var(--hold-color); }
		.chart-section {
			margin-bottom: 30px;
		}
		.chart-title {
			font-size: 16px;
			font-weight: bold;
			margin-bottom: 10px;
			color: #555;
			text-align: center;
		}
		.chart-container {
			height: 350px;
			position: relative;
			margin-bottom: 20px;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 20px;
		}
		th, td {
			text-align: left;
			padding: 12px;
			border-bottom: 1px solid #eee;
		}
		.confidence-bar {
			height: 8px;
			background: #eee;
			border-radius: 4px;
			width: 100px;
			display: inline-block;
			margin-left: 10px;
		}
		.confidence-fill {
			height: 100%;
			border-radius: 4px;
			background: var(--accent-color);
		}
	</style>
</head>
<body>
	<div class="container">
		<header>
			<h1>AI Stock Predictions Report</h1>
			<p>Generated at: ${generatedAt}</p>
		</header>

		<div class="summary-grid">
			<div class="card">
				<h3>Total Symbols</h3>
				<p style="font-size: 24px; font-weight: bold;">${predictions.length}</p>
			</div>
			<div class="card">
				<h3>BUY Signals</h3>
				<p style="font-size: 24px; font-weight: bold; color: var(--buy-color);">${predictions.filter((p) => p.signal === 'BUY').length}</p>
			</div>
			<div class="card">
				<h3>SELL Signals</h3>
				<p style="font-size: 24px; font-weight: bold; color: var(--sell-color);">${predictions.filter((p) => p.signal === 'SELL').length}</p>
			</div>
		</div>

		<div class="stock-grid">
			${predictions.map((p) => this.renderStockCard(p, appConfig)).join('')}
		</div>
	</div>

	<script>
		// Initialize all charts
		${predictions.map((p) => this.renderChartScript(p, appConfig)).join('')}
	</script>
</body>
</html>`;
	}

	/**
	 * Render data quality metrics row if available
	 * @param symbol - Stock symbol
	 * @returns HTML string for quality metrics or empty string
	 */
	private renderQualityMetrics(symbol: string): string {
		if (!this.storage) {
			return '';
		}

		const quality = this.storage.getDataQuality(symbol);
		if (!quality) {
			return '';
		}

		let qualityColor = 'var(--buy-color)';
		if (quality.qualityScore < 70) {
			qualityColor = '#ff9800'; // Orange
		}
		if (quality.qualityScore < 50) {
			qualityColor = 'var(--sell-color)';
		}

		return `
			<tr>
				<th>Data Quality</th>
				<td>
					<span style="color: ${qualityColor}; font-weight: bold;">${quality.qualityScore}/100</span>
					${quality.interpolatedCount > 0 ? `<span style="font-size: 12px; color: #666; margin-left: 10px;">(${quality.interpolatedCount} interpolated)</span>` : ''}
				</td>
			</tr>
		`;
	}

	/**
	 * Render a card for a single stock
	 * @param p - Prediction data
	 * @param appConfig - App configuration
	 * @returns HTML component string
	 */
	private renderStockCard(p: ReportPrediction, appConfig: Config): string {
		const signalClass = `signal-${p.signal.toLowerCase()}`;
		const confidencePercent = (p.confidence * 100).toFixed(0);
		const firstPredicted = p.prediction.predictedData[0]?.price;

		return `
			<div class="stock-card">
				<div class="stock-header">
					<div class="symbol-info">
						<span class="symbol">${p.symbol}</span>
						<span class="company-name">${p.name}</span>
						<div>
							<span class="confidence-bar">
								<div class="confidence-fill" style="width: ${confidencePercent}%"></div>
							</span>
							<span style="font-size: 12px; color: #666; margin-left: 5px;">${confidencePercent}% confidence</span>
						</div>
					</div>
					<span class="signal ${signalClass}">${p.signal}</span>
				</div>
				<div class="chart-section">
					<div class="chart-title">Full Performance History (${appConfig.prediction.historyChartDays} Days)</div>
					<div class="chart-container">
						<canvas id="chart-history-${p.symbol}"></canvas>
					</div>
				</div>
				<div class="chart-section">
					<div class="chart-title">Recent Trend & Forecast (Last ${appConfig.prediction.contextDays} Days + Prediction)</div>
					<div class="chart-container">
						<canvas id="chart-prediction-${p.symbol}"></canvas>
					</div>
				</div>
				<table>
					<tr>
						<th>Current Price</th>
						<td>$${p.prediction.currentPrice.toFixed(2)}</td>
					</tr>
					<tr>
						<th>Prediction (Next Day)</th>
						<td>$${firstPredicted === undefined ? 'N/A' : firstPredicted.toFixed(2)}</td>
					</tr>
					<tr>
						<th>Expected Change</th>
						<td style="color: ${firstPredicted !== undefined && firstPredicted > p.prediction.currentPrice ? 'var(--buy-color)' : 'var(--sell-color)'}">
							${firstPredicted === undefined ? '0.00' : (((firstPredicted - p.prediction.currentPrice) / p.prediction.currentPrice) * 100).toFixed(2)}%
						</td>
					</tr>
					${this.renderQualityMetrics(p.symbol)}
				</table>
			</div>
		`;
	}
}
