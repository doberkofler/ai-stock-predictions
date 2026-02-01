/**
 * Model persistence utilities for saving and loading TensorFlow.js models
 * Provides model versioning and metadata management
 */

import * as tf from '@tensorflow/tfjs';
import {ensureDir} from 'fs-extra';
import {writeFile, readFile, existsSync} from 'node:fs';
import {promisify} from 'node:util';
import {join} from 'node:path';

import {ModelError, ErrorHandler} from '../cli/utils/errors.ts';
import {LstmModel} from './lstm-model.ts';
import type {ModelMetadata} from './lstm-model.ts';
import type {TrainingResult} from '../types/index.ts';
import type {Config} from '../config/schema.ts';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

/**
 * Model persistence class for TensorFlow.js models
 */
export class ModelPersistence {
	private readonly modelsPath: string;

	public constructor(modelsPath: string) {
		this.modelsPath = modelsPath;
	}

	/**
	 * Save a model with metadata
	 * @param {string} symbol - Stock symbol
	 * @param {LstmModel} model - Trained model instance
	 * @param {TrainingResult & {dataPoints: number; modelType: string; windowSize: number}} _performance - Model performance metrics
	 * @returns {Promise<void>}
	 */
	public async saveModel(
		symbol: string,
		model: LstmModel,
		_performance: TrainingResult & {dataPoints: number; modelType: string; windowSize: number},
	): Promise<void> {
		const context = {
			operation: 'save-model',
			symbol,
			step: 'model-serialization',
		};

		await ErrorHandler.wrapAsync(async () => {
			const metadata = model.getMetadata();
			if (!metadata) {
				throw new ModelError('Cannot save untrained model', symbol);
			}

			// Ensure models directory exists
			await ensureDir(this.modelsPath);

			// Create model directory
			const modelDir = join(this.modelsPath, symbol);
			await ensureDir(modelDir);

			// Save model
			const tfModel = model.getModel();
			if (!tfModel) {
				throw new ModelError('Underlying TensorFlow model is missing', symbol);
			}
			// In tfjs-node, the 'file://' scheme for save() expects a DIRECTORY path.
			// It will create model.json and weights.bin inside that directory.
			const modelPath = `file://${modelDir}`;
			await tfModel.save(modelPath);

			const metadataPath = join(modelDir, 'metadata.json');
			await writeFileAsync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
		}, context);
	}

	/**
	 * Load a model with metadata
	 * @param {string} symbol - Stock symbol
	 * @param {Config} appConfig - Application configuration
	 * @returns {Promise<LstmModel | null>} Loaded model or null if not found
	 */
	public async loadModel(symbol: string, appConfig: Config): Promise<LstmModel | null> {
		const context = {
			operation: 'load-model',
			symbol,
			step: 'model-deserialization',
		};

		return ErrorHandler.wrapAsync(async () => {
			const modelPath = `file://${join(this.modelsPath, symbol, 'model.json')}`;
			const metadataPath = join(this.modelsPath, symbol, 'metadata.json');

			if (!existsSync(metadataPath)) {
				return null;
			}

			try {
				// Load model
				const tfModel = await tf.loadLayersModel(modelPath);

				// Load metadata
				const metadataData = await readFileAsync(metadataPath, 'utf8');
				const metadata = JSON.parse(metadataData) as ModelMetadata;

				// Reconstruct Date object
				if (typeof metadata.trainedAt === 'string') {
					metadata.trainedAt = new Date(metadata.trainedAt);
				}

				const model = new LstmModel(appConfig.ml);
				model.setModel(tfModel, metadata);

				return model;
			} catch (error) {
				throw new ModelError(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`, symbol);
			}
		}, context);
	}

	/**
	 * Check if model exists for symbol
	 * @param {string} symbol - Stock symbol
	 * @returns {boolean} True if model exists
	 */
	public modelExists(symbol: string): boolean {
		const metadataPath = join(this.modelsPath, symbol, 'metadata.json');
		return existsSync(metadataPath);
	}

	/**
	 * Get model metadata
	 * @param {string} symbol - Stock symbol
	 * @returns {Promise<ModelMetadata | null>} Model metadata or null if not found
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
				const metadataData = await readFileAsync(metadataPath, 'utf8');
				const metadata = JSON.parse(metadataData) as ModelMetadata;
				if (typeof metadata.trainedAt === 'string') {
					metadata.trainedAt = new Date(metadata.trainedAt);
				}
				return metadata;
			} catch (error) {
				throw new ModelError(`Failed to load model metadata: ${error instanceof Error ? error.message : String(error)}`, symbol);
			}
		}, context);
	}
}
