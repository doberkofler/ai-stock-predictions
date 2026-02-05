# AI Stock Predictions - ML Enhancement Proposals

This document contains prioritized proposals for improving the machine learning capabilities of the AI Stock Predictions system.

**Last Updated:** 2026-02-05  
**Document Version:** 1.7

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

### ✅ Phase 1 & 2 Progress (2026-02-04):
- **#1 Window-Based Normalization**: Per-window z-score normalization eliminates data leakage
- **#2 Log-Return Training**: Model trains on stationary log returns instead of absolute prices
- **#14 Market Feature Prediction**: Exponential decay prevents frozen market conditions
- **#3 Linear Interpolation**: Gap detection, linear interpolation (≤3 days), quality scoring (0-100)
- **#15 Volume-Based Features**: Added VMA, Volume Ratio, and OBV indicators (5 technical features total)
- **#8 Enhanced Regularization**: Added L1/L2 reg, recurrent dropout, adaptive LR, and gradient clipping
- **#11 Backtesting Framework**: Walk-forward simulation with Sharpe Ratio and Equity Curves
- **#10 Outlier Detection**: Statistical detection and auto-rejection of poor-quality data
- **Breaking Change**: Model version 2.0.0 - all existing models require retraining
- **Test Coverage**: 93.33%+ (224 tests passing)
- **Next Step**: Retrain all models and measure MAPE improvement vs baseline

### 🟡 Phase 3 Progress (2026-02-05):
- **#6 Alternative Model Architectures**: Architecture Factory pattern implementation completed.
- **#6.4 Attention-LSTM**: Implementation of self-attention layer for time-series weighting completed.
- **#5 Hyperparameter Optimization (Phase 1)**: Grid search with time-series cross-validation completed.
- **#13 Prediction Intervals**: Monte Carlo Dropout for uncertainty quantification with 95% confidence intervals.

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

### 3. Linear Interpolation for Missing Data ✅

**Status:** Completed (2026-02-04)

**Impact:** Improved data completeness, quality scoring (0-100), and automatic rejection of low-quality symbols.

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

**Status:** ✅ Phase 1 Completed (2026-02-05)

**Impact:** Enables per-symbol hyperparameter optimization using grid search and time-series cross-validation. Systematically explores the hyperparameter space to find optimal configurations for individual stocks.

**Implementation:**
- Created `HyperparameterTuner` class with grid search functionality in `src/compute/tuner.ts`
- Implemented expanding window time-series cross-validation to evaluate hyperparameter combinations
- Added `tune` CLI command for interactive hyperparameter optimization
- Configurable search space via `tuning` section in `config.jsonc`:
  - `architecture`: ['lstm', 'gru', 'attention-lstm']
  - `windowSize`: [20, 30, 60]
  - `learningRate`: [0.001, 0.0005]
  - `batchSize`: [64, 128, 256]
  - `epochs`: [30, 50, 100]
  - `maxTrials`: Limits total trials to prevent excessive runtime
  - `validationSplits`: Number of CV folds (default: 3)
- Progress tracking with real-time MAPE updates
- Returns best configuration based on validation MAPE

**CLI Usage:**
```bash
node src/index.ts tune AAPL
# Outputs optimal hyperparameters for symbol AAPL
```

**Code Locations:**
- `src/compute/tuner.ts` - Grid search implementation with CV
- `src/cli/commands/tune.ts` - CLI command
- `src/config/schema.ts:88-96` - Tuning configuration schema
- `src/index.ts:82-88` - Command registration
- `tests/unit/compute/tuner.test.ts` - Test coverage (4 tests)

**Phase 2 (Future - Bayesian Optimization):**
- Use TensorFlow.js with custom Bayesian implementation
- Explore continuous hyperparameter space efficiently
- 20-30 trials vs full grid search

**Status:** Phase 1 ✅ Complete, Phase 2 Not Started

---

### 6. Alternative Model Architectures (In Progress)

**Status:** ✅ Completed (2026-02-05)

**Implementation:**
- Implemented `ArchitectureFactory` pattern in `src/compute/lstm-model.ts`.
- Added support for three architectures via `config.jsonc`:
  - `lstm` (default): Standard 2-layer LSTM.
  - `gru`: Gated Recurrent Unit (faster training, similar performance).
  - `attention-lstm`: LSTM with Self-Attention mechanism for weighting time steps.
- Updated `ModelSchema` to include `architecture` enum.
- Added 12 new tests covering architecture instantiation and training.

**Code Locations:**
- `src/compute/lstm-model.ts:446-512` (Architecture Factory)
- `src/config/schema.ts:48` (Config schema)
- `tests/unit/compute/lstm-model.test.ts` (Tests)

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

### 8. Enhanced Regularization ✅

**Status:** Completed (2026-02-04)

**Impact:** Improved training stability and generalization. Prevents overfitting on small datasets through multiple techniques:
- **Configurable Regularization**: Added L1/L2 kernel regularization, Dropout, and Recurrent Dropout.
- **Adaptive Learning Rate**: Implemented a "ReduceLROnPlateau" style scheduler that reduces the learning rate by 50% after 3 epochs without improvement.
- **Gradient Clipping**: Added gradient clipping (clipvalue=1.0) to prevent exploding gradients.

**Implementation:**
- Updated `ModelSchema` in `src/config/schema.ts` with new hyperparameters.
- Updated `buildModel` and `train` in `src/compute/lstm-model.ts` to apply regularization and LR scheduling.
- Updated multiple test files to support the new configuration structure.

**Code Locations:**
- `src/config/schema.ts` - New regularization hyperparameters
- `src/compute/lstm-model.ts` - Regularization and scheduling implementation
- `tests/unit/compute/lstm-model.test.ts` - Verification of new features

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

### 10. Outlier Detection and Data Quality Pipeline ✅

**Status:** Completed (2026-02-04)

**Impact:** Prevents "garbage-in, garbage-out" by identifying and handling anomalous data points that can corrupt training.
- **Statistical Detection**: Uses Z-score (threshold=3) on log returns to find price outliers.
- **Quality Scoring**: Comprehensive 0-100 score based on completeness, gap sizes, outlier frequency, and data density.
- **Auto-Rejection**: Training pipeline automatically skips symbols with quality scores below the configurable threshold (default: 60).
- **Transparency**: Detailed quality metrics (outlier counts, interpolation stats) are displayed in HTML reports.

**Implementation:**
- Enhanced `processData` in `src/gather/data-quality.ts` with outlier detection logic.
- Updated `SqliteStorage` schema and persistence for new quality metrics.
- Integrated `minQualityScore` check in `src/cli/commands/train.ts`.
- Updated `HtmlGenerator` to display detailed quality summaries.

**Code Locations:**
- `src/gather/data-quality.ts` - Outlier detection and scoring logic
- `src/cli/commands/train.ts` - Auto-rejection integration
- `src/output/html-generator.ts` - Reporting logic
- `tests/unit/gather/data-quality.test.ts` - Logic verification

---

### 11. Backtesting and Performance Tracking ✅

**Status:** Completed (2026-02-04)

**Impact:** Critical for assessing real-world viability and building user trust. Provides a quantitative measure of whether the model's signals would have been profitable in the past.
- **Financial Metrics**: Calculates Sharpe Ratio, Win Rate, Max Drawdown, and Alpha vs. Benchmark.
- **Walk-Forward Simulation**: Automatically runs a 6-month simulation during prediction using next-day open prices and accounting for transaction costs.
- **Visual Feedback**: Interactive equity curve charts and performance summaries in HTML reports.

**Implementation:**
- Created `src/compute/backtest/engine.ts` for core simulation logic.
- Integrated backtesting into `src/cli/commands/predict.ts`.
- Updated `src/output/html-generator.ts` and associated assets for visualization.

**Code Locations:**
- `src/compute/backtest/engine.ts` - Backtest simulator
- `src/cli/commands/predict.ts` - Integration logic
- `src/output/html-generator.ts` - UI rendering logic
- `tests/compute/backtest/engine.test.ts` - Core engine tests

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

**Status:** ✅ Completed (2026-02-05)

**Impact:** Provides honest uncertainty communication through 95% confidence intervals. Users can now assess risk ranges and make informed decisions based on prediction uncertainty.

**Implementation:**
- **Method Used:** Monte Carlo Dropout (Method 2) - Already implemented, enhanced visualization
- **Technique:** Run predictions multiple times with dropout enabled (`training: true`) to generate distribution
- **Confidence Intervals:** Calculate mean ± 1.96 * stdDev for 95% CI per day
- **Iterations:** Configurable via `config.prediction.uncertaintyIterations` (default: 10)

**What Was Enhanced:**
1. **Chart Visualization** (`src/output/assets/report.js`):
   - Added dashed border lines for upper/lower bounds
   - Shaded confidence band with semi-transparent fill
   - Clear legend labels: "95% Upper Bound", "95% Lower Bound", "Forecast (Mean)"
   - Increased opacity for better visibility

2. **HTML Report** (`src/output/html-generator.ts`):
   - Added explanatory text: "Shaded area represents 95% confidence interval"
   - New table row showing prediction interval range
   - Display format: "$X.XX - $Y.YY (Range: ±$Z.ZZ)"

3. **Testing** (`tests/unit/compute/prediction.test.ts`):
   - Added test for Monte Carlo Dropout with 10 iterations
   - Verifies bounds are calculated and make logical sense
   - Confirms `training: true` parameter is passed correctly

**Code Locations:**
- `src/compute/prediction.ts:81-115` - Monte Carlo Dropout implementation
- `src/output/assets/report.js:132-149` - Confidence band visualization
- `src/output/html-generator.ts:375-386` - Interval display in reports
- `tests/unit/compute/prediction.test.ts:120-170` - Test coverage

**Data Flow:**
```typescript
// For each prediction:
1. Run model.predict() N times with {training: true}
2. Calculate mean, stdDev for each day
3. Compute bounds: mean ± 1.96 * stdDev
4. Return in predictedData[].{price, lowerBound, upperBound}
5. Visualize as shaded band in Chart.js
```

**Future Enhancements:**
- Method 3 (Ensemble Variance) - Can be added when Item #7 (Ensemble Methods) is completed
- Calibration testing - Verify 95% intervals contain 95% of actual outcomes
- Configurable confidence levels (68%, 95%, 99%)

---

### 14. Fix Market Feature Recursive Prediction ✅

**Status:** Completed - Option A (2026-02-04)

**Impact:** More realistic market condition assumptions during recursive prediction, eliminates frozen feature problem.

**Future Enhancement:** Option B (feature forecasting with mini-models) remains available for advanced implementation.

---

### 15. Add Volume-Based Features ✅

**Status:** Completed (2026-02-04)

**Impact:** Added three volume-based technical indicators to improve model feature richness. Volume features help confirm price movements and detect potential reversals.

**Implementation:**
- Added `calculateVolumeMA()`, `calculateVolumeRatio()`, and `calculateOBV()` to `src/compute/indicators.ts:77-135`
- Integrated volume features into preprocessing pipeline in `src/compute/lstm-model.ts:673-707`
- Updated `technicalFeatureCount` from 3 to 5 in `src/compute/lstm-model.ts:496`
- Added comprehensive tests covering all edge cases in `tests/unit/compute/indicators.test.ts:115-249`
- All 209 tests passing with 93%+ coverage maintained

**Breaking Change:** Model input dimension changed from `1 + 3 + market_features` to `1 + 5 + market_features`. Existing trained models are incompatible and require retraining.

**Features Added:**
1. **Volume Moving Average (VMA)**: 20-day moving average of volume
2. **Volume Ratio**: Current volume / 20-day VMA (>2.0 = surge, <0.5 = low)
3. **On-Balance Volume (OBV)**: Cumulative volume indicator (add on up days, subtract on down days)

**Code Locations:**
- `src/compute/indicators.ts:77-135` - Volume indicator implementations
- `src/compute/lstm-model.ts:673-707` - Volume feature calculation and normalization
- `src/compute/lstm-model.ts:496` - Input dimension update
- `tests/unit/compute/indicators.test.ts:115-249` - Volume indicator tests

---

## 📊 PRIORITY MATRIX

| Priority | Item | Impact | Effort | ROI | Status |
|----------|------|--------|--------|-----|--------|
| ~~🔴 **CRITICAL**~~ | ~~#1 Window Normalization~~ | ~~Very High~~ | ~~Medium~~ | ~~⭐⭐⭐⭐⭐~~ | ✅ Complete |
| ~~🔴 **HIGH**~~ | ~~#2 Log-Return Training~~ | ~~High~~ | ~~Medium~~ | ~~⭐⭐⭐⭐~~ | ✅ Complete |
| ~~🔴 **HIGH**~~ | ~~#14 Market Feature Prediction~~ | ~~High~~ | ~~Low (A)~~ | ~~⭐⭐⭐⭐~~ | ✅ Complete |
| 🔴 **HIGH** | #11 Backtesting | High | High | ⭐⭐⭐⭐ | ✅ Complete |
| ~~🟡 **MEDIUM**~~ | ~~#3 Linear Interpolation~~ | ~~Medium~~ | ~~Low~~ | ~~⭐⭐⭐⭐~~ | ✅ Complete |
| ~~🟡 **MEDIUM**~~ | ~~#15 Volume Features~~ | ~~Medium~~ | ~~Low~~ | ~~⭐⭐⭐⭐~~ | ✅ Complete |
| 🟡 **MEDIUM** | #8 Enhanced Regularization | Medium | Medium | ⭐⭐⭐ | ✅ Complete |
| 🟡 **MEDIUM** | #10 Outlier Detection | Medium | Medium | ⭐⭐⭐ | ✅ Complete |
| 🟡 **MEDIUM** | #4 Multi-Source Fallback | Medium | High | ⭐⭐ | Not Started |
| ~~🟡 **MEDIUM**~~ | ~~#5 Hyperparameter Tuning (P1)~~ | ~~Medium-High~~ | ~~High~~ | ~~⭐⭐⭐~~ | ✅ Complete |
| ~~🟡 **MEDIUM**~~ | ~~#6 Alternative Architectures~~ | ~~Medium~~ | ~~High~~ | ~~⭐⭐~~ | ✅ Complete |
| ~~🟡 **MEDIUM**~~ | ~~#13 Prediction Intervals~~ | ~~Medium~~ | ~~High~~ | ~~⭐⭐~~ | ✅ Complete |
| 🟢 **LOW** | #9 Walk-Forward CV | Low-Medium | Medium | ⭐⭐ | Not Started |
| 🟢 **LOW** | #7 Ensemble Methods | Medium | Very High | ⭐⭐ | Not Started |
| 🟢 **LOW** | #12 Incremental Learning | Medium | Very High | ⭐ | Not Started |

**Completed:** 12 items  
**Remaining Effort:** ~12 days

---

## 🚀 RECOMMENDED IMPLEMENTATION SEQUENCE

### **Phase 1: Foundation Fixes** ✅ Complete

**Goal:** Fix fundamental data issues and establish solid foundation

**Completed (2026-02-04):**
1. ✅ **#1 Window Normalization** - Per-window z-score normalization implemented
2. ✅ **#2 Log-Return Training** - Model now trains on log returns
3. ✅ **#14 Market Feature Prediction (Option A)** - Exponential decay implemented
4. ✅ **#3 Linear Interpolation** - Gap detection and quality scoring
5. ✅ **#15 Volume Features** - Added VMA, Volume Ratio, OBV indicators

**Status:** ✅ Phase 1 Complete

All Phase 1 items implemented:
- Window-based z-score normalization (eliminates data leakage)
- Log-return training (improves stationarity)
- Market feature prediction with exponential decay
- Linear interpolation with quality scoring
- Volume-based features (5 technical indicators total)

**Model Version:** 2.0.0  
**Test Coverage:** 93.33%+ (209 tests passing)  
**Breaking Change:** All existing models require retraining

**Next Action:** Retrain all models and measure MAPE improvement vs baseline to validate Phase 1 enhancements.

---

### **Phase 2: Robustness & Quick Wins (Week 2) - 4 days**

**Goal:** Add data quality checks and backtesting

5. ~~**#15 Volume Features**~~ - ✅ Complete
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

### **Phase 3: Advanced Features (Weeks 3-4) - In Progress**

**Goal:** Hyperparameter tuning and architectural improvements

9. **#5 Hyperparameter Optimization Phase 1** - 2 days
   - Grid search over key parameters
   - Find optimal configs per symbol

10. **#4 Multi-Source Fallback** - 1.5 days
    - Alpha Vantage backup
    - Increases reliability

11. **#6 Alternative Model Architectures (Attention-LSTM)** - 2.5 days (IN PROGRESS)
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
- ✅ #1: Window Normalization
- ✅ #2: Log-Return Training
- ✅ #15: Volume Features (adds input dimensions)

**Status:** All breaking changes implemented in Phase 1. Models require retraining to use new features.

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
- [x] 93%+ test coverage maintained (196 tests passing)
- [x] Linear interpolation handles gaps ≤3 days
- [x] Quality scoring (0-100) implemented and displayed in reports

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
