/**
 * Ensemble Model implementation
 * Manages multiple sub-models (LSTM, GRU, Attention-LSTM) and aggregates their predictions
 * to reduce variance and improve accuracy.
 */

import type {Config} from '../config/schema.ts';
import type {MarketFeatures, StockDataPoint} from '../types/index.ts';

import {LstmModel, type ModelMetadata, type PerformanceMetrics} from './lstm-model.ts';

export class EnsembleModel {
	private readonly config: Config;
	private models: LstmModel[] = [];
	private weights: number[] = [];

	public constructor(config: Config) {
		this.config = config;
	}

	/**
	 * Train the ensemble of models
	 * @param data - Historical stock data
	 * @param onProgress - Progress callback
	 * @param marketFeatures - Optional market context features
	 * @returns Aggregated performance metrics
	 */
	public async train(
		data: StockDataPoint[],
		onProgress?: (modelIndex: number, modelName: string, epoch: number, loss: number) => void,
		marketFeatures?: MarketFeatures[],
	): Promise<PerformanceMetrics> {
		this.models = [];
		this.weights = [];

		const architectures = this.config.tuning.architecture; // Use architectures defined in tuning config or defaults
		const metrics: PerformanceMetrics[] = [];

		for (const [index, arch] of architectures.entries()) {
			// Create a config specific for this architecture
			const modelConfig = {
				...this.config.model,
				architecture: arch,
			};

			const model = new LstmModel(modelConfig, this.config.market.featureConfig);

			// Train the individual model
			const metric = await model.train(
				data,
				this.config,
				(epoch, loss) => {
					if (onProgress) {
						onProgress(index + 1, arch, epoch, loss);
					}
				},
				marketFeatures,
			);

			this.models.push(model);
			metrics.push(metric);
		}

		// Calculate weights based on validation loss (inverse weighting)
		// Lower loss = higher weight
		const losses = metrics.map((m) => m.loss);
		const sumInverseLoss = losses.reduce((sum, loss) => sum + 1 / Math.max(loss, 1e-6), 0);

		this.weights = losses.map((loss) => 1 / Math.max(loss, 1e-6) / sumInverseLoss);

		// Return average metrics
		const avgLoss = metrics.reduce((sum, m) => sum + m.loss, 0) / metrics.length;
		const avgMape = metrics.reduce((sum, m) => sum + (m.mape ?? 0), 0) / metrics.length;

		return {
			accuracy: 1 - avgLoss,
			dataPoints: data.length,
			isValid: avgLoss < 1,
			loss: avgLoss,
			mape: avgMape,
			windowSize: this.config.model.windowSize,
		};
	}

	/**
	 * Predict future prices using the ensemble
	 * @param data - Historical data context
	 * @param days - Number of days to predict
	 * @param marketFeatures - Optional market context features
	 * @param options - Prediction options
	 * @param options.training - Whether to enable dropout during prediction (Monte Carlo Dropout)
	 * @returns Aggregated predicted prices
	 */
	public async predict(data: StockDataPoint[], days: number, marketFeatures?: MarketFeatures[], options: {training?: boolean} = {}): Promise<number[]> {
		if (this.models.length === 0) {
			throw new Error('Ensemble not trained or loaded');
		}

		const allPredictions: number[][] = [];

		// Gather predictions from all models
		for (const model of this.models) {
			allPredictions.push(await model.predict(data, days, marketFeatures, options));
		}

		// Weighted average of predictions
		const aggregatedPredictions: number[] = [];
		for (let day = 0; day < days; day++) {
			let weightedSum = 0;
			for (const [i, predictions] of allPredictions.entries()) {
				weightedSum += (predictions[day] ?? 0) * (this.weights[i] ?? 1 / this.models.length);
			}
			aggregatedPredictions.push(weightedSum);
		}

		return aggregatedPredictions;
	}

	/**
	 * Get metadata for the ensemble (returns the best model's metadata with ensemble info)
	 */
	public getMetadata(): ModelMetadata | null {
		if (this.models.length === 0) {
			return null;
		}

		// Find the best model based on weight (highest weight = lowest loss)
		const bestIndex = this.weights.indexOf(Math.max(...this.weights));
		const bestModel = this.models[bestIndex];
		const bestMetadata = bestModel?.getMetadata();

		if (!bestMetadata) return null;

		return {
			...bestMetadata,
			modelArchitecture: 'ensemble' as 'lstm' | 'gru' | 'attention-lstm',
		};
	}

	/**
	 * Check if ensemble is trained
	 */
	public isTrained(): boolean {
		return this.models.length > 0 && this.models.every((m) => m.isTrained());
	}

	/**
	 * Get the internal models
	 */
	public getModels(): LstmModel[] {
		return this.models;
	}

	/**
	 * Get the calculated weights
	 */
	public getWeights(): number[] {
		return this.weights;
	}
}
