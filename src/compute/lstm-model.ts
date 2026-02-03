/**
 * LSTM Neural Network Model implementation using TensorFlow.js
 * Handles model architecture, training, and evaluation
 */

import * as tf from '@tensorflow/tfjs';

import type {Config} from '../config/schema.ts';
import type {FeatureConfig, MarketFeatures, StockDataPoint} from '../types/index.ts';

import {calculateReturns, calculateRsi, calculateSma} from './indicators.ts';

/**
 * Metadata stored with the saved model
 */
export type ModelMetadata = {
	dataPoints: number;
	featureConfig?: FeatureConfig | undefined;
	loss: number;
	mape?: number | undefined;
	metrics: Record<string, number>;
	symbol: string;
	trainedAt: Date;
	version: string;
	windowSize: number;
};

/**
 * Model performance metrics returned after evaluation or training
 */
export type PerformanceMetrics = {
	accuracy: number;
	dataPoints: number;
	isValid: boolean;
	loss: number;
	mape?: number;
	windowSize: number;
};

/**
 * LSTM Model class wrapper
 */
export class LstmModel {
	private readonly config: Config['model'];
	private readonly featureConfig: FeatureConfig | null = null;
	private metadata: ModelMetadata | null = null;
	private model: null | tf.LayersModel = null;

	/**
	 * @param config
	 * @param featureConfig
	 */
	public constructor(config: Config['model'], featureConfig?: FeatureConfig) {
		this.config = config;
		this.featureConfig = featureConfig ?? null;
	}

	/**
	 * Evaluate model performance on the dataset
	 * @param data - Dataset to evaluate against
	 * @param _appConfig - Application configuration
	 * @param marketFeatures - Optional market context features
	 * @returns Final evaluation metrics
	 */
	public evaluate(data: StockDataPoint[], _appConfig: Config, marketFeatures?: MarketFeatures[]): PerformanceMetrics & {mape: number} {
		if (!this.model) {
			throw new Error('Model not trained or loaded');
		}

		const {inputs, labels, max, min} = this.preprocessData(data, marketFeatures);
		const result = this.model.evaluate(inputs, labels) as tf.Scalar[];
		const loss = result[0]?.dataSync()[0] ?? 0;

		// Calculate MAPE (Mean Absolute Percentage Error)
		const predictions = this.model.predict(inputs) as tf.Tensor;
		const actuals = labels;

		// Rescale to actual prices
		const actualPrices = actuals.mul(max - min).add(min);
		const predictedPrices = predictions.mul(max - min).add(min);

		// MAPE = mean(|actual - predicted| / actual)
		const absoluteDiff = actualPrices.sub(predictedPrices).abs();
		const percentageError = absoluteDiff.div(actualPrices);
		const mape = percentageError.mean().dataSync()[0] ?? 0;

		inputs.dispose();
		labels.dispose();
		predictions.dispose();
		actualPrices.dispose();
		predictedPrices.dispose();
		absoluteDiff.dispose();
		percentageError.dispose();

		return {
			accuracy: 1 - loss,
			dataPoints: data.length,
			isValid: loss < 1,
			loss,
			mape,
			windowSize: this.config.windowSize,
		};
	}

	/**
	 * Get model metadata
	 * @returns The metadata instance
	 */
	public getMetadata(): ModelMetadata | null {
		return this.metadata;
	}

	/**
	 * Get the internal TensorFlow.js model
	 * @returns The model instance
	 */
	public getModel(): null | tf.LayersModel {
		return this.model;
	}

	/**
	 * Check if model is trained
	 * @returns True if trained
	 */
	public isTrained(): boolean {
		return this.model !== null;
	}

	/**
	 * Predict future prices
	 * @param data - Historical data context
	 * @param days - Number of days to predict
	 * @param marketFeatures - Optional market context features
	 * @returns Predicted prices
	 */
	public predict(data: StockDataPoint[], days: number, marketFeatures?: MarketFeatures[]): number[] {
		if (!this.model) {
			throw new Error('Model not trained or loaded');
		}

		const {inputs, max, min} = this.preprocessData(data, marketFeatures);
		const predictions: number[] = [];

		// Start with the last window
		const inputDim = inputs.shape[2];
		let lastWindow = inputs.slice([inputs.shape[0] - 1, 0, 0], [1, this.config.windowSize, inputDim]);

		for (let i = 0; i < days; i++) {
			const prediction = this.model.predict(lastWindow) as tf.Tensor2D;
			const dataSync = prediction.dataSync();
			const price = dataSync[0] ?? 0;
			predictions.push(min + price * (max - min));

			// Update window for next prediction
			// For future points, we use the predicted price and reuse the last known market features
			const lastKnownFeatures = inputDim > 1 ? lastWindow.slice([0, this.config.windowSize - 1, 1], [1, 1, inputDim - 1]) : null;

			const newPoint: tf.Tensor3D =
				lastKnownFeatures === null
					? tf.tensor3d([[[price]]])
					: // eslint-disable-next-line unicorn/prefer-spread -- Justification: tf.concat requires an array of tensors.
						tf.concat([tf.tensor3d([[[price]]]), lastKnownFeatures], 2);

			if (lastKnownFeatures !== null) {
				lastKnownFeatures.dispose();
			}

			// eslint-disable-next-line unicorn/prefer-spread -- Justification: tf.concat requires an array of tensors.
			const nextWindow = tf.concat([lastWindow.slice([0, 1, 0], [1, this.config.windowSize - 1, inputDim]), newPoint], 1);

			lastWindow.dispose();
			prediction.dispose();
			newPoint.dispose();
			lastWindow = nextWindow;
		}

		inputs.dispose();
		lastWindow.dispose();

		return predictions;
	}

	/**
	 * Set internal model and metadata (used after loading)
	 * @param model - TensorFlow model
	 * @param metadata - Associated metadata
	 */
	public setModel(model: tf.LayersModel, metadata: ModelMetadata): void {
		this.model = model;
		this.metadata = metadata;
	}

	/**
	 * Train the LSTM model
	 * @param data - Historical stock data
	 * @param _appConfig - Application configuration
	 * @param onProgress - Progress callback
	 * @param marketFeatures - Optional market context features
	 * @returns Final training metrics
	 */
	public async train(
		data: StockDataPoint[],
		_appConfig: Config,
		onProgress?: (epoch: number, loss: number) => void,
		marketFeatures?: MarketFeatures[],
	): Promise<PerformanceMetrics> {
		if (data.length < this.config.windowSize + 5) {
			throw new Error(`Insufficient data for training. Need at least ${this.config.windowSize + 5} points.`);
		}

		this.model = this.buildModel();
		const {inputs, labels} = this.preprocessData(data, marketFeatures);

		// Time-series split (last 10% for validation)
		const totalSamples = inputs.shape[0];
		const trainSamples = Math.floor(totalSamples * 0.9);
		const valSamples = totalSamples - trainSamples;

		const trainX = inputs.slice([0, 0, 0], [trainSamples, this.config.windowSize, inputs.shape[2]]);
		const trainY = labels.slice([0, 0], [trainSamples, 1]);
		const valX = inputs.slice([trainSamples, 0, 0], [valSamples, this.config.windowSize, inputs.shape[2]]);
		const valY = labels.slice([trainSamples, 0], [valSamples, 1]);

		let bestLoss = Number.POSITIVE_INFINITY;
		let patienceCounter = 0;
		const patience = 5;

		const history = await this.model.fit(trainX, trainY, {
			batchSize: this.config.batchSize,
			callbacks: {
				onEpochEnd: (epoch: number, logs?: tf.Logs) => {
					if (onProgress && logs) {
						onProgress(epoch + 1, logs.loss ?? 0);
					}

					// Manual Early Stopping implementation for val_loss
					const valLoss = logs?.val_loss;
					if (valLoss !== undefined) {
						if (valLoss < bestLoss) {
							bestLoss = valLoss;
							patienceCounter = 0;
						} else {
							patienceCounter++;
						}

						if (patienceCounter >= patience && this.model) {
							this.model.stopTraining = true;
						}
					}
				},
			},
			epochs: this.config.epochs,
			shuffle: false, // Time series data should not be shuffled
			validationData: [valX, valY],
			verbose: 0,
		});

		const finalLoss = Array.isArray(history.history.loss) ? (history.history.loss.at(-1) as number) : 0;
		const finalValLoss = Array.isArray(history.history.val_loss) ? (history.history.val_loss.at(-1) as number) : 0;

		this.metadata = {
			dataPoints: data.length,
			featureConfig: this.featureConfig ?? undefined,
			loss: finalLoss,
			metrics: {
				finalLoss,
				meanAbsoluteError: (history.history.mae?.at(-1) as number) || 0,
				validationLoss: finalValLoss,
			},
			symbol: 'UNKNOWN',
			trainedAt: new Date(),
			version: '1.0.0',
			windowSize: this.config.windowSize,
		};

		// Cleanup tensors
		inputs.dispose();
		labels.dispose();
		trainX.dispose();
		trainY.dispose();
		valX.dispose();
		valY.dispose();

		return {
			accuracy: 1 - finalLoss,
			dataPoints: data.length,
			isValid: finalLoss < 1,
			loss: finalLoss,
			windowSize: this.config.windowSize,
		};
	}

	/**
	 * Build the LSTM model architecture
	 * @returns Compiled TensorFlow.js model
	 */
	private buildModel(): tf.LayersModel {
		// Suppress persistent TFJS orthogonal initializer warnings
		// eslint-disable-next-line no-console -- Justification: Temporary override to silence specific library noise.
		const originalWarn = console.warn;
		// eslint-disable-next-line no-console -- Justification: Temporary override to silence specific library noise.
		console.warn = (...args: unknown[]): void => {
			if (typeof args[0] === 'string' && args[0].includes('Orthogonal initializer')) {
				return;
			}
			originalWarn(...args);
		};

		try {
			const model = tf.sequential();

			// Calculate input dimension based on enabled features
			// 1 (price) + 3 (technical indicators: SMA, RSI, Returns) + market features
			const technicalFeatureCount = 3;
			const marketFeatureCount = this.featureConfig?.enabled ? this.getEnabledFeatureCount() : 0;
			const inputDim = 1 + technicalFeatureCount + marketFeatureCount;

			// LSTM Layer 1
			model.add(
				tf.layers.lstm({
					inputShape: [this.config.windowSize, inputDim],
					returnSequences: true,
					units: 64,
				}),
			);
			model.add(tf.layers.dropout({rate: 0.2}));

			// LSTM Layer 2
			model.add(
				tf.layers.lstm({
					returnSequences: false,
					units: 64,
				}),
			);
			model.add(tf.layers.dropout({rate: 0.2}));

			// Dense Output Layer
			model.add(
				tf.layers.dense({
					activation: 'linear',
					units: 1,
				}),
			);

			model.compile({
				loss: 'meanSquaredError',
				metrics: ['mae'],
				optimizer: tf.train.adam(this.config.learningRate),
			});

			return model;
		} finally {
			// eslint-disable-next-line no-console -- Justification: Restoring original console.warn.
			console.warn = originalWarn;
		}
	}

	/**
	 * Create sliding window sequences for LSTM
	 * @param normalizedPrices
	 * @param featureMatrix
	 * @param useFeatures
	 */
	private createSequences(normalizedPrices: number[], featureMatrix: number[][], useFeatures: boolean): {inputs: number[][][]; labels: number[][]} {
		const inputs: number[][][] = [];
		const labels: number[][] = [];

		for (let i = 0; i < normalizedPrices.length - this.config.windowSize; i++) {
			const window: number[][] = [];
			for (let j = 0; j < this.config.windowSize; j++) {
				const idx = i + j;
				const features = [normalizedPrices[idx] ?? 0.5];
				const row = featureMatrix[idx];
				if (useFeatures && row !== undefined) {
					features.push(...row);
				}
				window.push(features);
			}
			inputs.push(window);
			labels.push([normalizedPrices[i + this.config.windowSize] ?? 0.5]);
		}
		return {inputs, labels};
	}

	/**
	 * Count enabled market features
	 */
	private getEnabledFeatureCount(): number {
		if (!this.featureConfig?.enabled) {
			return 0;
		}
		let count = 0;
		if (this.featureConfig.includeBeta) {
			count++;
		}
		if (this.featureConfig.includeCorrelation) {
			count++;
		}
		if (this.featureConfig.includeVix) {
			count++;
		}
		if (this.featureConfig.includeRegime) {
			count++;
		}
		return count;
	}

	/**
	 * Helper to normalize values to [0, 1] with clipping
	 * @param val
	 * @param min
	 * @param max
	 */
	private normalizeValue(val: number, min: number, max: number): number {
		const normalized = (val - min) / (max - min);
		return Math.max(0, Math.min(1, normalized));
	}

	/**
	 * Preprocess stock data into sequences for LSTM training
	 * @param data - Historical stock data
	 * @param marketFeatures - Optional market context features
	 * @returns Normalized tensors
	 */
	private preprocessData(data: StockDataPoint[], marketFeatures?: MarketFeatures[]): {inputs: tf.Tensor3D; labels: tf.Tensor2D; max: number; min: number} {
		const prices = data.map((d) => d.close);
		const min = Math.min(...prices);
		const max = Math.max(...prices);

		// Normalize prices to [0, 1]
		const normalizedPrices = prices.map((p) => (max === min ? 0.5 : (p - min) / (max - min)));

		// Calculate Technical Indicators
		const sma20 = calculateSma(prices, 20);
		const rsi14 = calculateRsi(prices, 14);
		const dailyReturns = calculateReturns(prices);

		// Normalize indicators
		const normalizedSma = sma20.map((v: number) => (max === min ? 0.5 : (v - min) / (max - min)));
		const normalizedRsi = rsi14.map((v: number) => v / 100);
		const normalizedReturns = dailyReturns.map((v: number) => Math.max(0, Math.min(1, (v + 0.1) / 0.2))); // Clip returns to [-10%, +10%] normalized to [0, 1]

		const technicalMatrix: number[][] = data.map((_, i) => [normalizedSma[i] ?? 0.5, normalizedRsi[i] ?? 0.5, normalizedReturns[i] ?? 0.5]);

		// Process market features if enabled and provided
		const useMarketFeatures = this.featureConfig?.enabled === true && marketFeatures !== undefined && marketFeatures.length > 0;
		const featureMatrix = useMarketFeatures ? this.processMarketFeatures(data, marketFeatures) : [];

		// Combine all features
		const combinedFeatureMatrix: number[][] = technicalMatrix.map((techRow, i) => {
			const marketRow = featureMatrix[i] ?? [];
			return [...techRow, ...marketRow];
		});

		const {inputs, labels} = this.createSequences(normalizedPrices, combinedFeatureMatrix, true);

		return {
			inputs: tf.tensor3d(inputs),
			labels: tf.tensor2d(labels),
			max,
			min,
		};
	}

	/**
	 * Process and normalize market features into a matrix
	 * @param data
	 * @param marketFeatures
	 */
	private processMarketFeatures(data: StockDataPoint[], marketFeatures: MarketFeatures[]): number[][] {
		if (!this.featureConfig) {
			return [];
		}

		const featureMatrix: number[][] = [];
		const featuresByDate = new Map(marketFeatures.map((f) => [f.date, f]));

		for (const point of data) {
			const f = featuresByDate.get(point.date);
			const row: number[] = [];

			if (this.featureConfig.includeBeta) {
				row.push(this.normalizeValue(f?.beta ?? 1, 0, 3));
			}
			if (this.featureConfig.includeCorrelation) {
				row.push(this.normalizeValue(f?.indexCorrelation ?? 0, -1, 1));
			}
			if (this.featureConfig.includeVix) {
				row.push(this.normalizeValue(f?.vix ?? 20, 10, 50));
			}
			if (this.featureConfig.includeRegime) {
				let regimeVal = 0.5;
				if (f?.marketRegime === 'BULL') {
					regimeVal = 1;
				} else if (f?.marketRegime === 'BEAR') {
					regimeVal = 0;
				}
				row.push(regimeVal);
			}
			featureMatrix.push(row);
		}
		return featureMatrix;
	}
}
