/**
 * Hyperparameter Tuner for LSTM Models
 * Performs Grid Search with Time-Series Cross-Validation to find optimal hyperparameters
 */

import type {Config} from '../config/schema.ts';
import type {MarketFeatures, StockDataPoint} from '../types/index.ts';

import {LstmModel} from './lstm-model.ts';

export type TrialResult = {
	config: Partial<Config['model']>;
	duration: number;
	id: string;
	mape: number;
	params: {
		architecture: string;
		batchSize: number;
		epochs: number;
		learningRate: number;
		windowSize: number;
	};
	valLoss: number;
};

export class HyperparameterTuner {
	private readonly config: Config;

	public constructor(config: Config) {
		this.config = config;
	}

	/**
	 * Run hyperparameter tuning for a specific symbol
	 * @param _symbol - The stock symbol
	 * @param data - Full dataset
	 * @param marketFeatures - Market context features
	 * @param onProgress - Callback for progress reporting
	 */
	public async tune(
		_symbol: string,
		data: StockDataPoint[],
		marketFeatures: MarketFeatures[],
		onProgress?: (completed: number, total: number, bestMape: number) => void,
	): Promise<TrialResult> {
		const grid = this.generateGrid();
		const results: TrialResult[] = [];
		const maxTrials = this.config.tuning.maxTrials;

		// Shuffle and limit grid to maxTrials to avoid infinite runs
		const selectedTrials = this.shuffleArray(grid).slice(0, maxTrials);

		let completed = 0;
		let bestMape = Number.POSITIVE_INFINITY;

		for (const trialParams of selectedTrials) {
			const start = Date.now();

			// Merge trial params into model config
			const trialConfig: Config['model'] = {
				...this.config.model,
				architecture: trialParams.architecture,
				batchSize: trialParams.batchSize,
				epochs: trialParams.epochs,
				learningRate: trialParams.learningRate,
				windowSize: trialParams.windowSize,
			};

			// Perform Time-Series Cross-Validation
			const score = await this.crossValidate(data, trialConfig, marketFeatures);

			const duration = Date.now() - start;

			const result: TrialResult = {
				config: trialConfig,
				duration,
				id: `trial_${completed + 1}`,
				mape: score.mape,
				params: trialParams,
				valLoss: score.loss,
			};

			results.push(result);

			if (result.mape < bestMape) {
				bestMape = result.mape;
			}

			completed++;
			if (onProgress) {
				onProgress(completed, selectedTrials.length, bestMape);
			}
		}

		// Sort by MAPE (ascending)
		results.sort((a, b) => a.mape - b.mape);

		const bestResult = results[0];
		if (!bestResult) {
			throw new Error('Tuning failed to produce any results');
		}

		return bestResult;
	}

	/**
	 * Perform Time-Series Cross-Validation for a single configuration
	 * @param data - Full dataset
	 * @param modelConfig - Configuration for the model
	 * @param marketFeatures - Market context features
	 */
	private async crossValidate(data: StockDataPoint[], modelConfig: Config['model'], marketFeatures: MarketFeatures[]): Promise<{loss: number; mape: number}> {
		const splits = this.config.tuning.validationSplits;
		let totalLoss = 0;
		let totalMape = 0;
		let validSplits = 0;

		// We need at least windowSize + 5 points for training
		const minTrainSize = modelConfig.windowSize + 20;
		if (data.length < minTrainSize * 2) {
			// Dataset too small for CV, fall back to single train/val split
			return this.evaluateSingleSplit(data, modelConfig, marketFeatures);
		}

		// Calculate expanding window step size
		// Reserve 20% for final validation, split the rest for expanding steps
		const stepSize = Math.floor(data.length / (splits + 1));

		for (let i = 1; i <= splits; i++) {
			// Expanding window: Train on [0...trainEnd]
			const trainEnd = stepSize * i;
			// Validate on [trainEnd...valEnd]
			const valEnd = Math.min(data.length, stepSize * (i + 1));

			if (trainEnd < minTrainSize) continue;

			// Prepare data slice for this fold
			const trainData = data.slice(0, trainEnd);

			// For validation, we need context (previous window) + validation data
			const contextStart = trainEnd - modelConfig.windowSize;
			const evalData = data.slice(contextStart, valEnd);

			if (evalData.length < modelConfig.windowSize + 1) continue;

			try {
				const model = new LstmModel(modelConfig, this.config.market.featureConfig);

				// Train on the fold (expanding window)
				await model.train(trainData, this.config, undefined, marketFeatures);

				// Evaluate on the next segment (out of sample)
				const metrics = await model.evaluate(evalData, this.config, marketFeatures);

				if (metrics.isValid) {
					totalLoss += metrics.loss;
					totalMape += metrics.mape;
					validSplits++;
				}

				// Clean up
				model.getModel()?.dispose();
			} catch {
				// Ignore failed folds (convergence issues etc)
				continue;
			}
		}

		if (validSplits === 0) {
			return this.evaluateSingleSplit(data, modelConfig, marketFeatures);
		}

		return {
			loss: totalLoss / validSplits,
			mape: totalMape / validSplits,
		};
	}

	/**
	 * Single split evaluation (fallback and Phase 1 implementation)
	 * Trains on first 90%, validates on last 10%
	 * @param data - Full dataset
	 * @param modelConfig - Model configuration
	 * @param marketFeatures - Market features
	 */
	private async evaluateSingleSplit(
		data: StockDataPoint[],
		modelConfig: Config['model'],
		marketFeatures: MarketFeatures[],
	): Promise<{loss: number; mape: number}> {
		const model = new LstmModel(modelConfig, this.config.market.featureConfig);

		// Train uses internal 90/10 split for early stopping, but we want an external metric
		// LstmModel.train returns the validation metrics from the last epoch
		const metrics = await model.train(data, this.config, undefined, marketFeatures);

		return {
			loss: metrics.loss,
			mape: metrics.mape ?? 1, // Default to high error if undefined
		};
	}

	/**
	 * Generate all combinations of hyperparameters
	 */
	private generateGrid(): {
		architecture: 'lstm' | 'gru' | 'attention-lstm';
		batchSize: number;
		epochs: number;
		learningRate: number;
		windowSize: number;
	}[] {
		const grid = [];
		const {architecture, batchSize, epochs, learningRate, windowSize} = this.config.tuning;

		for (const arch of architecture) {
			for (const batch of batchSize) {
				for (const ep of epochs) {
					for (const lr of learningRate) {
						for (const win of windowSize) {
							grid.push({
								architecture: arch,
								batchSize: batch,
								epochs: ep,
								learningRate: lr,
								windowSize: win,
							});
						}
					}
				}
			}
		}

		return grid;
	}

	/**
	 * Fisher-Yates shuffle
	 * @param array - Array to shuffle
	 */
	private shuffleArray<T>(array: T[]): T[] {
		const newArray = [...array];
		for (let i = newArray.length - 1; i > 0; i--) {
			// eslint-disable-next-line sonarjs/pseudo-random -- Justification: Cryptographic security not required for hyperparameter grid shuffling.
			const j = Math.floor(Math.random() * (i + 1));
			[newArray[i], newArray[j]] = [newArray[j] as T, newArray[i] as T];
		}
		return newArray;
	}
}
