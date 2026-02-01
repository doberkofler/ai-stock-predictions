/**
 * LSTM model implementation using TensorFlow.js
 * Provides neural network capabilities for stock price prediction
 */

import * as tf from '@tensorflow/tfjs';

import {ModelError, ErrorHandler} from '../cli/utils/errors.ts';
import type {StockDataPoint, TrainingResult, MlConfig} from '../types/index.ts';
import type {Config} from '../config/schema.ts';

/**
 * Model metadata
 */
export type ModelMetadata = {
	version: string;
	trainedAt: Date;
	dataPoints: number;
	loss: number;
	windowSize: number;
	metrics: Record<string, number>;
	symbol: string; // Added symbol
};

/**
 * LSTM neural network model for stock prediction
 */
export class LstmModel {
	private model: tf.LayersModel | null = null;
	private metadata: ModelMetadata | null = null;
	private readonly config: MlConfig;

	public constructor(config: MlConfig) {
		this.config = config;
	}

	/**
	 * Create the LSTM model architecture
	 * @returns {tf.LayersModel} Created TensorFlow.js model
	 */
	private createModel(): tf.LayersModel {
		const model = tf.sequential();

		// LSTM layers - define inputShape directly on the first layer
		model.add(
			tf.layers.lstm({
				units: 50,
				returnSequences: true,
				inputShape: [this.config.windowSize, 1],
				dropout: 0.2,
				kernelInitializer: 'glorotUniform', // Avoid Orthogonal initializer warnings
				recurrentInitializer: 'glorotUniform',
			}),
		);

		model.add(
			tf.layers.lstm({
				units: 50,
				returnSequences: false,
				dropout: 0.2,
				kernelInitializer: 'glorotUniform',
				recurrentInitializer: 'glorotUniform',
			}),
		);

		// Output layer - predicting single price point
		model.add(
			tf.layers.dense({
				units: 1,
				activation: 'linear',
			}),
		);

		// Compile model
		model.compile({
			optimizer: tf.train.adam(this.config.learningRate),
			loss: 'meanSquaredError',
			metrics: ['mae', 'mse'],
		});

		return model;
	}

	/**
	 * Train the model with historical stock data
	 * @param {StockDataPoint[]} data - Historical stock data
	 * @param {Config} appConfig - Application configuration
	 * @param {(epoch: number, loss: number) => void} [progressCallback] - Training progress callback
	 * @returns {Promise<void>}
	 */
	public async train(data: StockDataPoint[], appConfig: Config, progressCallback?: (epoch: number, loss: number) => void): Promise<void> {
		const context = {
			operation: 'train-model',
			step: 'data-preprocessing',
		};

		await ErrorHandler.wrapAsync(async () => {
			// Validate input data
			if (data.length < this.config.windowSize + 1) {
				throw new ModelError(`Insufficient data: need at least ${this.config.windowSize + 1} points, got ${data.length}`);
			}

			// Always create a fresh model
			this.model = this.createModel();

			// Preprocess data
			const {trainX, trainY} = this.preprocessData(data);

			// Train the model
			const history = await this.model.fit(trainX, trainY, {
				epochs: this.config.epochs,
				batchSize: this.config.batchSize,
				validationSplit: 1 - appConfig.prediction.trainSplit,
				shuffle: true,
				verbose: 0, // Suppress default TensorFlow console output
				callbacks: {
					onEpochEnd: (epoch: number, logs?: tf.Logs) => {
						const loss = logs?.loss ?? 0;
						progressCallback?.(epoch + 1, loss);
					},
				},
			});

			// Update metadata
			const finalLoss = history.history.loss?.at(-1) as number;
			this.metadata = {
				version: '1.0.0',
				trainedAt: new Date(),
				dataPoints: data.length,
				loss: finalLoss,
				windowSize: this.config.windowSize,
				metrics: {
					finalLoss,
					validationLoss: history.history.val_loss?.at(-1) as number,
					meanAbsoluteError: history.history.mae?.at(-1) as number,
				},
				symbol: appConfig.symbols[0]?.symbol ?? 'UNKNOWN', // Fallback for symbol
			};

			// Clean up tensors
			trainX.dispose();
			trainY.dispose();
		}, context);
	}

	/**
	 * Evaluate model performance
	 * @param {StockDataPoint[]} data - Test data
	 * @param {Config} _appConfig - Application configuration
	 * @returns {Promise<TrainingResult>} Training performance metrics
	 */
	public async evaluate(data: StockDataPoint[], _appConfig: Config): Promise<TrainingResult> {
		const context = {
			operation: 'evaluate-model',
			step: 'model-evaluation',
		};

		return ErrorHandler.wrapAsync(async () => {
			if (!this.model || !this.metadata) {
				throw new ModelError('Model must be trained before evaluation');
			}

			if (data.length < this.config.windowSize + 1) {
				throw new ModelError('Insufficient data for evaluation');
			}

			// Preprocess data
			const {trainX, trainY} = this.preprocessData(data);

			// Evaluate model
			const evaluation = this.model.evaluate(trainX, trainY) as tf.Scalar[];

			const loss = evaluation[0]?.dataSync()[0] ?? 0;
			const mae = evaluation[1]?.dataSync()[0] ?? 0;

			// Calculate accuracy (within 5% threshold)
			const predictions = this.model.predict(trainX) as tf.Tensor;
			const predArray = (await predictions.array()) as number[][];
			const trueArray = (await trainY.array()) as number[][];

			let correctPredictions = 0;
			for (const [index, pred] of predArray.entries()) {
				const predicted = pred[0] ?? 0;
				const actual = trueArray[index]?.[0] ?? 0;
				const error = actual === 0 ? predicted : Math.abs(predicted - actual) / actual;
				if (error < 0.05) correctPredictions++; // Within 5%
			}

			const accuracy = predArray.length > 0 ? correctPredictions / predArray.length : 0;

			// Clean up tensors
			trainX.dispose();
			trainY.dispose();
			predictions.dispose();

			return {
				loss,
				accuracy,
				meanAbsoluteError: mae,
				rootMeanSquaredError: Math.sqrt(loss),
				epochs: this.config.epochs,
				trainingTime: 0,
				isValid: loss < 1 && accuracy > 0.5,
			};
		}, context);
	}

	/**
	 * Generate predictions for future dates
	 * @param {StockDataPoint[]} data - Historical data
	 * @param {Config} appConfig - Application configuration
	 * @returns {Promise<number[]>} Predicted prices for future dates
	 */
	public async predict(data: StockDataPoint[], appConfig: Config): Promise<number[]> {
		const context = {
			operation: 'generate-predictions',
			step: 'model-prediction',
		};

		return ErrorHandler.wrapAsync(async () => {
			if (!this.model || !this.metadata) {
				throw new ModelError('Model must be trained before prediction');
			}

			if (data.length < this.config.windowSize) {
				throw new ModelError('Insufficient data for prediction');
			}

			const predictions: number[] = [];
			const currentData = [...data];

			// Generate predictions for specified number of days
			for (let day = 0; day < appConfig.prediction.days; day++) {
				// Get last windowSize points
				const windowData = currentData.slice(-this.config.windowSize);

				// Preprocess window
				const {minPrice, range} = this.getPriceBounds(windowData);
				const normalizedPrices = windowData.map((d) => (range === 0 ? 0.5 : (d.close - minPrice) / range));
				// Reshape to [1, windowSize, 1]
				const inputTensor = tf.tensor3d([normalizedPrices.map((p) => [p])]);

				// Make prediction
				const prediction = this.model.predict(inputTensor) as tf.Tensor;
				const predArray = (await prediction.array()) as number[][];
				const normalizedPred = predArray[0]?.[0] ?? 0.5;

				// Denormalize and add to predictions
				const denormalized = normalizedPred * range + minPrice;
				predictions.push(denormalized);

				// Add predicted data to current data for next prediction
				const lastDataPoint = windowData.at(-1);
				if (lastDataPoint) {
					currentData.push({
						...lastDataPoint,
						date: new Date(lastDataPoint.date).toISOString().split('T')[0] ?? '',
						close: denormalized,
						adjClose: denormalized,
					});
				}

				// Clean up tensors
				inputTensor.dispose();
				prediction.dispose();
			}

			return predictions;
		}, context);
	}

	/**
	 * Check if model is trained
	 * @returns {boolean} True if model is trained and ready
	 */
	public isTrained(): boolean {
		return this.model !== null && this.metadata !== null;
	}

	/**
	 * Get the underlying TensorFlow model
	 * @returns {tf.LayersModel | null} Underlying model
	 */
	public getModel(): tf.LayersModel | null {
		return this.model;
	}

	/**
	 * Get model metadata
	 * @returns {ModelMetadata | null} Model metadata if trained
	 */
	public getMetadata(): ModelMetadata | null {
		return this.metadata;
	}

	/**
	 * Set model and metadata (used for loading)
	 * @param {tf.LayersModel} model - TensorFlow model
	 * @param {ModelMetadata} metadata - Model metadata
	 */
	public setModel(model: tf.LayersModel, metadata: ModelMetadata): void {
		this.model = model;
		this.metadata = metadata;

		// Re-compile the loaded model to ensure it can be used for further training/evaluation
		this.model.compile({
			optimizer: tf.train.adam(this.config.learningRate),
			loss: 'meanSquaredError',
			metrics: ['mae', 'mse'],
		});
	}

	/**
	 * Preprocess data for training/prediction
	 * @param {StockDataPoint[]} data - Raw stock data
	 * @returns {object} Preprocessed tensors
	 */
	private preprocessData(data: StockDataPoint[]): {trainX: tf.Tensor; trainY: tf.Tensor} {
		const {minPrice, range} = this.getPriceBounds(data);
		const normalizedData = data.map((d) => ({
			price: range === 0 ? 0.5 : (d.close - minPrice) / range,
		}));

		const trainX: number[][][] = [];
		const trainY: number[][] = [];

		for (let i = 0; i <= normalizedData.length - this.config.windowSize - 1; i++) {
			const sequence = normalizedData.slice(i, i + this.config.windowSize);
			const target = normalizedData[i + this.config.windowSize];

			if (target) {
				trainX.push(sequence.map((d) => [d.price]));
				trainY.push([target.price]);
			}
		}

		return {
			trainX: tf.tensor3d(trainX),
			trainY: tf.tensor2d(trainY),
		};
	}

	/**
	 * Get price bounds for normalization
	 * @param {StockDataPoint[]} data - Stock data
	 * @returns {object} min, max and range
	 */
	private getPriceBounds(data: StockDataPoint[]): {minPrice: number; maxPrice: number; range: number} {
		const prices = data.map((d) => d.close);
		const minPrice = Math.min(...prices);
		const maxPrice = Math.max(...prices);
		const range = maxPrice - minPrice;
		return {minPrice, maxPrice, range};
	}
}
