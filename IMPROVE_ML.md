# AI Stock Predictions - ML Enhancement Proposals

This document contains prioritized proposals for improving the machine learning capabilities of the AI Stock Predictions system.

**Last Updated:** 2026-02-04  
**Document Version:** 1.1

## 📋 Document Update Conventions

When completing an enhancement proposal:

1. **Update Status Markers**: Change `**Status:** Not Started` to `**Status:** ✅ Completed (YYYY-MM-DD)`
2. **Condense Implementation**: Replace detailed implementation plans with:
   - Brief summary of what was implemented
   - Impact/benefits achieved
   - Breaking changes (if any)
   - Reference to code location
3. **Update Priority Matrix**: Strike through completed items, mark with ✅ Complete
4. **Update Phase Status**: Mark items as completed in the Implementation Sequence section
5. **Update Success Metrics**: Check off completed criteria
6. **Update Executive Summary**: Add completion note with key achievements
7. **Increment Document Version**: Minor version for phase completions (e.g., 1.0 → 1.1)
8. **Update Date**: Set "Last Updated" to completion date

**Philosophy**: Focus on current state, not historical migration notes. Completed items should be condensed to reference documentation, not detailed how-to guides.

---

## Executive Summary

### Key Findings:
- ⚠️ Market features are frozen during recursive prediction (HIGH PRIORITY)
- 🎯 Window normalization and log-return training are the most impactful improvements

### ✅ Phase 1 Complete (2026-02-04):
- **#1 Window-Based Normalization**: Per-window z-score normalization eliminates data leakage
- **#2 Log-Return Training**: Model trains on stationary log returns instead of absolute prices
- **#14 Market Feature Prediction**: Exponential decay prevents frozen market conditions
- **Breaking Change**: Model version 2.0.0 - all existing models require retraining
- **Test Coverage**: 94%+ (177 tests passing)
- **Next Step**: Retrain all models and measure MAPE improvement vs baseline

---

## 📊 ENHANCEMENT PROPOSALS

### 1. Window-Based Normalization (Data Leakage Fix) ✅

**Status:** Completed (2026-02-04)

**Impact:** Eliminates data leakage, improves model validity across different volatility regimes.

---

### 2. Log-Return Training (Stationarity) ✅

**Status:** Completed (2026-02-04)

**Impact:** Improved statistical validity, better performance across bull/bear markets.

---

### 3. Linear Interpolation for Missing Data

**Current:** Yahoo Finance API may return gaps or null values; currently filtered out completely

**Problem:**
- Missing trading days (holidays, weekends handled, but API gaps cause data loss)
- Data rejection reduces available training samples
- Inconsistent sequence lengths break LSTM windowing
- No metrics on data completeness

**Fix:**
```typescript
class DataQualityPipeline {
    interpolateGaps(data: StockDataPoint[]): {
        data: StockDataPoint[];
        interpolatedCount: number;
        qualityScore: number;
    } {
        // Linear interpolation for gaps ≤ 3 days
        // Forward-fill for very recent missing data
        // Track percentage interpolated
        // Reject symbols with >10% interpolated data
    }
}
```

**Importance:** MEDIUM - Improves data completeness and training stability

**Complexity:** Low (2-3 hours)
- Create `DataQualityPipeline` utility class
- Add gap detection and interpolation logic
- Update storage layer to mark interpolated points
- Add data quality metrics to HTML reports
- Add validation tests

**ETA:** 0.5 days

**Status:** Not Started

**References:**
- `src/gather/yahoo-finance.ts:189-224` (quote processing)
- `src/gather/storage.ts` (data persistence)

---

### 4. Multi-Source Fallback (Resilience)

**Current:** Single data source (Yahoo Finance only)

**Problem:**
- API throttling causes complete failures during bulk sync
- Service outages block all data gathering operations
- No redundancy for data validation/cross-checking
- Single point of failure

**Fix:**
```typescript
// Add Alpha Vantage as secondary source
abstract class DataSourceProvider {
    abstract getHistoricalData(symbol: string, startDate: Date): Promise<StockDataPoint[]>;
}

class DataSourceFallbackChain {
    async fetch(symbol: string): Promise<StockDataPoint[]> {
        try {
            return await yahooFinanceSource.fetch(symbol);
        } catch (error) {
            logger.warn(`Yahoo Finance failed, trying Alpha Vantage`);
            return await alphaVantageSource.fetch(symbol);
        }
    }
}
```

**Importance:** MEDIUM - Increases reliability but adds complexity and maintenance burden

**Complexity:** High (8-10 hours)
- Create abstraction layer for data sources
- Implement Alpha Vantage client with Zod validation
- Add source selection and fallback logic
- Update configuration schema with `dataSource.provider` and `dataSource.fallbackProvider`
- Extensive error handling and testing
- Document API key requirements

**ETA:** 1.5 days

**Status:** Not Started

**References:**
- `src/gather/yahoo-finance.ts` (current implementation)
- `src/config/schema.ts:36-42` (data source config)
- Alpha Vantage API: https://www.alphavantage.co/documentation/
- Free tier: 500 calls/day

---

### 5. Hyperparameter Optimization

**Current:** Fixed hyperparameters defined in config (windowSize=30, epochs=50, learningRate=0.001, batchSize=128)

**Problem:**
- One-size-fits-all approach may be suboptimal for different stocks
- High-volatility stocks (e.g., TSLA) may need different windows than stable dividend stocks
- No systematic exploration of hyperparameter space
- Manual tuning is time-consuming and non-reproducible

**Fix:**

**Phase 1 (Quick Win - Grid Search):**
```typescript
class HyperparameterTuner {
    async gridSearch(symbol: string, data: StockDataPoint[]): Promise<BestConfig> {
        const searchSpace = {
            windowSize: [20, 30, 60],
            learningRate: [0.0005, 0.001, 0.002],
            batchSize: [64, 128, 256]
        };
        // Time-series cross-validation
        // Return best config based on validation MAPE
    }
}
```

**Phase 2 (Advanced - Bayesian Optimization):**
- Use TensorFlow.js with custom Bayesian implementation
- Explore continuous hyperparameter space efficiently
- 20-30 trials vs 27 trials in grid search

**CLI Integration:**
```bash
node src/index.ts tune AAPL --trials=20 --cv-folds=3
node src/index.ts tune --all --quick  # Quick tune for all symbols
```

**Importance:** MEDIUM - Improves performance but requires significant compute time (2-4x longer training)

**Complexity:** High (10-12 hours for Phase 1, 20+ hours for Phase 2)
- Create hyperparameter search framework
- Implement time-series cross-validation scoring
- Add parallel execution support (multiple workers)
- Save best config per symbol in model metadata
- Add `tune` command with progress tracking
- Extensive testing and documentation

**ETA:** Phase 1: 2 days, Phase 2: 3-4 days

**Status:** Not Started

**References:**
- `src/config/schema.ts:45-52` (model config)
- `src/compute/lstm-model.ts:200-291` (training method)
- Add new command: `src/cli/commands/tune.ts`

---

### 6. Alternative Model Architectures

**Current:** Fixed 2-layer LSTM (64 units each, 0.2 dropout)

**Problem:**
- Single architecture may not be optimal for all stocks
- No exploration of modern alternatives (GRU, Attention, CNN-LSTM)
- Limited architectural diversity for ensembles
- LSTMs are computationally expensive

**Fix:**

**Add configurable architecture selection:**

```typescript
// config.jsonc
{
    "model": {
        "architecture": "lstm",  // "lstm" | "gru" | "conv-lstm" | "attention-lstm"
        // ... other params
    }
}
```

**Architectures to implement:**

1. **GRU (Gated Recurrent Unit):**
   - Faster training (fewer parameters than LSTM)
   - Good for smaller datasets
   - Often performs similarly to LSTM

2. **Bidirectional LSTM:**
   - Access to past AND future context
   - Good for smoothing historical analysis
   - Not suitable for true forecasting but useful for feature extraction

3. **1D Conv + LSTM:**
   - Conv layer captures short-term patterns (3-5 day cycles)
   - LSTM captures long-term dependencies
   - Often better for noisy financial data

4. **Attention-LSTM:**
   - Self-attention layer after LSTM
   - Focuses on critical time steps
   - Better interpretability (can visualize attention weights)

**Implementation:**
```typescript
class ModelArchitectureFactory {
    static build(type: string, config: ModelConfig): tf.LayersModel {
        switch(type) {
            case 'gru': return this.buildGRU(config);
            case 'conv-lstm': return this.buildConvLSTM(config);
            case 'attention-lstm': return this.buildAttentionLSTM(config);
            default: return this.buildLSTM(config);
        }
    }
}
```

**Importance:** MEDIUM - Potential for better performance but adds maintenance burden

**Complexity:** High (12-15 hours)
- Implement 4 architecture variants
- Update config schema and validation
- Create architecture factory pattern
- Benchmark each architecture (accuracy, speed, memory)
- Document trade-offs and use cases
- Add comprehensive tests

**ETA:** 2-3 days

**Status:** Not Started

**References:**
- `src/compute/lstm-model.ts:345-404` (current buildModel)
- `src/config/schema.ts:45-52` (model config)
- TensorFlow.js docs: https://js.tensorflow.org/api/latest/

---

### 7. Ensemble Methods

**Current:** Single model per symbol

**Problem:**
- Single-model predictions prone to overfitting on specific patterns
- No diversity in predictions
- Confidence estimates less reliable (single point of failure)
- Cannot capture different market regimes with one model

**Fix:**

**Three ensemble strategies:**

**Strategy 1 - Bagging (Bootstrap Aggregating):**
```typescript
// Train 3-5 models with different random seeds
const models = await Promise.all([
    trainModel(data, {seed: 1}),
    trainModel(data, {seed: 2}),
    trainModel(data, {seed: 3})
]);

// Average predictions
const prediction = models.reduce((sum, m) => sum + m.predict(), 0) / models.length;
```

**Strategy 2 - Architecture Ensemble:**
```typescript
// Combine LSTM + GRU + Conv-LSTM
const lstmPred = lstmModel.predict(data);
const gruPred = gruModel.predict(data);
const convPred = convModel.predict(data);

// Weighted average based on validation performance
const prediction = (lstmPred * 0.4 + gruPred * 0.3 + convPred * 0.3);
```

**Strategy 3 - Temporal Ensemble:**
```typescript
// Train on different time windows (6mo, 1yr, 2yr)
// Recent model catches new trends
// Longer model provides stability
const shortTerm = modelTrained6Months.predict(data);
const mediumTerm = modelTrained1Year.predict(data);
const longTerm = modelTrained2Years.predict(data);

const prediction = (shortTerm * 0.5 + mediumTerm * 0.3 + longTerm * 0.2);
```

**Confidence via Ensemble Variance:**
```typescript
const predictions = models.map(m => m.predict(data));
const mean = calculateMean(predictions);
const variance = calculateVariance(predictions);
const confidence = 1 / (1 + variance);  // High variance = low confidence
```

**Importance:** LOW-MEDIUM - Improves robustness but significantly increases compute time (3-5x) and storage

**Complexity:** High (15-20 hours)
- Implement ensemble training logic
- Add weighted averaging strategies
- Update storage for multiple models per symbol (versioning)
- Add ensemble-specific config options
- Benchmark ensemble vs single model
- Consider storage implications (5x model files)
- Update predict command to use ensembles

**ETA:** 3-4 days

**Status:** Not Started

**Dependencies:** Item #6 (Alternative Architectures) for Strategy 2

**References:**
- `src/compute/persistence.ts` (model storage - needs versioning)
- `src/cli/commands/train.ts` (training command)

---

### 8. Enhanced Regularization

**Current:** Fixed 0.2 dropout on LSTM layers only

**Problem:**
- Limited regularization techniques beyond dropout
- No learning rate adaptation during training
- Potential for gradient instability (exploding/vanishing)
- Risk of overfitting on small datasets (<1000 samples)
- No batch normalization for training stability

**Fix:**

**1. Gradient Clipping:**
```typescript
model.compile({
    optimizer: tf.train.adam(learningRate, undefined, undefined, undefined, 1.0), // clipValue
    loss: 'meanSquaredError'
});
```

**2. Learning Rate Scheduling:**
```typescript
const lrScheduler = {
    onEpochEnd: (epoch: number, logs: tf.Logs) => {
        if (logs.val_loss > previousValLoss) {
            patienceCounter++;
            if (patienceCounter >= 3) {
                currentLR *= 0.5;  // Reduce by 50%
                model.optimizer.learningRate = currentLR;
            }
        }
    }
};
```

**3. L1/L2 Regularization:**
```typescript
tf.layers.dense({
    units: 1,
    kernelRegularizer: tf.regularizers.l2({l2: 0.01})
});
```

**4. Batch Normalization:**
```typescript
// After dense layers (NOT after LSTM - causes issues)
model.add(tf.layers.dense({units: 64}));
model.add(tf.layers.batchNormalization());
model.add(tf.layers.activation({activation: 'relu'}));
```

**5. Adaptive Dropout:**
```typescript
// Higher dropout for larger datasets
const dropoutRate = dataSize > 1000 ? 0.3 : 0.2;
```

**Importance:** MEDIUM - Incrementally improves training stability and generalization

**Complexity:** Medium (5-6 hours)
- Add learning rate scheduler callback
- Implement gradient clipping in optimizer config
- Add L1/L2 regularization options to config schema
- Test batch normalization placement (not with LSTMs)
- Add adaptive dropout based on dataset size
- Update config schema for new regularization options
- Document trade-offs

**ETA:** 1 day

**Status:** Not Started (Partial: Dropout already implemented at 0.2)

**References:**
- `src/compute/lstm-model.ts:228-256` (training loop with callbacks)
- `src/compute/lstm-model.ts:345-404` (model architecture)
- `src/config/schema.ts:45-52` (model config)
- TensorFlow.js Callbacks: https://js.tensorflow.org/api/latest/#callbacks

---

### 9. Walk-Forward Validation Enhancement

**Current:** Simple 90/10 time-series split (no shuffle) with early stopping on val_loss (patience=5)

**Problem:**
- Single validation split may not be representative of model robustness
- No assessment of model stability across different time periods
- Early stopping works but only monitors one metric (val_loss)
- Cannot detect if model performs well in bull markets but fails in bear markets

**Fix:**

**Expanding Window Cross-Validation:**
```typescript
// Train: [0...t1], Validate: [t1...t2]
// Train: [0...t2], Validate: [t2...t3]
// Train: [0...t3], Validate: [t3...t4]
// Mimics real-world scenario (always training on all available history)

class TimeSeriesCV {
    expandingWindow(data: StockDataPoint[], nSplits: number = 3) {
        const splitSize = Math.floor(data.length / (nSplits + 1));
        const splits = [];
        
        for (let i = 1; i <= nSplits; i++) {
            const trainEnd = splitSize * i;
            const valEnd = splitSize * (i + 1);
            
            splits.push({
                train: data.slice(0, trainEnd),
                validate: data.slice(trainEnd, valEnd)
            });
        }
        return splits;
    }
}
```

**Multiple Metrics Tracking:**
```typescript
const metrics = {
    mae: [],
    rmse: [],
    mape: [],
    directionalAccuracy: []  // Did we predict direction correctly?
};

// Enhanced early stopping
if (valMAE > bestMAE && valMAPE > bestMAPE) {
    patienceCounter++;  // Only stop if BOTH metrics worsen
}
```

**Importance:** LOW-MEDIUM - Better evaluation methodology but may not significantly change final predictions

**Complexity:** Medium (6-8 hours)
- Implement time-series cross-validation framework
- Add metric tracking infrastructure
- Update early stopping logic for multiple metrics
- Add CV results visualization to HTML reports
- Add tests for CV correctness
- Document when to use expanding vs rolling windows

**ETA:** 1-1.5 days

**Status:** Not Started (Partial: Time-series split with shuffle=false already correct)

**References:**
- `src/compute/lstm-model.ts:213-256` (current validation)
- scikit-learn TimeSeriesSplit equivalent needed
- Research: Bergmeir & Benítez, "On the use of cross-validation for time series predictor evaluation" (2012)

---

### 10. Outlier Detection and Data Quality Pipeline

**Current:** Basic validation (non-null checks only in `yahoo-finance.ts:189-224`)

**Problem:**
- Stock splits and dividends may create artificial jumps (Yahoo should handle via adjClose but errors happen)
- Flash crashes and data errors corrupt training (e.g., 2010 Flash Crash)
- No quality metrics to identify problematic symbols
- Bad data silently reduces model performance

**Fix:**

**Statistical Outlier Detection:**
```typescript
class DataQualityAnalyzer {
    detectOutliers(data: StockDataPoint[]): {
        outlierIndices: number[];
        qualityScore: number;  // 0-100
    } {
        const returns = calculateReturns(data);
        const mean = calculateMean(returns);
        const std = calculateStd(returns);
        
        // Flag returns > 3 standard deviations
        const outliers = returns.map((r, i) => 
            Math.abs(r - mean) > 3 * std ? i : -1
        ).filter(i => i !== -1);
        
        // Quality score based on multiple factors
        const completeness = 1 - (missingDays / totalDays);
        const outlierPenalty = 1 - (outliers.length / data.length);
        const consistencyScore = correlationWithMarketIndex;
        
        return {
            outlierIndices: outliers,
            qualityScore: (completeness * 0.4 + outlierPenalty * 0.3 + consistencyScore * 0.3) * 100
        };
    }
}
```

**Auto-rejection:**
```typescript
if (qualityScore < 60) {
    logger.warn(`Symbol ${symbol} has low quality score (${qualityScore}). Skipping training.`);
    return;
}
```

**Quality Reports:**
```html
<!-- In HTML output -->
<div class="data-quality">
    <span>Data Quality: ${qualityScore}/100</span>
    <span>Outliers: ${outlierCount} (${outlierPercent}%)</span>
    <span>Completeness: ${completeness}%</span>
</div>
```

**Importance:** MEDIUM - Prevents "garbage in, garbage out" scenarios

**Complexity:** Medium (5-6 hours)
- Create `DataQualityAnalyzer` class
- Implement statistical outlier detection (Z-score, IQR methods)
- Add quality scoring algorithm
- Integrate into sync/train pipeline with warnings
- Add quality metrics to HTML reports
- Add tests with known bad data

**ETA:** 1 day

**Status:** Not Started

**References:**
- `src/gather/yahoo-finance.ts:189-224` (current data processing)
- `src/gather/storage.ts` (data validation point)
- `src/output/html-generator.ts` (report generation)

---

### 11. Backtesting and Performance Tracking

**Current:** Only tracks loss, MAE, MAPE during training; no simulation of actual trading

**Problem:**
- No simulation of actual trading performance
- Cannot assess real-world profitability
- Missing key financial metrics (Sharpe ratio, drawdown, win rate)
- Cannot compare against simple buy-and-hold strategy
- Users don't know if signals are actually profitable

**Fix:**

**Backtesting Engine:**
```typescript
class BacktestEngine {
    simulate(
        predictions: PredictionResult[],
        historicalData: StockDataPoint[],
        config: BacktestConfig
    ): BacktestResults {
        let portfolio = {
            cash: 10000,
            shares: 0,
            value: 10000
        };
        
        const trades: Trade[] = [];
        
        for (const prediction of predictions) {
            const signal = generateSignal(prediction);
            
            if (signal === 'BUY' && portfolio.cash > 0) {
                const shares = Math.floor(portfolio.cash / prediction.currentPrice);
                portfolio.shares += shares;
                portfolio.cash -= shares * prediction.currentPrice * (1 + 0.001); // 0.1% transaction cost
                trades.push({type: 'BUY', date: prediction.date, price: prediction.currentPrice, shares});
            }
            
            if (signal === 'SELL' && portfolio.shares > 0) {
                portfolio.cash += portfolio.shares * prediction.currentPrice * (1 - 0.001);
                trades.push({type: 'SELL', date: prediction.date, price: prediction.currentPrice, shares: portfolio.shares});
                portfolio.shares = 0;
            }
        }
        
        return calculateMetrics(trades, portfolio);
    }
}
```

**Financial Metrics:**
```typescript
type BacktestResults = {
    sharpeRatio: number;        // Risk-adjusted returns
    maxDrawdown: number;        // Worst peak-to-trough decline
    winRate: number;            // % of profitable trades
    totalReturn: number;        // Total % gain/loss
    cumulativePnL: number[];    // Portfolio value over time
    trades: Trade[];
    benchmarkComparison: {
        buyAndHoldReturn: number;
        alpha: number;          // Excess return vs benchmark
    };
};
```

**Integration:**
```typescript
// In predict command
const backtest = await backtestEngine.simulate(predictions, historicalData, config);

// Display in CLI
console.log(`Sharpe Ratio: ${backtest.sharpeRatio.toFixed(2)}`);
console.log(`Win Rate: ${(backtest.winRate * 100).toFixed(1)}%`);
console.log(`Total Return: ${(backtest.totalReturn * 100).toFixed(2)}%`);
console.log(`vs Buy & Hold: ${(backtest.benchmarkComparison.buyAndHoldReturn * 100).toFixed(2)}%`);

// Add to HTML report with interactive charts
```

**Importance:** HIGH - Critical for assessing real-world viability and building user trust

**Complexity:** High (12-15 hours)
- Design backtesting framework with proper walk-forward testing
- Implement trading simulator with transaction costs
- Calculate financial metrics (Sharpe, drawdown, win rate)
- Add benchmark comparisons (buy-and-hold, market index)
- Integrate into predict command with optional flag
- Add interactive backtest charts to HTML report
- Extensive testing with historical data
- Document limitations (past performance ≠ future results)

**ETA:** 2-3 days

**Status:** Not Started

**References:**
- `src/compute/prediction.ts:23-44` (signal generation)
- `src/cli/commands/predict.ts` (prediction command)
- Add new module: `src/compute/backtesting.ts`
- Research: Prado, "Advances in Financial Machine Learning" (2018)

---

### 12. Incremental Learning and Model Versioning

**Current:** Full retrain when threshold reached (minNewDataPoints=50); no versioning or rollback capability

**Problem:**
- Full retraining is expensive (5-10 minutes per symbol × N symbols)
- Cannot adapt quickly to regime changes (market crashes, policy changes)
- No versioning or rollback capability if new model performs worse
- Lost opportunity for continual learning
- Cannot track model performance degradation over time

**Fix:**

**Incremental Training:**
```typescript
class IncrementalTrainer {
    async fineTune(
        existingModel: LstmModel,
        newData: StockDataPoint[],
        config: Config
    ): Promise<LstmModel> {
        // Use much lower learning rate for stability
        const fineTuneConfig = {
            ...config,
            model: {
                ...config.model,
                learningRate: 0.0001,  // 10x lower
                epochs: 10              // Fewer epochs
            }
        };
        
        // Train only on recent data
        await existingModel.train(newData, fineTuneConfig);
        
        // Validate on holdout set
        const holdoutPerformance = existingModel.evaluate(holdoutData);
        
        // Only keep if performance improved
        if (holdoutPerformance.mape < previousMAPE) {
            return existingModel;
        } else {
            logger.warn('Fine-tuning degraded performance. Keeping old model.');
            return loadPreviousVersion();
        }
    }
}
```

**Model Versioning:**
```typescript
// Storage structure
// data/models/AAPL/
//   - v1_2026-01-15.json (weights)
//   - v1_2026-01-15_metadata.json
//   - v2_2026-02-01.json
//   - v2_2026-02-01_metadata.json
//   - v3_2026-02-04.json (current)
//   - v3_2026-02-04_metadata.json

class ModelVersionManager {
    async saveVersion(symbol: string, model: LstmModel, metadata: ModelMetadata): Promise<string> {
        const version = await this.getNextVersion(symbol);
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `v${version}_${timestamp}`;
        // Save and keep last 3 versions
    }
    
    async rollback(symbol: string, version: number): Promise<LstmModel> {
        // Load specific version
    }
}
```

**CLI Commands:**
```bash
# Fine-tune existing model instead of full retrain
node src/index.ts train AAPL --incremental

# List model versions
node src/index.ts models list AAPL

# Rollback to previous version
node src/index.ts models rollback AAPL --version=2

# Compare versions
node src/index.ts models compare AAPL --versions=2,3
```

**Performance Monitoring:**
```typescript
class ModelPerformanceMonitor {
    async trackAccuracy(symbol: string, predictions: number[], actuals: number[]): Promise<void> {
        const mape = calculateMAPE(predictions, actuals);
        
        // Store in time-series database
        await db.insert('model_performance', {
            symbol,
            date: new Date(),
            mape,
            model_version: currentVersion
        });
        
        // Alert if accuracy drops >20%
        if (mape > baselineMAPE * 1.2) {
            logger.warn(`Model ${symbol} accuracy degraded. Consider retraining.`);
        }
    }
}
```

**Importance:** MEDIUM - Useful for production but complex to maintain and test

**Complexity:** Very High (20-25 hours)
- Design versioning schema and directory structure
- Implement incremental training logic with validation
- Add version storage and retrieval
- Create performance monitoring system
- Build rollback mechanism with safety checks
- Add new CLI commands (list, rollback, compare)
- Update train command with --incremental flag
- Extensive testing (version conflicts, corruption, etc.)
- Document when to use incremental vs full retrain

**ETA:** 4-5 days

**Status:** Not Started

**References:**
- `src/compute/persistence.ts` (model storage - needs major refactor)
- `src/cli/commands/train.ts` (training logic)
- Add new command: `src/cli/commands/models.ts`
- Add new module: `src/compute/incremental-trainer.ts`

---

### 13. Prediction Intervals (Uncertainty Quantification)

**Current:** Single confidence score (MAPE-based: `confidence = max(0.1, min(0.95, 1 - mape))`)

**Problem:**
- Point estimates don't capture uncertainty range
- No upper/lower bounds for predictions
- Users cannot assess risk (e.g., "price will be $150 ± $5" vs "$150 ± $30")
- Difficult to make risk-adjusted decisions

**Fix:**

**Method 1 - Quantile Regression:**
```typescript
// Train model to predict 10th, 50th, 90th percentiles
class QuantileModel extends LstmModel {
    buildModel(): tf.LayersModel {
        // ... LSTM layers ...
        
        // Output 3 values instead of 1
        model.add(tf.layers.dense({units: 3}));  // [p10, p50, p90]
        
        // Custom quantile loss
        model.compile({
            loss: (yTrue, yPred) => {
                const quantiles = [0.1, 0.5, 0.9];
                const losses = quantiles.map((q, i) => {
                    const error = yTrue.sub(yPred.slice([0, i], [-1, 1]));
                    return error.mul(q).where(error.greater(0), error.mul(q - 1));
                });
                return tf.stack(losses).mean();
            }
        });
    }
}
```

**Method 2 - Monte Carlo Dropout:**
```typescript
// Run prediction multiple times with dropout enabled
class UncertaintyEstimator {
    async estimateUncertainty(
        model: LstmModel,
        data: StockDataPoint[],
        nSamples: number = 100
    ): Promise<PredictionInterval> {
        const predictions: number[] = [];
        
        for (let i = 0; i < nSamples; i++) {
            // Enable dropout during inference
            const pred = model.predict(data, {training: true});
            predictions.push(pred);
        }
        
        // Calculate statistics
        const mean = calculateMean(predictions);
        const std = calculateStd(predictions);
        
        return {
            mean,
            lower: mean - 1.96 * std,  // 95% CI
            upper: mean + 1.96 * std
        };
    }
}
```

**Method 3 - Ensemble Variance:**
```typescript
// Use standard deviation across ensemble predictions
const ensemblePredictions = models.map(m => m.predict(data));
const mean = calculateMean(ensemblePredictions);
const std = calculateStd(ensemblePredictions);

const interval = {
    prediction: mean,
    lowerBound: mean - 2 * std,
    upperBound: mean + 2 * std,
    confidence: 0.95
};
```

**Visualization:**
```html
<!-- In HTML report -->
<canvas id="predictionChart"></canvas>
<script>
    // Show prediction as a shaded band instead of single line
    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {label: 'Predicted Price', data: predictions, borderColor: 'blue'},
                {label: 'Upper Bound (95%)', data: upperBounds, borderColor: 'lightblue', fill: '+1'},
                {label: 'Lower Bound (95%)', data: lowerBounds, borderColor: 'lightblue', fill: '-1'}
            ]
        }
    });
</script>
```

**Importance:** MEDIUM - Better risk assessment and more honest uncertainty communication

**Complexity:** High (10-12 hours)
- Implement quantile loss function (Method 1) OR
- Implement Monte Carlo dropout (Method 2) OR
- Use ensemble variance (Method 3 - requires Item #7)
- Modify prediction engine to return intervals
- Update HTML charts to show prediction bands
- Add uncertainty metrics to reports
- Test calibration (do 95% intervals actually contain 95% of outcomes?)
- Document which method to use when

**ETA:** 2 days

**Status:** Not Started

**Dependencies:** Method 3 requires Item #7 (Ensemble Methods)

**References:**
- `src/compute/prediction.ts` (prediction engine)
- `src/output/html-generator.ts` (chart generation)
- Research: 
  - "Probabilistic Forecasting with Deep Learning" (Salinas et al., 2020)
  - "Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles" (Lakshminarayanan et al., 2017)

---

### 14. Fix Market Feature Recursive Prediction ✅

**Status:** Completed - Option A (2026-02-04)

**Impact:** More realistic market condition assumptions during recursive prediction, eliminates frozen feature problem.

**Future Enhancement:** Option B (feature forecasting with mini-models) remains available for advanced implementation.

---

### 15. Add Volume-Based Features

**Current:** Volume data downloaded from Yahoo Finance but **not used** in model features

**Problem:**
- Volume confirms price movements (high volume breakout = more reliable signal)
- Volume divergence can signal reversals (price up but volume down = weak rally)
- Currently using only: close, SMA, RSI, daily returns
- Missing On-Balance Volume (OBV), Volume Ratio, Volume MA

**Data Available:** `StockDataPoint.volume` already in database (not null, validated)

**Fix:**

**Add volume indicators:**
```typescript
// src/compute/indicators.ts

/**
 * Calculate Volume Moving Average
 */
export function calculateVolumeMA(data: StockDataPoint[], period: number = 20): number[] {
    return data.map((_, i) => {
        if (i < period - 1) return data[i]?.volume ?? 0;
        
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j]?.volume ?? 0;
        }
        return sum / period;
    });
}

/**
 * Calculate Volume Ratio (current volume / 20-day average)
 * > 2.0 = volume surge, < 0.5 = low volume
 */
export function calculateVolumeRatio(data: StockDataPoint[]): number[] {
    const volumeMA = calculateVolumeMA(data, 20);
    return data.map((point, i) => {
        const ma = volumeMA[i] ?? 1;
        return ma === 0 ? 1 : point.volume / ma;
    });
}

/**
 * Calculate On-Balance Volume (OBV)
 * Cumulative indicator: add volume on up days, subtract on down days
 */
export function calculateOBV(data: StockDataPoint[]): number[] {
    let obv = 0;
    return data.map((point, i) => {
        if (i === 0) return obv;
        
        const priceChange = point.close - (data[i - 1]?.close ?? point.close);
        if (priceChange > 0) {
            obv += point.volume;
        } else if (priceChange < 0) {
            obv -= point.volume;
        }
        // If price unchanged, OBV unchanged
        return obv;
    });
}
```

**Integration into model:**
```typescript
// src/compute/lstm-model.ts - preprocessData method

// After calculating technical indicators (line 494-503)
const volumeMA = calculateVolumeMA(data, 20);
const volumeRatio = calculateVolumeRatio(data);
const obv = calculateOBV(data);

// Normalize volume features
const normalizedVolumeRatio = volumeRatio.map(v => Math.min(1, v / 3)); // Clip to [0, 1]
const normalizedOBV = normalizeArray(obv);  // Min-max normalize

// Add to technical matrix
const technicalMatrix: number[][] = data.map((_, i) => [
    normalizedSma[i] ?? 0.5,
    normalizedRsi[i] ?? 0.5,
    normalizedReturns[i] ?? 0.5,
    normalizedVolumeRatio[i] ?? 0.5,  // NEW
    normalizedOBV[i] ?? 0.5            // NEW
]);

// Update input dimension calculation (line 362-364)
const technicalFeatureCount = 5;  // Was 3, now 5
```

**Importance:** MEDIUM - Incremental improvement, low-hanging fruit

**Complexity:** Low (2-3 hours)
- Implement 3 volume indicator functions
- Add to preprocessing pipeline
- Update input dimension calculation
- Add tests for volume calculations
- Update documentation

**ETA:** 0.5 days

**Status:** Not Started

**References:**
- `src/compute/indicators.ts` (add functions here)
- `src/compute/lstm-model.ts:485-523` (preprocessData method)
- `src/compute/lstm-model.ts:362-364` (input dimension)
- `src/types/index.ts` (StockDataPoint already has volume)

---

## 📊 PRIORITY MATRIX

| Priority | Item | Impact | Effort | ROI | Status |
|----------|------|--------|--------|-----|--------|
| ~~🔴 **CRITICAL**~~ | ~~#1 Window Normalization~~ | ~~Very High~~ | ~~Medium~~ | ~~⭐⭐⭐⭐⭐~~ | ✅ Complete |
| ~~🔴 **HIGH**~~ | ~~#2 Log-Return Training~~ | ~~High~~ | ~~Medium~~ | ~~⭐⭐⭐⭐~~ | ✅ Complete |
| ~~🔴 **HIGH**~~ | ~~#14 Market Feature Prediction~~ | ~~High~~ | ~~Low (A)~~ | ~~⭐⭐⭐⭐~~ | ✅ Complete |
| 🔴 **HIGH** | #11 Backtesting | High | High | ⭐⭐⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #3 Linear Interpolation | Medium | Low | ⭐⭐⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #15 Volume Features | Medium | Low | ⭐⭐⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #8 Enhanced Regularization | Medium | Medium | ⭐⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #10 Outlier Detection | Medium | Medium | ⭐⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #4 Multi-Source Fallback | Medium | High | ⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #5 Hyperparameter Tuning (P1) | Medium-High | High | ⭐⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #6 Alternative Architectures | Medium | High | ⭐⭐ | Not Started |
| 🟡 **MEDIUM** | #13 Prediction Intervals | Medium | High | ⭐⭐ | Not Started |
| 🟢 **LOW** | #9 Walk-Forward CV | Low-Medium | Medium | ⭐⭐ | Not Started |
| 🟢 **LOW** | #7 Ensemble Methods | Medium | Very High | ⭐⭐ | Not Started |
| 🟢 **LOW** | #12 Incremental Learning | Medium | Very High | ⭐ | Not Started |

**Completed:** 3 items (2 days)  
**Remaining Effort:** ~25 days

---

## 🚀 RECOMMENDED IMPLEMENTATION SEQUENCE

### **Phase 1: Foundation Fixes** ✅ Partially Complete

**Goal:** Fix fundamental data issues and establish solid foundation

**Completed (2026-02-04):**
1. ✅ **#1 Window Normalization** - Per-window z-score normalization implemented
2. ✅ **#2 Log-Return Training** - Model now trains on log returns
3. ✅ **#14 Market Feature Prediction (Option A)** - Exponential decay implemented

**Remaining:**
4. ⏳ **#3 Linear Interpolation** - 0.5 days
   - Handles missing data
   - Quick win with high value

**Status:** Core ML improvements complete. Model version 2.0.0. All existing models require retraining. Test coverage: 94%+.

**Next Action:** Implement #3 (Linear Interpolation) to complete Phase 1, then retrain all models and measure MAPE improvement.

---

### **Phase 2: Robustness & Quick Wins (Week 2) - 4.5 days**

**Goal:** Add data quality checks, volume features, and backtesting

5. **#15 Volume Features** - 0.5 days
   - Low-hanging fruit
   - Volume confirmation for signals

6. **#8 Enhanced Regularization** - 1 day
   - Learning rate scheduling
   - Gradient clipping
   - Improves training stability

7. **#10 Outlier Detection** - 1 day
   - Data quality pipeline
   - Prevent garbage-in-garbage-out

8. **#11 Backtesting Framework** - 2.5 days
   - **Critical for assessing real-world viability**
   - Sharpe ratio, win rate, drawdown
   - Compare vs buy-and-hold

**Deliverable:** Backtesting reports showing if signals are actually profitable.

---

### **Phase 3: Advanced Features (Weeks 3-4) - 6 days**

**Goal:** Hyperparameter tuning and architectural improvements

9. **#5 Hyperparameter Optimization Phase 1** - 2 days
   - Grid search over key parameters
   - Find optimal configs per symbol

10. **#4 Multi-Source Fallback** - 1.5 days
    - Alpha Vantage backup
    - Increases reliability

11. **#6 Alternative Architectures** - 2.5 days
    - GRU, Conv-LSTM, Attention
    - Experimentation framework

**Deliverable:** Tuned models with documented architecture choices.

---

### **Phase 4: Production Enhancements (Week 5+) - 11+ days**

**Goal:** Production-grade features for advanced users

12. **#13 Prediction Intervals** - 2 days
    - Uncertainty quantification
    - Better risk assessment

13. **#9 Walk-Forward CV Enhancement** - 1.25 days
    - More robust validation
    - Expanding window cross-validation

14. **#7 Ensemble Methods** - 3.5 days
    - Multiple models per symbol
    - Variance-based confidence

15. **#12 Incremental Learning** - 4.5 days
    - Model versioning
    - Rollback capability
    - Performance monitoring

**Deliverable:** Production-ready system with advanced features.

---

## 📝 IMPLEMENTATION NOTES

### Breaking Changes
The following items require **full model retrain** (all existing models invalidated):
- ⏳ #1: Window Normalization
- ⏳ #2: Log-Return Training
- ⏳ #15: Volume Features (adds input dimensions)

**Recommendation:** Implement #1, #2, #15 together in Phase 1, then retrain ONCE to include all improvements.

### Testing Requirements
Every implementation must:
- Achieve 90% code coverage (project mandate)
- Include unit tests for core logic
- Include integration tests for CLI commands
- Pass verification protocol: `npx eslint`, `tsc --noEmit`, `vitest run`, `prettier --write`

### Documentation Requirements
- Update `AGENTS.md` if workflow changes
- Update `README.md` for new commands
- Update `config.jsonc` comments for new config options
- Add inline code comments for complex algorithms

### Performance Considerations
Items that significantly increase compute time:
- #5 Hyperparameter Optimization: 2-4x training time
- #7 Ensemble Methods: 3-5x training time and storage
- #11 Backtesting: +20-30% prediction time

### Monitoring & Rollback
After Phase 1 (Foundation Fixes):
- Track MAPE improvement vs baseline
- Monitor prediction quality on validation set
- Keep backup of old models for comparison
- Document performance changes in commit messages

---

## 🎯 SUCCESS METRICS

### Phase 1 Success Criteria:
- [ ] MAPE improves by ≥10% on validation set (pending retrain)
- [x] No data leakage in normalization (verified by tests)
- [ ] All symbols train without errors (pending retrain)
- [x] 94%+ test coverage maintained (177 tests passing)

### Phase 2 Success Criteria:
- [ ] Backtesting shows positive Sharpe ratio (>0.5)
- [ ] Win rate >55% (better than random)
- [ ] Data quality scores computed for all symbols
- [ ] Volume features contribute to model accuracy

### Phase 3 Success Criteria:
- [ ] Hyperparameter tuning finds better configs for ≥50% of symbols
- [ ] Alternative architectures benchmarked
- [ ] Multi-source fallback tested with outage simulation

### Phase 4 Success Criteria:
- [ ] Prediction intervals calibrated (95% CI contains 95% of outcomes)
- [ ] Ensemble models outperform single models
- [ ] Incremental learning reduces retrain time by ≥60%

---

## 📚 REFERENCES & RESEARCH

### Books
- Tsay, Ruey S. "Analysis of Financial Time Series" (2010) - Stationarity, log returns
- Prado, Marcos López de. "Advances in Financial Machine Learning" (2018) - Backtesting, walk-forward validation
- Chan, Ernest P. "Quantitative Trading" (2009) - Performance metrics, Sharpe ratio

### Papers
- "Probabilistic Forecasting with Deep Learning" (Salinas et al., 2020) - Prediction intervals
- "Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles" (Lakshminarayanan et al., 2017)
- "On the use of cross-validation for time series predictor evaluation" (Bergmeir & Benítez, 2012)

### Technical Resources
- TensorFlow.js Documentation: https://js.tensorflow.org/api/latest/
- Alpha Vantage API: https://www.alphavantage.co/documentation/
- Yahoo Finance API: https://github.com/gadicc/node-yahoo-finance2

---

**Document Status:** Ready for Implementation  
**Next Step:** Begin Phase 1 (Window Normalization, Log-Return Training, Market Feature Prediction)
