/**
 * LSTM Neural Network Model implementation using TensorFlow.js
 * Handles model architecture, training, and evaluation
 */

import * as tf from '@tensorflow/tfjs';

import type {Config} from '../config/schema.ts';
import type {FeatureConfig, MarketFeatures, StockDataPoint} from '../types/index.ts';

import {calculateOBV, calculateReturns, calculateRsi, calculateSma, calculateVolumeRatio} from './indicators.ts';

/**
 * Metadata stored with the saved model
 */
export type ModelMetadata = {
	dataPoints: number;
	dropout?: number;
	featureConfig?: FeatureConfig | undefined;
	l1Regularization?: number;
	l2Regularization?: number;
	loss: number;
	mape?: number | undefined;
	metrics: Record<string, number>;
	modelArchitecture?: 'lstm' | 'gru' | 'attention-lstm';
	normalizationType?: 'global-minmax' | 'window-zscore';
	recurrentDropout?: number;
	symbol: string;
	trainedAt: Date;
	trainingMethod?: 'absolute-prices' | 'log-returns';
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

		const {inputs, labels, prices} = this.preprocessData(data, marketFeatures);
		const result = this.model.evaluate(inputs, labels) as tf.Scalar[];
		const loss = result[0]?.dataSync()[0] ?? 0;

		// Calculate MAPE (Mean Absolute Percentage Error)
		const predictions = this.model.predict(inputs) as tf.Tensor;
		const predictedLogReturns = predictions.dataSync();
		const actualLogReturns = labels.dataSync();

		// Convert log returns back to prices for MAPE calculation
		let mapeSum = 0;
		let count = 0;

		for (const [i, predictedLogReturn] of predictedLogReturns.entries()) {
			const baseIdx = i + this.config.windowSize;
			const basePrice = prices[baseIdx] ?? 0;

			const actualLogReturn = actualLogReturns[i] ?? 0;

			const predictedPrice = basePrice * Math.exp(predictedLogReturn);
			const actualPrice = basePrice * Math.exp(actualLogReturn);

			if (actualPrice > 0) {
				const percentError = Math.abs((actualPrice - predictedPrice) / actualPrice);
				mapeSum += percentError;
				count++;
			}
		}

		const mape = count > 0 ? mapeSum / count : 0;

		inputs.dispose();
		labels.dispose();
		predictions.dispose();

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
	 * @param options - Prediction options
	 * @param options.training - Enable training mode (dropout) during inference
	 * @returns Predicted prices
	 */
	public predict(data: StockDataPoint[], days: number, marketFeatures?: MarketFeatures[], options: {training?: boolean} = {}): number[] {
		if (!this.model) {
			throw new Error('Model not trained or loaded');
		}

		const {inputs, logReturns, prices} = this.preprocessData(data, marketFeatures);
		const predictions: number[] = [];

		// Start with the last window
		const inputDim = inputs.shape[2];
		let lastWindow = inputs.slice([inputs.shape[0] - 1, 0, 0], [1, this.config.windowSize, inputDim]);

		// Current price is the last price in the data
		let currentPrice = prices.at(-1) ?? 0;

		// Get last known market features for decay calculation
		const lastMarketFeatures = marketFeatures && marketFeatures.length > 0 ? marketFeatures.at(-1) : undefined;

		for (let i = 0; i < days; i++) {
			const prediction = (options.training ? this.model.apply(lastWindow, {training: true}) : this.model.predict(lastWindow)) as tf.Tensor2D;
			const dataSync = prediction.dataSync();
			const predictedLogReturn = dataSync[0] ?? 0;

			// Convert log return to price
			const predictedPrice = currentPrice * Math.exp(predictedLogReturn);
			predictions.push(predictedPrice);

			// Calculate log return for the new predicted point
			const newLogReturn = Math.log(predictedPrice / currentPrice);

			// Update window for next prediction
			// Calculate exponential decay for market features (half-life of 10 days)
			const decayFactor = Math.exp(-i / 10);

			// Neutral values for market features
			const neutralMarketReturn = 0;
			const neutralVix = 20;
			const neutralRegime = 0.5;
			const neutralDistanceFromMA = 0;
			const neutralRelativeReturn = 0;
			const neutralVolatilitySpread = 0;

			// Build decayed market features
			const decayedFeatures =
				this.featureConfig?.enabled && lastMarketFeatures
					? this.buildDecayedFeatureRow(lastMarketFeatures, decayFactor, {
							distanceFromMA: neutralDistanceFromMA,
							marketReturn: neutralMarketReturn,
							regime: neutralRegime,
							relativeReturn: neutralRelativeReturn,
							vix: neutralVix,
							volatilitySpread: neutralVolatilitySpread,
						})
					: [];

			// Get the last technical indicators from the window
			const lastWindowData = lastWindow.dataSync();
			const lastPoint = [...lastWindowData].slice(-inputDim);

			// Extract technical indicators (skip first element which is log return)
			// Now includes: SMA, RSI, Returns, VolumeRatio, OBV (5 features)
			const technicalFeatureCount = 5;
			const technicalIndicators = lastPoint.slice(1, 1 + technicalFeatureCount);

			// Build new point with predicted log return + technical indicators + market features
			const newPointData = [newLogReturn, ...technicalIndicators, ...decayedFeatures];

			// Normalize the new log return using z-score from recent window
			const recentLogReturns = logReturns.slice(-this.config.windowSize);
			const {mean, std} = this.calculateMeanStd(recentLogReturns);
			const normalizedNewLogReturn = std > 0 ? (newLogReturn - mean) / std : 0;

			// Replace first element with normalized log return
			newPointData[0] = normalizedNewLogReturn;

			const newPoint = tf.tensor3d([[newPointData]]);

			// eslint-disable-next-line unicorn/prefer-spread -- Justification: tf.concat requires an array of tensors.
			const nextWindow = tf.concat([lastWindow.slice([0, 1, 0], [1, this.config.windowSize - 1, inputDim]), newPoint], 1);

			lastWindow.dispose();
			prediction.dispose();
			newPoint.dispose();
			lastWindow = nextWindow;

			// Update current price for next iteration
			currentPrice = predictedPrice;
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
		let currentLearningRate = this.config.learningRate;

		const history = await this.model.fit(trainX, trainY, {
			batchSize: this.config.batchSize,
			callbacks: {
				onEpochEnd: (epoch: number, logs?: tf.Logs) => {
					if (onProgress && logs) {
						onProgress(epoch + 1, logs.loss ?? 0);
					}

					// Manual Early Stopping and LR Scheduling implementation
					const valLoss = logs?.val_loss;
					if (valLoss !== undefined) {
						if (valLoss < bestLoss) {
							bestLoss = valLoss;
							patienceCounter = 0;
						} else {
							patienceCounter++;

							// Adaptive Learning Rate: Reduce by 50% after 3 epochs of no improvement
							if (patienceCounter === 3 && this.model) {
								currentLearningRate *= 0.5;
								// @ts-expect-error -- Justification: Adam optimizer in TFJS 4.x has a learningRate property but it's not always exposed in the base Optimizer type.
								this.model.optimizer.learningRate = currentLearningRate;
							}
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
			dropout: this.config.dropout,
			featureConfig: this.featureConfig ?? undefined,
			l1Regularization: this.config.l1Regularization,
			l2Regularization: this.config.l2Regularization,
			loss: finalLoss,
			metrics: {
				finalLoss,
				meanAbsoluteError: (history.history.mae?.at(-1) as number) || 0,
				validationLoss: finalValLoss,
			},
			normalizationType: 'window-zscore',
			recurrentDropout: this.config.recurrentDropout,
			modelArchitecture: this.config.architecture,
			symbol: 'UNKNOWN',
			trainedAt: new Date(),
			trainingMethod: 'log-returns',
			version: '2.0.0',
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
	 * Build a feature row with exponential decay toward neutral values
	 * Used during multi-step prediction to avoid frozen market conditions
	 * @param f - Last known market features
	 * @param decayFactor - Exponential decay factor (0 = full neutral, 1 = no decay)
	 * @param neutralValues - Target neutral values for each feature
	 * @param neutralValues.marketReturn - Neutral market return (typically 0)
	 * @param neutralValues.relativeReturn - Neutral relative return (typically 0)
	 * @param neutralValues.vix - Neutral VIX level (typically 20, historical mean)
	 * @param neutralValues.volatilitySpread - Neutral volatility spread (typically 0)
	 * @param neutralValues.regime - Neutral regime value (typically 0.5 for NEUTRAL)
	 * @param neutralValues.distanceFromMA - Neutral distance from MA (typically 0)
	 */
	private buildDecayedFeatureRow(
		f: MarketFeatures,
		decayFactor: number,
		neutralValues: {
			distanceFromMA: number;
			marketReturn: number;
			regime: number;
			relativeReturn: number;
			vix: number;
			volatilitySpread: number;
		},
	): number[] {
		const row: number[] = [];

		// Market returns (decayed toward 0)
		if (this.featureConfig?.includeMarketReturn) {
			const decayed = (f.marketReturn ?? 0) * decayFactor + neutralValues.marketReturn * (1 - decayFactor);
			row.push(this.normalizeValue(decayed, -0.1, 0.1));
		}
		if (this.featureConfig?.includeRelativeReturn) {
			const decayed = (f.relativeReturn ?? 0) * decayFactor + neutralValues.relativeReturn * (1 - decayFactor);
			row.push(this.normalizeValue(decayed, -0.1, 0.1));
		}

		// Beta and correlation (kept stable - stock characteristics)
		if (this.featureConfig?.includeBeta) {
			row.push(this.normalizeValue(f.beta ?? 1, 0, 3));
		}
		if (this.featureConfig?.includeCorrelation) {
			row.push(this.normalizeValue(f.indexCorrelation ?? 0, -1, 1));
		}

		// VIX (decayed toward 20, historical mean)
		if (this.featureConfig?.includeVix) {
			const decayed = (f.vix ?? 20) * decayFactor + neutralValues.vix * (1 - decayFactor);
			row.push(this.normalizeValue(decayed, 10, 50));
		}
		if (this.featureConfig?.includeVolatilitySpread) {
			const decayed = (f.volatilitySpread ?? 0) * decayFactor + neutralValues.volatilitySpread * (1 - decayFactor);
			row.push(this.normalizeValue(decayed, -0.5, 0.5));
		}

		// Regime (decayed toward NEUTRAL = 0.5)
		if (this.featureConfig?.includeRegime) {
			let regimeVal = 0.5;
			if (f.marketRegime === 'BULL') {
				regimeVal = 1;
			} else if (f.marketRegime === 'BEAR') {
				regimeVal = 0;
			}
			const decayed = regimeVal * decayFactor + neutralValues.regime * (1 - decayFactor);
			row.push(decayed);
		}
		if (this.featureConfig?.includeDistanceFromMA) {
			const decayed = (f.distanceFromMA ?? 0) * decayFactor + neutralValues.distanceFromMA * (1 - decayFactor);
			row.push(this.normalizeValue(decayed, -0.2, 0.2));
		}

		return row;
	}

	/**
	 * Build a feature row for a single data point
	 * @param f - Market features for this date
	 */
	private buildFeatureRow(f: MarketFeatures | undefined): number[] {
		const row: number[] = [];

		// Market returns (normalized to [-10%, +10%] → [0, 1])
		if (this.featureConfig?.includeMarketReturn) {
			row.push(this.normalizeValue(f?.marketReturn ?? 0, -0.1, 0.1));
		}
		if (this.featureConfig?.includeRelativeReturn) {
			row.push(this.normalizeValue(f?.relativeReturn ?? 0, -0.1, 0.1));
		}

		// Beta and correlation
		if (this.featureConfig?.includeBeta) {
			row.push(this.normalizeValue(f?.beta ?? 1, 0, 3));
		}
		if (this.featureConfig?.includeCorrelation) {
			row.push(this.normalizeValue(f?.indexCorrelation ?? 0, -1, 1));
		}

		// Volatility metrics
		if (this.featureConfig?.includeVix) {
			row.push(this.normalizeValue(f?.vix ?? 20, 10, 50));
		}
		if (this.featureConfig?.includeVolatilitySpread) {
			row.push(this.normalizeValue(f?.volatilitySpread ?? 0, -0.5, 0.5));
		}

		// Market regime and positioning
		if (this.featureConfig?.includeRegime) {
			let regimeVal = 0.5;
			if (f?.marketRegime === 'BULL') {
				regimeVal = 1;
			} else if (f?.marketRegime === 'BEAR') {
				regimeVal = 0;
			}
			row.push(regimeVal);
		}
		if (this.featureConfig?.includeDistanceFromMA) {
			row.push(this.normalizeValue(f?.distanceFromMA ?? 0, -0.2, 0.2));
		}

		return row;
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
			// Calculate input dimension based on enabled features
			// 1 (price) + 5 (technical indicators: SMA, RSI, Returns, VolumeRatio, OBV) + market features
			const technicalFeatureCount = 5;
			const marketFeatureCount = this.featureConfig?.enabled ? this.getEnabledFeatureCount() : 0;
			const inputDim = 1 + technicalFeatureCount + marketFeatureCount;

			const model = this.createArchitecture(this.config.architecture, inputDim);

			const optimizer = tf.train.adam(this.config.learningRate);
			// @ts-expect-error -- Justification: clipvalue is supported by many TFJS optimizers but not always in the base type.
			optimizer.clipvalue = 1;

			model.compile({
				loss: 'meanSquaredError',
				metrics: ['mae'],
				optimizer,
			});

			return model;
		} finally {
			// eslint-disable-next-line no-console -- Justification: Restoring original console.warn.
			console.warn = originalWarn;
		}
	}

	/**
	 * Create the neural network architecture based on configuration
	 * @param type - Architecture type
	 * @param inputDim - Number of input features
	 */
	private createArchitecture(type: 'lstm' | 'gru' | 'attention-lstm', inputDim: number): tf.LayersModel {
		const model = tf.sequential();
		const commonParams = {
			kernelRegularizer: tf.regularizers.l1l2({
				l1: this.config.l1Regularization,
				l2: this.config.l2Regularization,
			}),
			recurrentDropout: this.config.recurrentDropout,
		};

		if (type === 'gru') {
			model.add(tf.layers.gru({...commonParams, inputShape: [this.config.windowSize, inputDim], returnSequences: true, units: 64}));
			model.add(tf.layers.dropout({rate: this.config.dropout}));
			model.add(tf.layers.gru({...commonParams, returnSequences: false, units: 64}));
		} else if (type === 'attention-lstm') {
			// Attention-LSTM Implementation
			// Layer 1: LSTM with return sequences
			model.add(tf.layers.lstm({...commonParams, inputShape: [this.config.windowSize, inputDim], returnSequences: true, units: 64}));
			model.add(tf.layers.dropout({rate: this.config.dropout}));

			// Layer 2: Self-Attention Mechanism
			// We use a simple Bahdanau-style attention by using a dense layer to compute weights
			// Since TFJS doesn't have a built-in Attention layer in the high-level Layers API for all versions,
			// we implement it using available layers or a custom approach.
			// Here we'll use a GlobalAveragePooling1D or a flattened dense layer to simulate weighting
			// if a custom layer is too complex for this context, but for "Attention-LSTM" we should try
			// to be more authentic.
			model.add(tf.layers.lstm({...commonParams, returnSequences: true, units: 64}));

			// Simple Attention implementation via Permute and Dense
			model.add(tf.layers.permute({dims: [2, 1]})); // [units, window]
			model.add(tf.layers.dense({activation: 'softmax', units: this.config.windowSize})); // weight each timestep
			model.add(tf.layers.permute({dims: [2, 1]})); // [window, units] weighted

			// Global Average Pooling to reduce to single vector
			model.add(tf.layers.globalAveragePooling1d({}));
		} else {
			// Default LSTM
			model.add(tf.layers.lstm({...commonParams, inputShape: [this.config.windowSize, inputDim], returnSequences: true, units: 64}));
			model.add(tf.layers.dropout({rate: this.config.dropout}));
			model.add(tf.layers.lstm({...commonParams, returnSequences: false, units: 64}));
		}

		model.add(tf.layers.dropout({rate: this.config.dropout}));
		model.add(tf.layers.dense({activation: 'linear', units: 1}));

		return model;
	}

	/**
	 * Calculate mean and standard deviation
	 * @param values - Array of values
	 */
	private calculateMeanStd(values: number[]): {mean: number; std: number} {
		if (values.length === 0) {
			return {mean: 0, std: 1};
		}

		const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
		const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
		const std = Math.sqrt(variance);

		return {mean, std: std === 0 ? 1 : std};
	}

	/**
	 * Create sliding window sequences for LSTM with window-based z-score normalization
	 * Fixes data leakage by normalizing each window independently
	 * @param logReturns - Log returns array
	 * @param featureMatrix - Technical and market features
	 * @param useFeatures - Whether to include features
	 */
	private createSequencesWithWindowNorm(logReturns: number[], featureMatrix: number[][], useFeatures: boolean): {inputs: number[][][]; labels: number[][]} {
		const inputs: number[][][] = [];
		const labels: number[][] = [];

		for (let i = 0; i < logReturns.length - this.config.windowSize; i++) {
			const window: number[][] = [];

			// Extract log returns for this window
			const windowLogReturns = logReturns.slice(i, i + this.config.windowSize);

			// Calculate window-specific mean and std (z-score normalization)
			const {mean, std} = this.calculateMeanStd(windowLogReturns);

			// Normalize each point in the window
			for (let j = 0; j < this.config.windowSize; j++) {
				const idx = i + j;
				const logReturn = logReturns[idx] ?? 0;
				const normalizedLogReturn = std > 0 ? (logReturn - mean) / std : 0;

				const features = [normalizedLogReturn];
				const row = featureMatrix[idx];
				if (useFeatures && row !== undefined) {
					features.push(...row);
				}
				window.push(features);
			}

			inputs.push(window);

			// Label is the next log return (not normalized - model predicts raw log return)
			const nextLogReturn = logReturns[i + this.config.windowSize] ?? 0;
			labels.push([nextLogReturn]);
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
		if (this.featureConfig.includeMarketReturn) {
			count++;
		}
		if (this.featureConfig.includeRelativeReturn) {
			count++;
		}
		if (this.featureConfig.includeBeta) {
			count++;
		}
		if (this.featureConfig.includeCorrelation) {
			count++;
		}
		if (this.featureConfig.includeVix) {
			count++;
		}
		if (this.featureConfig.includeVolatilitySpread) {
			count++;
		}
		if (this.featureConfig.includeRegime) {
			count++;
		}
		if (this.featureConfig.includeDistanceFromMA) {
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
	 * Uses log returns and window-based z-score normalization to fix data leakage
	 * @param data - Historical stock data
	 * @param marketFeatures - Optional market context features
	 * @returns Normalized tensors and metadata
	 */
	private preprocessData(
		data: StockDataPoint[],
		marketFeatures?: MarketFeatures[],
	): {
		inputs: tf.Tensor3D;
		labels: tf.Tensor2D;
		logReturns: number[];
		prices: number[];
	} {
		const prices = data.map((d) => d.close);

		// Convert prices to log returns (more stationary than raw prices)
		const logReturns: number[] = [0]; // First return is 0
		for (let i = 1; i < prices.length; i++) {
			const current = prices[i] ?? 0;
			const previous = prices[i - 1] ?? 0;
			const logReturn = previous > 0 ? Math.log(current / previous) : 0;
			logReturns.push(logReturn);
		}

		// Calculate Technical Indicators (still use prices for SMA/RSI)
		const sma20 = calculateSma(prices, 20);
		const rsi14 = calculateRsi(prices, 14);
		const dailyReturns = calculateReturns(prices);

		// Calculate Volume-Based Features
		const volumes = data.map((d) => d.volume);
		const volumeRatio = calculateVolumeRatio(volumes);
		const obv = calculateOBV(prices, volumes);

		// Normalize technical indicators (these don't have look-ahead bias)
		const normalizedRsi = rsi14.map((v: number) => v / 100);
		const normalizedReturns = dailyReturns.map((v: number) => Math.max(0, Math.min(1, (v + 0.1) / 0.2)));

		// Normalize SMA using same min/max as prices (for consistency)
		const priceMin = Math.min(...prices);
		const priceMax = Math.max(...prices);
		const normalizedSma = sma20.map((v: number) => (priceMax === priceMin ? 0.5 : (v - priceMin) / (priceMax - priceMin)));

		// Normalize volume features
		const normalizedVolumeRatio = volumeRatio.map((v: number) => Math.min(1, v / 3)); // Clip to [0, 1], 3x average = max
		const obvMin = Math.min(...obv);
		const obvMax = Math.max(...obv);
		const normalizedOBV = obv.map((v: number) => (obvMax === obvMin ? 0.5 : (v - obvMin) / (obvMax - obvMin)));

		const technicalMatrix: number[][] = data.map((_, i) => [
			normalizedSma[i] ?? 0.5,
			normalizedRsi[i] ?? 0.5,
			normalizedReturns[i] ?? 0.5,
			normalizedVolumeRatio[i] ?? 0.5,
			normalizedOBV[i] ?? 0.5,
		]);

		// Process market features if enabled and provided
		const useMarketFeatures = this.featureConfig?.enabled === true && marketFeatures !== undefined && marketFeatures.length > 0;
		const featureMatrix = useMarketFeatures ? this.processMarketFeatures(data, marketFeatures) : [];

		// Combine all features
		const combinedFeatureMatrix: number[][] = technicalMatrix.map((techRow, i) => {
			const marketRow = featureMatrix[i] ?? [];
			return [...techRow, ...marketRow];
		});

		// Create sequences with window-based z-score normalization for log returns
		const {inputs, labels} = this.createSequencesWithWindowNorm(logReturns, combinedFeatureMatrix, true);

		return {
			inputs: tf.tensor3d(inputs),
			labels: tf.tensor2d(labels),
			logReturns,
			prices,
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
			const row = this.buildFeatureRow(f);
			featureMatrix.push(row);
		}
		return featureMatrix;
	}
}
