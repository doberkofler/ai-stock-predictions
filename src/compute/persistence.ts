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
import {EnsembleModel} from './ensemble.ts';
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
	 * Delete all models in the models directory
	 */
	public async deleteAllModels(): Promise<void> {
		await FsUtils.recreateDir(this.modelsPath);
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
	 * Get model metadata for a symbol
	 * @param symbol - Stock symbol
	 * @returns Model metadata or null if not found
	 */
	public async getModelMetadata(symbol: string): Promise<ModelMetadata | null> {
		const modelDir = join(this.modelsPath, symbol);

		// Check for ensemble metadata first
		const ensemblePath = join(modelDir, 'ensemble.json');
		if (FsUtils.exists(ensemblePath)) {
			try {
				// We don't need the content here, just checking existence effectively
				await FsUtils.readJson(ensemblePath);

				// Return metadata of the best model (which is usually stored in metadata.json of the main dir or we construct it)
				// For now, let's assume if it's an ensemble, we look for a generic metadata.json which might be the average stats
				const metadataPath = join(modelDir, 'metadata.json');
				if (FsUtils.exists(metadataPath)) {
					const metadataRaw = await FsUtils.readJson(metadataPath);
					const metadataValidated = ModelMetadataSchema.parse(metadataRaw);
					return {
						...metadataValidated,
						trainedAt: new Date(metadataValidated.trainedAt),
						modelArchitecture: 'ensemble' as 'lstm' | 'gru' | 'attention-lstm',
					};
				}
			} catch {
				// Fallback to standard check
			}
		}

		const metadataPath = join(modelDir, 'metadata.json');

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
	 * Load model and metadata from filesystem
	 * @param symbol - Stock symbol
	 * @param appConfig - Application configuration
	 * @returns LSTM model or Ensemble model instance or null if not found
	 */
	public async loadModel(symbol: string, appConfig: Config): Promise<LstmModel | EnsembleModel | null> {
		const modelDir = join(this.modelsPath, symbol);

		// 1. Check if it's an ensemble
		const ensemblePath = join(modelDir, 'ensemble.json');
		if (FsUtils.exists(ensemblePath)) {
			return this.loadEnsemble(symbol, appConfig);
		}

		// 2. Fallback to single model loading
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

			const model = new LstmModel(appConfig.model, metadata.featureConfig);
			model.setModel(tfModel, metadata);

			return model;
		} catch (error) {
			throw new ModelError(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`, symbol);
		}
	}

	/**
	 * Load an ensemble model
	 * @param symbol - Stock symbol
	 * @param appConfig - Application configuration
	 * @returns Loaded ensemble model
	 */
	private async loadEnsemble(symbol: string, appConfig: Config): Promise<EnsembleModel> {
		const modelDir = join(this.modelsPath, symbol);
		const ensemblePath = join(modelDir, 'ensemble.json');
		const ensembleDataRaw = await FsUtils.readJson(ensemblePath);
		const ensembleData = ensembleDataRaw as {architectures: string[]; timestamp: string; weights?: number[]};

		const ensemble = new EnsembleModel(appConfig);
		// We need to access private properties or add public methods to set models.
		// For now, let's assume we populate it by manually loading sub-models.

		// But wait, EnsembleModel doesn't have a public "addModel" method.
		// I should create a "load" method on EnsembleModel or allow setting models.
		// The cleanest way is to just construct it and populate it via a new method or "reflection".

		// Actually, I'll update EnsembleModel to allow setting models/weights, or use a helper.
		// For now, I'll assume I can't easily access private props, so I'll add a public method to EnsembleModel.

		const models: LstmModel[] = [];
		const weights: number[] = ensembleData.weights ?? [];

		for (const arch of ensembleData.architectures) {
			const subModelPath = join(modelDir, arch);
			const metadataPath = join(subModelPath, 'metadata.json');
			const modelPath = join(subModelPath, 'model.json');

			if (FsUtils.exists(metadataPath) && FsUtils.exists(modelPath)) {
				const metadataRaw = await FsUtils.readJson(metadataPath);
				const metadata = ModelMetadataSchema.parse(metadataRaw);

				const tfModel = await tf.loadLayersModel(`file://${modelPath}`);
				tfModel.compile({
					loss: 'meanSquaredError',
					metrics: ['mae'],
					optimizer: tf.train.adam(appConfig.model.learningRate),
				});

				const model = new LstmModel(appConfig.model, metadata.featureConfig);
				model.setModel(tfModel, {
					...metadata,
					trainedAt: new Date(metadata.trainedAt),
				});
				models.push(model);
			}
		}

		// Inject models into ensemble (using a temporary any cast if needed or adding a method)
		// @ts-expect-error -- Accessing private for hydration
		ensemble.models = models;
		// @ts-expect-error -- Accessing private for hydration
		ensemble.weights = weights;

		return ensemble;
	}

	/**
	 * Check if a model exists for a symbol
	 * @param symbol - Stock symbol
	 * @returns True if model exists
	 */
	public modelExists(symbol: string): boolean {
		const modelDir = join(this.modelsPath, symbol);
		// Check for single model OR ensemble
		return (FsUtils.exists(join(modelDir, 'metadata.json')) && FsUtils.exists(join(modelDir, 'model.json'))) || FsUtils.exists(join(modelDir, 'ensemble.json'));
	}

	/**
	 * Save model and metadata to filesystem
	 * @param symbol - Stock symbol
	 * @param model - LSTM model instance or Ensemble
	 * @param metrics - Training performance metrics
	 */
	public async saveModel(symbol: string, model: LstmModel | EnsembleModel, metrics: PerformanceMetrics): Promise<void> {
		const modelDir = join(this.modelsPath, symbol);
		await FsUtils.ensureDir(modelDir);

		if (model instanceof EnsembleModel) {
			await this.saveEnsemble(symbol, model, metrics);
			return;
		}

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
			mape: metrics.mape,
			symbol,
			trainedAt: new Date(),
		};

		await FsUtils.writeJson(join(modelDir, 'metadata.json'), fullMetadata);

		// Cleanup any ensemble file if we overwrote with a single model
		const ensemblePath = join(modelDir, 'ensemble.json');
		if (FsUtils.exists(ensemblePath)) {
			await FsUtils.deletePath(ensemblePath);
		}
	}

	/**
	 * Save ensemble model
	 * @param symbol - Stock symbol
	 * @param ensemble - Ensemble model to save
	 * @param metrics - Performance metrics
	 */
	private async saveEnsemble(symbol: string, ensemble: EnsembleModel, metrics: PerformanceMetrics): Promise<void> {
		const modelDir = join(this.modelsPath, symbol);
		await FsUtils.ensureDir(modelDir);

		const models = ensemble.getModels();
		const weights = ensemble.getWeights();
		const architectures: string[] = [];

		for (const model of models) {
			const meta = model.getMetadata();
			if (!meta?.modelArchitecture) continue;

			const arch = meta.modelArchitecture;
			architectures.push(arch);

			const subDir = join(modelDir, arch);
			await FsUtils.ensureDir(subDir);

			const tfModel = model.getModel();
			if (tfModel) {
				await tfModel.save(`file://${subDir}`);
				const fullMeta = {
					...meta,
					trainedAt: new Date(),
				};
				await FsUtils.writeJson(join(subDir, 'metadata.json'), fullMeta);
			}
		}

		// Save ensemble metadata
		await FsUtils.writeJson(join(modelDir, 'ensemble.json'), {
			architectures,
			weights,
			timestamp: new Date().toISOString(),
		});

		// Save aggregate metadata to main dir for easy reporting
		await FsUtils.writeJson(join(modelDir, 'metadata.json'), {
			dataPoints: metrics.dataPoints,
			loss: metrics.loss,
			mape: metrics.mape,
			metrics: {
				finalLoss: metrics.loss,
				meanAbsoluteError: metrics.accuracy, // Approx
			},
			modelArchitecture: 'ensemble',
			symbol,
			trainedAt: new Date(),
			version: '2.0.0',
			windowSize: metrics.windowSize,
		});

		// Cleanup main model.json if it exists (to avoid confusion)
		const mainModelPath = join(modelDir, 'model.json');
		if (FsUtils.exists(mainModelPath)) {
			await FsUtils.deletePath(mainModelPath);
		}
	}
}
