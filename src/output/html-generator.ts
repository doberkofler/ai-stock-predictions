/**
 * HTML report generator
 * Generates a static index.html file with interactive Chart.js visualizations
 */

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import type {Config} from '../config/schema.ts';
import type {ReportPrediction} from '../types/index.ts';

import {ErrorHandler} from '../cli/utils/errors.ts';

import type {SqliteStorage} from '../gather/storage.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
			await mkdir(this.config.directory, {recursive: true});
			const reportPath = join(this.config.directory, 'index.html');

			const assets = await this.loadAssets();
			const html = this.renderHtml(predictions, appConfig, assets);
			await writeFile(reportPath, html, 'utf8');

			return reportPath;
		}, context);
	}

	/**
	 * Load static assets (CSS, JS) from the filesystem
	 * @returns Object containing asset contents
	 */
	private async loadAssets(): Promise<{css: string; js: string}> {
		const assetsPath = join(__dirname, 'assets');
		const [css, js] = await Promise.all([readFile(join(assetsPath, 'report.css'), 'utf8'), readFile(join(assetsPath, 'report.js'), 'utf8')]);
		return {css, js};
	}

	/**
	 * Prepare data for Chart.js for a specific stock
	 * @param p - Prediction data
	 * @param appConfig - Application configuration
	 * @returns Structured data object for the client-side chart
	 */
	private prepareChartData(p: ReportPrediction, appConfig: Config): object {
		// Full History Chart Data
		const historyLimit = appConfig.prediction.historyChartDays;
		const historicalData = p.prediction.fullHistory.slice(-historyLimit);

		// Prediction Chart Data
		const contextLimit = appConfig.prediction.contextDays;
		const recentHistory = p.prediction.fullHistory.slice(-contextLimit);
		const contextPrices = recentHistory.map((d) => d.close);

		const predictionLabels = p.prediction.predictedData.map((d) => d.date);
		const predictionPrices = p.prediction.predictedData.map((d) => d.price);
		const mae = p.prediction.meanAbsoluteError;
		const lastActualPrice = contextPrices.at(-1);

		let signalColor = '#007bff';
		let signalRgb = '0, 123, 255';
		if (p.signal === 'BUY') {
			signalColor = '#28a745';
			signalRgb = '40, 167, 69';
		} else if (p.signal === 'SELL') {
			signalColor = '#dc3545';
			signalRgb = '220, 53, 69';
		}

		return {
			backtest: p.backtest
				? {
						labels: p.backtest.equityCurve.map((d) => d.date),
						values: p.backtest.equityCurve.map((v) => v.value),
					}
				: null,
			history: {
				labels: historicalData.map((d) => d.date),
				prices: historicalData.map((d) => d.close),
			},
			prediction: {
				labels: [...recentHistory.map((d) => d.date), ...predictionLabels],
				actualDataset: [...contextPrices, ...Array.from({length: predictionPrices.length}, () => null)],
				predictedDataset: [...Array.from({length: contextPrices.length - 1}, () => null), lastActualPrice, ...predictionPrices],
				upperDataset: [
					...Array.from({length: contextPrices.length - 1}, () => null),
					lastActualPrice,
					...p.prediction.predictedData.map((d) => d.upperBound ?? d.price + mae),
				],
				lowerDataset: [
					...Array.from({length: contextPrices.length - 1}, () => null),
					lastActualPrice,
					...p.prediction.predictedData.map((d) => d.lowerBound ?? d.price - mae),
				],
				signalColor,
				signalRgb,
			},
		};
	}

	/**
	 * Render the full HTML document
	 * @param predictions - Prediction data
	 * @param appConfig - App configuration
	 * @param assets - Loaded CSS and JS assets
	 * @param assets.css - CSS asset content
	 * @param assets.js - JS asset content
	 * @returns HTML string
	 */
	private renderHtml(predictions: ReportPrediction[], appConfig: Config, assets: {css: string; js: string}): string {
		const generatedAt = new Date().toLocaleString();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AI Stock Predictions Report</title>
	<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
	<style>${assets.css}</style>
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

		<div class="dashboard-card">
			<h2 style="text-align: center;">Signal Dashboard</h2>
			${this.renderSignalDashboard(predictions)}
		</div>

		<div class="stock-grid">
			${predictions.map((p) => this.renderStockCard(p, appConfig)).join('')}
		</div>
	</div>

	<script>
		${assets.js}
		
		// Initialize all charts
		${predictions.map((p) => `initCharts('${p.symbol}', ${JSON.stringify(this.prepareChartData(p, appConfig))});`).join('\n')}
	</script>
</body>
</html>`;
	}

	/**
	 * Render the Signal Dashboard table
	 * @param predictions - Prediction data
	 * @returns HTML string
	 */
	private renderSignalDashboard(predictions: ReportPrediction[]): string {
		const sortedPredictions = predictions.toSorted((a, b) => b.confidence - a.confidence);
		return `
			<table class="dashboard-table" id="dashboard-table" data-sort-dir="desc">
				<thead>
					<tr>
						<th onclick="sortTable(0)" class="sort-icon">Symbol</th>
						<th onclick="sortTable(1)" class="sort-icon">Signal</th>
						<th onclick="sortTable(2)" class="sort-icon">Confidence</th>
						<th onclick="sortTable(3)" class="sort-icon">Current Price</th>
						<th onclick="sortTable(4)" class="sort-icon">Target Price</th>
						<th onclick="sortTable(5)" class="sort-icon">Exp. Change</th>
					</tr>
				</thead>
				<tbody>
					${sortedPredictions
						.map((p) => {
							const signalClass = `signal-${p.signal.toLowerCase()}`;
							const confidencePercent = (p.confidence * 100).toFixed(0);
							const targetPrice = p.prediction.predictedData.at(-1)?.price ?? 0;
							const changePercent = ((targetPrice - p.prediction.currentPrice) / p.prediction.currentPrice) * 100;

							return `
							<tr>
								<td><a href="#stock-${p.symbol}" class="link-symbol">${p.symbol}</a></td>
								<td><span class="signal ${signalClass}" style="font-size: 12px; padding: 4px 10px;">${p.signal}</span></td>
								<td>
									${confidencePercent}%
									<div class="confidence-bar" style="width: 60px; height: 4px; margin-left: 5px;">
										<div class="confidence-fill" style="width: ${confidencePercent}%"></div>
									</div>
								</td>
								<td>$${p.prediction.currentPrice.toFixed(2)}</td>
								<td>$${targetPrice.toFixed(2)}</td>
								<td style="color: ${changePercent >= 0 ? 'var(--buy-color)' : 'var(--sell-color)'}; font-weight: bold;">
									${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%
								</td>
							</tr>
						`;
						})
						.join('')}
				</tbody>
			</table>
		`;
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
					<div style="font-size: 12px; color: #666; margin-top: 4px;">
						${quality.interpolatedCount > 0 ? `<span>• ${quality.interpolatedCount} interpolated points</span><br>` : ''}
						${quality.outlierCount > 0 ? `<span style="color: var(--sell-color);">• ${quality.outlierCount} outliers detected</span><br>` : ''}
						${quality.gapsDetected > 0 ? `<span>• ${quality.gapsDetected} gaps detected</span>` : ''}
					</div>
				</td>
			</tr>
		`;
	}

	/**
	 * Render backtest metrics row if available
	 * @param backtest - Backtest result
	 * @returns HTML string
	 */
	private renderBacktestSummary(backtest: ReportPrediction['backtest']): string {
		if (!backtest) return '';

		return `
			<div class="backtest-summary">
				<div class="backtest-metric">
					<div class="label">Backtest Return</div>
					<div class="value">${this.formatReportPercent(backtest.totalReturn)}</div>
				</div>
				<div class="backtest-metric">
					<div class="label">Benchmark (B&H)</div>
					<div class="value">${this.formatReportPercent(backtest.benchmarkReturn)}</div>
				</div>
				<div class="backtest-metric">
					<div class="label">Alpha</div>
					<div class="value">${this.formatReportPercent(backtest.alpha)}</div>
				</div>
				<div class="backtest-metric">
					<div class="label">Max Drawdown</div>
					<div class="value" style="color: var(--sell-color);">${(backtest.drawdown * 100).toFixed(2)}%</div>
				</div>
				<div class="backtest-metric">
					<div class="label">Win Rate</div>
					<div class="value">${(backtest.winRate * 100).toFixed(0)}%</div>
				</div>
				<div class="backtest-metric">
					<div class="label">Sharpe Ratio</div>
					<div class="value">${backtest.sharpeRatio.toFixed(2)}</div>
				</div>
			</div>
		`;
	}

	/**
	 * Helper to format percentage with color
	 * @param val
	 */
	private formatReportPercent(val: number): string {
		const color = val >= 0 ? 'var(--buy-color)' : 'var(--sell-color)';
		return `<span style="color: ${color}; font-weight: bold;">${(val * 100).toFixed(2)}%</span>`;
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
			<div class="stock-card" id="stock-${p.symbol}">
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

				${this.renderBacktestSummary(p.backtest)}

				${
					p.backtest
						? `
				<div class="chart-section">
					<div class="chart-title">Backtest Equity Curve (Walk-Forward Simulation)</div>
					<div class="chart-container">
						<canvas id="chart-backtest-${p.symbol}"></canvas>
					</div>
				</div>
				`
						: ''
				}

				<div class="chart-section">
					<div class="chart-title">Full Performance History (${appConfig.prediction.historyChartDays} Days)</div>
					<div class="chart-container">
						<canvas id="chart-history-${p.symbol}"></canvas>
					</div>
				</div>
				<div class="chart-section">
					<div class="chart-title">Recent Trend & Forecast (Last ${appConfig.prediction.contextDays} Days + Prediction)</div>
					<div style="font-size: 12px; color: #666; margin: 5px 0 10px 0; text-align: center;">
						Shaded area represents 95% confidence interval (Monte Carlo Dropout with ${appConfig.prediction.uncertaintyIterations} iterations)
					</div>
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
					<tr>
						<th>Prediction Interval (95%)</th>
						<td>
							$${(p.prediction.predictedData[0]?.lowerBound ?? 0).toFixed(2)} - $${(p.prediction.predictedData[0]?.upperBound ?? 0).toFixed(2)}
							<div style="font-size: 11px; color: #666; margin-top: 2px;">
								Range: ±$${(((p.prediction.predictedData[0]?.upperBound ?? 0) - (p.prediction.predictedData[0]?.lowerBound ?? 0)) / 2).toFixed(2)}
							</div>
						</td>
					</tr>
					${this.renderQualityMetrics(p.symbol)}
				</table>
			</div>
		`;
	}
}
