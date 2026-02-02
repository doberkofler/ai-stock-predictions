/**
 * Model persistence service
 * Handles saving and loading TensorFlow.js models and metadata to/from the filesystem
 */

import * as tf from '@tensorflow/tfjs';
import {join} from 'node:path';

import type {Config} from '../config/schema.ts';
import type {ModelMetadata, PerformanceMetrics} from './lstm-model.ts';

import {ModelError} from '../cli/utils/errors.ts';
import {FsUtils} from '../cli/utils/fs.ts';
import {ModelMetadataSchema} from '../gather/storage.ts';
import {LstmModel} from './lstm-model.ts';

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
	 */
	public async saveModel(symbol: string, model: LstmModel, metrics: PerformanceMetrics): Promise<void> {
		const modelDir = join(this.modelsPath, symbol);
		await FsUtils.ensureDir(modelDir);

		// Save TensorFlow model
		const tfModel = model.getModel();
		if (!tfModel) {
			throw new ModelError('Model not initialized', symbol);
		}

		await tfModel.save(`file://${modelDir}`);

		// Save metadata
		const metadata = model.getMetadata();
		if (!metadata) {
			throw new ModelError('Model metadata not available', symbol);
		}

		const fullMetadata: ModelMetadata = {
			...metadata,
			...metrics,
			symbol,
			trainedAt: new Date(),
		};

		await FsUtils.writeJson(join(modelDir, 'metadata.json'), fullMetadata);
	}

	/**
	 * Load model and metadata from filesystem
	 * @param symbol - Stock symbol
	 * @param appConfig - Application configuration
	 * @returns LSTM model instance or null if not found
	 */
	public async loadModel(symbol: string, appConfig: Config): Promise<LstmModel | null> {
		const modelDir = join(this.modelsPath, symbol);
		const metadataPath = join(modelDir, 'metadata.json');
		const modelPath = join(modelDir, 'model.json');

		if (!FsUtils.exists(metadataPath) || !FsUtils.exists(modelPath)) {
			return null;
		}

		// Load metadata first to verify version and configuration
		const metadataRaw = await FsUtils.readJson(metadataPath);
		const metadataValidated = ModelMetadataSchema.parse(metadataRaw);

		const metadata: ModelMetadata = {
			...metadataValidated,
			trainedAt: new Date(metadataValidated.trainedAt),
		};

		// Load TensorFlow model
		try {
			const tfModel = await tf.loadLayersModel(`file://${modelPath}`);

			// Re-compile model with current configuration
			tfModel.compile({
				loss: 'meanSquaredError',
				metrics: ['mae'],
				optimizer: tf.train.adam(appConfig.model.learningRate),
			});

			const model = new LstmModel(appConfig.model);
			model.setModel(tfModel, metadata);

			return model;
		} catch (error) {
			throw new ModelError(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`, symbol);
		}
	}

	/**
	 * Check if a model exists for a symbol
	 * @param symbol - Stock symbol
	 * @returns True if model exists
	 */
	public modelExists(symbol: string): boolean {
		const metadataPath = join(this.modelsPath, symbol, 'metadata.json');
		const modelPath = join(this.modelsPath, symbol, 'model.json');
		return FsUtils.exists(metadataPath) && FsUtils.exists(modelPath);
	}

	/**
	 * Get model metadata for a symbol
	 * @param symbol - Stock symbol
	 * @returns Model metadata or null if not found
	 */
	public async getModelMetadata(symbol: string): Promise<ModelMetadata | null> {
		const metadataPath = join(this.modelsPath, symbol, 'metadata.json');

		if (!FsUtils.exists(metadataPath)) {
			return null;
		}

		try {
			const metadataRaw = await FsUtils.readJson(metadataPath);
			const metadataValidated = ModelMetadataSchema.parse(metadataRaw);

			return {
				...metadataValidated,
				trainedAt: new Date(metadataValidated.trainedAt),
			};
		} catch (error) {
			throw new ModelError(`Failed to load model metadata: ${error instanceof Error ? error.message : String(error)}`, symbol);
		}
	}

	/**
	 * Delete a model for a symbol
	 * @param symbol - Stock symbol
	 */
	public async deleteModel(symbol: string): Promise<void> {
		const modelDir = join(this.modelsPath, symbol);
		await FsUtils.deletePath(modelDir);
	}

	/**
	 * Delete all models in the models directory
	 */
	public async deleteAllModels(): Promise<void> {
		await FsUtils.recreateDir(this.modelsPath);
	}
}
