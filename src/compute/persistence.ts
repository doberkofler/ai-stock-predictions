/**
 * Model persistence service
 * Handles saving and loading TensorFlow.js models and metadata to/from the filesystem
 */

import * as tf from '@tensorflow/tfjs';
import {ensureDir, remove} from 'fs-extra';
import {writeFile, readFile, existsSync} from 'node:fs';
import {join} from 'node:path';
import {promisify} from 'node:util';

import {ModelError, ErrorHandler} from '../cli/utils/errors.ts';
import {LstmModel} from './lstm-model.ts';
import {ModelMetadataSchema} from '../gather/storage.ts';
import type {ModelMetadata, PerformanceMetrics} from './lstm-model.ts';
import type {Config} from '../config/schema.ts';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

/**
 * Model persistence service class
 */
export class ModelPersistence {
	private readonly modelsPath: string;

	public constructor(modelsPath: string) {
		this.modelsPath = modelsPath;
	}

	/**
	 * Save model and metadata to filesystem
	 * @param symbol - Stock symbol
	 * @param model - LSTM model instance
	 * @param metrics - Training performance metrics
	 * @returns
	 */
	public async saveModel(symbol: string, model: LstmModel, metrics: PerformanceMetrics): Promise<void> {
		const context = {
			operation: 'save-model',
			symbol,
			step: 'directory-creation',
		};

		await ErrorHandler.wrapAsync(async () => {
			const modelDir = join(this.modelsPath, symbol);
			await ensureDir(modelDir);

			// Save TensorFlow model
			const tfModel = model.getModel();
			if (!tfModel) {
				throw new ModelError('Model not initialized', symbol);
			}

			context.step = 'model-serialization';
			await tfModel.save(`file://${modelDir}`);

			// Save metadata
			context.step = 'metadata-serialization';
			const metadata = model.getMetadata();
			if (!metadata) {
				throw new ModelError('Model metadata not available', symbol);
			}

			const fullMetadata: ModelMetadata = {
				...metadata,
				...metrics,
				trainedAt: new Date(),
				symbol,
			};

			await writeFileAsync(join(modelDir, 'metadata.json'), JSON.stringify(fullMetadata, null, 2));
		}, context);
	}

	/**
	 * Load model and metadata from filesystem
	 * @param symbol - Stock symbol
	 * @param appConfig - Application configuration
	 * @returns LSTM model instance or null if not found
	 */
	public async loadModel(symbol: string, appConfig: Config): Promise<LstmModel | null> {
		const context = {
			operation: 'load-model',
			symbol,
			step: 'file-check',
		};

		return ErrorHandler.wrapAsync(async () => {
			const modelDir = join(this.modelsPath, symbol);
			const metadataPath = join(modelDir, 'metadata.json');
			const modelPath = join(modelDir, 'model.json');

			if (!existsSync(metadataPath) || !existsSync(modelPath)) {
				return null;
			}

			// Load metadata first to verify version and configuration
			context.step = 'metadata-deserialization';
			const metadataRaw = await readFileAsync(metadataPath, 'utf8');
			const metadataValidated = ModelMetadataSchema.parse(JSON.parse(metadataRaw));

			const metadata: ModelMetadata = {
				...metadataValidated,
				trainedAt: new Date(metadataValidated.trainedAt),
			};

			// Load TensorFlow model
			context.step = 'model-deserialization';
			try {
				const tfModel = await tf.loadLayersModel(`file://${modelPath}`);

				// Re-compile model with current configuration
				tfModel.compile({
					optimizer: tf.train.adam(appConfig.model.learningRate),
					loss: 'meanSquaredError',
					metrics: ['mae'],
				});

				const model = new LstmModel(appConfig.model);
				model.setModel(tfModel, metadata);

				return model;
			} catch (error) {
				throw new ModelError(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`, symbol);
			}
		}, context);
	}

	/**
	 * Check if a model exists for a symbol
	 * @param symbol - Stock symbol
	 * @returns True if model exists
	 */
	public modelExists(symbol: string): boolean {
		const metadataPath = join(this.modelsPath, symbol, 'metadata.json');
		const modelPath = join(this.modelsPath, symbol, 'model.json');
		return existsSync(metadataPath) && existsSync(modelPath);
	}

	/**
	 * Get model metadata for a symbol
	 * @param symbol - Stock symbol
	 * @returns Model metadata or null if not found
	 */
	public async getModelMetadata(symbol: string): Promise<ModelMetadata | null> {
		const context = {
			operation: 'get-model-metadata',
			symbol,
			step: 'metadata-read',
		};

		return ErrorHandler.wrapAsync(async () => {
			const metadataPath = join(this.modelsPath, symbol, 'metadata.json');

			if (!existsSync(metadataPath)) {
				return null;
			}

			try {
				const metadataRaw = await readFileAsync(metadataPath, 'utf8');
				const metadataValidated = ModelMetadataSchema.parse(JSON.parse(metadataRaw));

				const metadata: ModelMetadata = {
					...metadataValidated,
					trainedAt: new Date(metadataValidated.trainedAt),
				};

				return metadata;
			} catch (error) {
				throw new ModelError(`Failed to load model metadata: ${error instanceof Error ? error.message : String(error)}`, symbol);
			}
		}, context);
	}

	/**
	 * Delete a model for a symbol
	 * @param symbol - Stock symbol
	 * @returns
	 */
	public async deleteModel(symbol: string): Promise<void> {
		const context = {
			operation: 'delete-model',
			symbol,
			step: 'model-deletion',
		};

		await ErrorHandler.wrapAsync(async () => {
			const modelDir = join(this.modelsPath, symbol);
			if (existsSync(modelDir)) {
				await remove(modelDir);
			}
		}, context);
	}

	/**
	 * Delete all models in the models directory
	 * @returns
	 */
	public async deleteAllModels(): Promise<void> {
		const context = {
			operation: 'delete-all-models',
			step: 'directory-deletion',
		};

		await ErrorHandler.wrapAsync(async () => {
			if (existsSync(this.modelsPath)) {
				await remove(this.modelsPath);
				await ensureDir(this.modelsPath);
			}
		}, context);
	}
}
