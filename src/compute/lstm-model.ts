/**
 * LSTM Neural Network Model implementation using TensorFlow.js
 * Handles model architecture, training, and evaluation
 */

import * as tf from '@tensorflow/tfjs';

import type {Config} from '../config/schema.ts';
import type {StockDataPoint} from '../types/index.ts';

/**
 * Metadata stored with the saved model
 */
export type ModelMetadata = {
	dataPoints: number;
	loss: number;
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
	windowSize: number;
};

/**
 * LSTM Model class wrapper
 */
export class LstmModel {
	private model: null | tf.LayersModel = null;
	private metadata: ModelMetadata | null = null;
	private readonly config: Config['model'];

	public constructor(config: Config['model']) {
		this.config = config;
	}

	/**
	 * Build the LSTM model architecture
	 * @returns Compiled TensorFlow.js model
	 */
	private buildModel(): tf.LayersModel {
		// Suppress persistent TFJS orthogonal initializer warnings
		const originalWarn = console.warn;
		console.warn = (...args: unknown[]): void => {
			if (typeof args[0] === 'string' && args[0].includes('Orthogonal initializer')) {
				return;
			}
			originalWarn(...args);
		};

		try {
			const model = tf.sequential();

			// LSTM Layer 1
			model.add(
				tf.layers.lstm({
					units: 50,
					returnSequences: true,
					inputShape: [this.config.windowSize, 1],
				}),
			);
			model.add(tf.layers.dropout({rate: 0.2}));

			// LSTM Layer 2
			model.add(
				tf.layers.lstm({
					units: 50,
					returnSequences: false,
				}),
			);
			model.add(tf.layers.dropout({rate: 0.2}));

			// Dense Output Layer
			model.add(
				tf.layers.dense({
					units: 1,
					activation: 'linear',
				}),
			);

			model.compile({
				optimizer: tf.train.adam(this.config.learningRate),
				loss: 'meanSquaredError',
				metrics: ['mae'],
			});

			return model;
		} finally {
			console.warn = originalWarn;
		}
	}

	/**
	 * Preprocess stock data into sequences for LSTM training
	 * @param data - Historical stock data
	 * @returns Normalized tensors
	 */
	private preprocessData(data: StockDataPoint[]): {inputs: tf.Tensor3D; labels: tf.Tensor2D; max: number; min: number;} {
		const prices = data.map((d) => d.close);
		const min = Math.min(...prices);
		const max = Math.max(...prices);

		// Normalize to [0, 1]
		const normalized = prices.map((p) => (max === min ? 0.5 : (p - min) / (max - min)));

		const inputs: number[][][] = [];
		const labels: number[][] = [];

		for (let i = 0; i < normalized.length - this.config.windowSize; i++) {
			const window = normalized.slice(i, i + this.config.windowSize);
			inputs.push(window.map((p) => [p]));
			labels.push([normalized[i + this.config.windowSize] ?? 0]);
		}

		return {
			inputs: tf.tensor3d(inputs),
			labels: tf.tensor2d(labels),
			min,
			max,
		};
	}

	/**
	 * Train the LSTM model
	 * @param data - Historical stock data
	 * @param _appConfig - Application configuration
	 * @param onProgress - Progress callback
	 * @returns Final training metrics
	 */
	public async train(data: StockDataPoint[], _appConfig: Config, onProgress?: (epoch: number, loss: number) => void): Promise<PerformanceMetrics> {
		if (data.length < this.config.windowSize + 5) {
			throw new Error(`Insufficient data for training. Need at least ${this.config.windowSize + 5} points.`);
		}

		this.model = this.buildModel();
		const {inputs, labels} = this.preprocessData(data);

		let bestLoss = Number.POSITIVE_INFINITY;
		let patienceCounter = 0;
		const patience = 5;

		const history = await this.model.fit(inputs, labels, {
			epochs: this.config.epochs,
			batchSize: this.config.batchSize,
			validationSplit: 0.1,
			shuffle: true,
			verbose: 0,
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
		});

		const finalLoss = Array.isArray(history.history.loss) ? (history.history.loss.at(-1) as number) : 0;

		this.metadata = {
			version: '1.0.0',
			trainedAt: new Date(),
			dataPoints: data.length,
			loss: finalLoss,
			windowSize: this.config.windowSize,
			metrics: {
				finalLoss,
				validationLoss: (history.history.val_loss?.at(-1) as number) || 0,
				meanAbsoluteError: (history.history.mae?.at(-1) as number) || 0,
			},
			symbol: 'UNKNOWN', // This will be set by the caller or during loading
		};

		// Cleanup tensors
		inputs.dispose();
		labels.dispose();

		return {
			loss: finalLoss,
			accuracy: 1 - finalLoss, // Simplified accuracy for LSTM
			isValid: finalLoss < 1,
			dataPoints: data.length,
			windowSize: this.config.windowSize,
		};
	}

	/**
	 * Evaluate model performance on the dataset
	 * @param data - Dataset to evaluate against
	 * @param _appConfig - Application configuration
	 * @returns Final evaluation metrics
	 */
	public async evaluate(data: StockDataPoint[], _appConfig: Config): Promise<PerformanceMetrics> {
		if (!this.model) {
			throw new Error('Model not trained or loaded');
		}

		const {inputs, labels} = this.preprocessData(data);
		const result = await Promise.resolve(this.model.evaluate(inputs, labels) as tf.Scalar[]);
		const loss = result[0]?.dataSync()[0] ?? 0;

		inputs.dispose();
		labels.dispose();

		return {
			loss,
			accuracy: 1 - loss,
			isValid: loss < 1,
			dataPoints: data.length,
			windowSize: this.config.windowSize,
		};
	}

	/**
	 * Predict future prices
	 * @param data - Historical data context
	 * @param days - Number of days to predict
	 * @returns Predicted prices
	 */
	public async predict(data: StockDataPoint[], days: number): Promise<number[]> {
		if (!this.model) {
			throw new Error('Model not trained or loaded');
		}

		const {inputs, min, max} = this.preprocessData(data);
		const predictions: number[] = [];

		// Start with the last window
		let lastWindow = inputs.slice([inputs.shape[0] - 1, 0, 0], [1, this.config.windowSize, 1]);

		for (let i = 0; i < days; i++) {
			const prediction = this.model.predict(lastWindow) as tf.Tensor2D;
			const dataSync = await Promise.resolve(prediction.dataSync());
			const price = dataSync[0] ?? 0;
			predictions.push(min + price * (max - min));

			// Update window for next prediction
			const newPoint = tf.tensor3d([[[price]]]);
			// eslint-disable-next-line unicorn/prefer-spread
			const nextWindow = tf.concat([lastWindow.slice([0, 1, 0], [1, this.config.windowSize - 1, 1]), newPoint], 1);

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
	 * Get the internal TensorFlow.js model
	 * @returns The model instance
	 */
	public getModel(): null | tf.LayersModel {
		return this.model;
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
	 * Get model metadata
	 * @returns The metadata instance
	 */
	public getMetadata(): ModelMetadata | null {
		return this.metadata;
	}

	/**
	 * Check if model is trained
	 * @returns True if trained
	 */
	public isTrained(): boolean {
		return this.model !== null;
	}
}
