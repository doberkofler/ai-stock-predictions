# AI Stock Predictions - Agent Instruction Manual

## 1. Environment & Technical Standards

- **Runtime**: Node.js v24 (Native TypeScript execution via `tsx`).
- **Target**: ES2024, ESM (ECMAScript Modules).
- **Language**: Strictest TypeScript configuration (all strict flags enabled).
- **ESLint**: Latest version with flat config and strict/stylistic type-checked rules.
- **Standards**: Adhere to `BEHAVIOR.md` protocols.
- **Indentation**: Tabs (4 spaces width).
- **Line Length**: 160 characters.
- **Semicolons**: Mandatory.
- **Quotes**: Single quotes for strings, unless JSON or CSS.
- **Spacing**: No bracket spacing (e.g., `import {name} from 'path'`).

### UI & Logging

- **Output Suppression**: The `ui` module suppresses decorative output and spinners in non-TTY environments (like during `node src/index.ts` runs via agents) or when `NODE_ENV=test`, `VITEST`, or `CI` are set.
- **Force Output**: To see full CLI output (including spinners and logs) when running via an agent, set the `DEBUG_UI=true` environment variable.
  - Example: `DEBUG_UI=true node src/index.ts sync`.

## 2. CLI Workflow & Commands

Agents MUST verify changes using these commands:

### Core Commands

- `node src/index.ts [command]`: Run the application.
- `npm run ci`: Full verification (Lint/Typecheck + Knip + Test Coverage).
- `npm run lint`: `tsc --noEmit && eslint . --ext .ts`.
- `npm run fix`: `npm run format && eslint . --ext .ts --fix`.
- `npm run format`: `npx prettier --write "src/**/*.ts" "tests/**/*.ts"`.

### Testing (Vitest 4)

- `npm run test`: Run all unit tests.
- `npx vitest run path/to/file.test.ts`: Run a specific test file.
- `npx vitest run -t "test name"`: Run a specific test by name.
- `npm run test:coverage`: Verify 90% coverage mandate.

## 3. Code Style Guidelines

### Naming Conventions

- **Classes/Components**: `PascalCase` (e.g., `LstmModel`).
- **Logic/Service Files**: `kebab-case` (e.g., `yahoo-finance.ts`).
- **Functions/Variables**: `camelCase` (e.g., `calculateConfidence`).
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `CONFIG_FILE_PATH`).

### Types & Data Validation

- **Types ONLY**: Use `type` exclusively. `interface` is strictly forbidden.
- **Zod Boundaries**: `zod` is mandatory for all external data boundaries (API, JSON, CLI input, Filesystem).
- **Assertions**: Strictly avoid `as` type assertions. Use Zod validation (`.parse()` or `.safeParse()`) instead.
- **Assertion Exception**: If `as` is unavoidable (e.g., third-party type narrowing that cannot be validated), a comment MUST be added justifying why validation is impossible.
- **No Any**: `any` type is strictly forbidden. Use `unknown` if type is truly unknown before validation.

### Error Handling

- **Throw Early**: Throw on all error conditions. Do not return error objects as values.
- **Type Guards**: Use custom type guards for safe data handling after validation.
- **Contextual Errors**: Use `src/cli/utils/errors.ts` to wrap errors with context.

## 4. Module Architecture

- **Gather**: Yahoo Finance API integration and `SqliteStorage` persistence with market indices and features support.
- **Compute**: TensorFlow.js LSTM models with market context feature engineering (beta, correlation, VIX, regime, etc.). Persistence in `./models/`.
- **Output**: Static `index.html` generation with Chart.js visualization.

## 5. Verification Protocol

For every modification, the agent MUST execute:

1. `npx eslint [path]`
2. `npx tsc --noEmit`
3. `npx vitest run [relevant_tests]`
4. `npx prettier --write [path]`

## 6. Implementation Progress

### Core Project

- [x] Project Foundation (ES2024, Vitest 4, Node.js 24)
- [x] Configuration System (JSONC format with Zod validation, defaults)
- [x] CLI Framework (6 commands: init, sync, train, predict, export, import)
- [x] Core Utilities (progress tracking, error handling)
- [x] Data Gathering Module (Yahoo Finance API, SQLite storage)
- [x] Compute Module (Implemented and type-refactored)
- [x] Output Module (Implemented)
- [x] Serialization Tools (Export/Import commands)
- [x] Unit Tests (100% of modules verified, Overall Statement Coverage: 96.1%)
- [x] Corrected default symbol list and company names
- [x] Polished CLI progress messaging (removed redundant checkmarks)
- [x] Implemented `--quick-test` mode (3 symbols, 50 data points) for rapid verification
- [x] Merged `retrain` functionality into `train --init` for a cleaner CLI interface
- [x] Optimized `--quick-test` mode (3 symbols, 50 data points)
 - [x] Added command execution titles and human-readable process duration
 - [x] Implemented dynamic backend loading for cross-platform portability (Windows fix)
 - [x] Switched configuration format from YAML to JSONC (JSON with comments)

### Market Features Implementation

- [x] Part 1: Database & Storage - Added `type` and `priority` columns to symbols table, created `market_features` table with all 8 feature columns, implemented `saveMarketFeatures()` and `getMarketFeatures()` methods, added market features to delete/clear operations
- [x] Part 2: Configuration - Added SymbolType, MarketFeatures, and FeatureConfig types, extended ConfigSchema with MarketSchema and ABTestingSchema, added 7 market indices to defaults.json
- [x] Part 3: Market Feature Engine - Created `src/compute/market-features.ts` with MarketFeatureEngineer class, implemented all 8 feature calculations (marketReturn, relativeReturn, beta, indexCorrelation, vix, volatilitySpread, marketRegime, distanceFromMA)
- [x] Part 4: Enhanced Model & Training - Added featureConfig parameter to LstmModel constructor, updated buildModel() to use dynamic feature count (64 units), updated train.ts and persistence.ts to pass featureConfig
- [x] Part 5: Update init.ts for auto-adding market indices on initialization
- [x] Part 6: Integration Testing with end-to-end verification
- [x] Part 7: Documentation updates (README.md and AGENTS.md finalization)

### Market Context Features

**8 Market Features Implemented:**

1. **marketReturn** - Daily percentage change of S&P 500
2. **relativeReturn** - Stock return minus market return (outperformance indicator)
3. **beta** - 30-day rolling sensitivity to market
4. **indexCorrelation** - 20-day rolling correlation with S&P 500
5. **vix** - Current VIX level (volatility index)
6. **volatilitySpread** - Stock volatility minus market volatility
7. **marketRegime** - BULL/BEAR/NEUTRAL based on 200/50-day MAs
8. **distanceFromMA** - S&P 500 % distance from 200-day MA

**7 Market Indices Added:**

1. ^GSPC - S&P 500 (INDEX, priority: 1)
2. ^DJI - Dow Jones Industrial (INDEX, priority: 2)
3. ^IXIC - NASDAQ Composite (INDEX, priority: 3)
4. ^VIX - CBOE Volatility Index (VOLATILITY, priority: 10)
5. ^FTSE - FTSE 100 (INDEX, priority: 4)
6. ^GDAXI - DAX Performance (INDEX, priority: 5)
7. ^N225 - Nikkei 225 (INDEX, priority: 6)

- [x] Integration Tests
- [x] Documentation (Finalized instructions)

## Current Status: Completed - Market Features Implementation

### ✅ Completed - Core Project

- All core functional modules (Gather, Compute, Output)
- Transitioned to SQLite for historical data and model metadata
- Implemented `export` and `import` commands for database portability
- Implemented **Incremental Data Gathering** using the modern `chart()` API
- Added strict **Null Filtering** for financial data integrity
- Type refactoring (exclusive use of `type` over `interface`)
- Elimination of `any` types in core modules
- Strictest possible TypeScript and ESLint configuration (Zero Errors)
- Global `--config` support with dynamic path resolution
- Unit tests for all modules with >90% coverage
- Updated default data range to 9999 years for maximum history
- Fixed default symbol list (added company names and corrected Samsung ticker)
- Integrated company names throughout the DB, logic, and HTML reports
- Enhanced CLI feedback to show company names during gathering, training, and prediction
- Cleaned up CLI output by removing redundant checkmarks
- Enabled native hardware acceleration via `@tensorflow/tfjs-node`
- Fixed training crashes related to Node.js 24 compatibility and date normalization
- Added immediate exit on `Ctrl-C` (SIGINT) without saving incomplete state
- Implemented `--init` flags for both `gather` and `train` to manage state effectively
- Merged `retrain` functionality into `train --init` for a cleaner CLI interface
- Optimized `--quick-test` mode (3 symbols, 50 data points)
- Added command execution titles and human-readable process duration
- Implemented dynamic backend loading for cross-platform portability (Windows fix)

### ✅ Completed - Market Features Implementation

- [x] Part 1: Database & Storage (25 min) - Added `type` and `priority` columns to symbols table, created `market_features` table, implemented `saveMarketFeatures()` and `getMarketFeatures()` methods, added market features to delete/clear operations
- [x] Part 2: Configuration (10 min) - Added SymbolType, MarketFeatures, and FeatureConfig types, extended ConfigSchema with Market/ABTesting sections, added 7 market indices to defaults.json
- [x] Part 3: Market Feature Engine (35 min) - Created `src/compute/market-features.ts` with MarketFeatureEngineer class, implemented all 8 feature calculations (marketReturn, relativeReturn, beta, indexCorrelation, vix, volatilitySpread, marketRegime, distanceFromMA)
- [x] Part 4: Enhanced Model & Training (60 min) - Added featureConfig parameter to LstmModel constructor, updated buildModel() to use dynamic feature count (64 units instead of 50), updated train/persistence.ts to pass featureConfig.
- [x] Part 5: Verification & Documentation (10 min) - Verified market feature calculation and normalization.
- [x] Part 6: Update init.ts for auto-adding market indices (10 min) - Modified init.ts to seed database with 7 default indices.
- [x] Part 6: Integration Testing with end-to-end verification (20 min) - Verified data flow from sync -> features -> train -> predict.
- [x] Part 7: Documentation updates (README.md and AGENTS.md finalization) (10 min) - Updated documentation.

### 🔄 Market Context Features

**8 Market Features Implemented:**

1. **marketReturn** - Daily percentage change of S&P 500
2. **relativeReturn** - Stock return minus market return (outperformance indicator)
3. **beta** - 30-day rolling sensitivity to market
4. **indexCorrelation** - 20-day rolling correlation with S&P 500
5. **vix** - Current VIX level (volatility index)
6. **volatilitySpread** - Stock volatility minus market volatility
7. **marketRegime** - BULL/BEAR/NEUTRAL based on 200/50-day MAs
8. **distanceFromMA** - S&P 500 % distance from 200-day MA

**7 Market Indices Added:**

1. ^GSPC - S&P 500 (INDEX, priority: 1)
2. ^DJI - Dow Jones Industrial (INDEX, priority: 2)
3. ^IXIC - NASDAQ Composite (INDEX, priority: 3)
4. ^VIX - CBOE Volatility Index (VOLATILITY, priority: 10)
5. ^FTSE - FTSE 100 (INDEX, priority: 4)
6. ^GDAXI - DAX Performance (INDEX, priority: 5)
7. ^N225 - Nikkei 225 (INDEX, priority: 6)

Estimated Time Remaining: ~90 minutes
Total Actual Time Elapsed: ~60 minutes

---

## ML Engine Improvements (Future Work)

### Implementation Priority
**Phase 1 (Critical - Data Leakage & Confidence):**
1. Fix validation strategy (walk-forward)
2. Implement real confidence calculation
3. Add basic technical indicators

**Phase 2 (High Impact):**
4. Hyperparameter optimization
5. Model architecture variations
6. Feature engineering expansion

**Phase 3 (Advanced):**
7. Ensemble methods
8. Advanced regularization
9. Performance tracking/backtesting

---

### 1. Feature Engineering Module (High Priority)

**Current:** Only uses close prices
**Missing:** Technical indicators that provide market context

**Add:**
- Technical Indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, OBV
- Price Transformations: Log returns, percentage changes, price momentum
- Volatility Measures: Rolling std dev, historical volatility
- Time Features: Day of week, month, quarter effects
- Volume Features: Volume changes, volume-weighted price

**Files to modify:** `src/gather/yahoo-finance.ts` (add feature extraction), `src/types/index.ts` (new types), `src/config/schema.ts` (feature config)

---

### 2. Model Architecture Enhancements (High Priority)

**Current:** Basic 2-layer LSTM with 50 units each
**Limitation:** Single architecture, no variation

**Add:**
- Alternative Architectures:
  - GRU cells (faster training, fewer parameters)
  - Bidirectional LSTM (access to future context)
  - Stacked LSTM with residual connections
  - 1D Conv layers before LSTM (feature extraction)
- Attention Mechanisms: Self-attention layers for better feature focus
- Configurable Architecture: Allow different architectures via config

**Files to modify:** `src/compute/lstm-model.ts`, `src/config/schema.ts`

---

### 3. Validation Strategy (Critical - Data Leakage Issue)

**Current:** Simple 90/10 train-validation split with random shuffle
**Problem:** Time series data shouldn't be shuffled! This causes look-ahead bias

**Fix:**
- Walk-forward validation: Rolling window approach
- Time series cross-validation: Expanding window CV
- Hold-out test set: Last 20% of data never seen during training

**Files to modify:** `src/compute/lstm-model.ts`, `src/cli/commands/train.ts`

---

### 4. Hyperparameter Optimization (High Priority)

**Current:** Fixed hyperparameters in config
**Missing:** Automated optimization

**Add:**
- Grid Search: Systematic hyperparameter exploration
- Bayesian Optimization: More efficient search (using tune or Optuna)
- Parameters to tune: Learning rate, batch size, hidden units, dropout, window size

**Files to add:** `src/compute/hyperparameter-tuner.ts`, new CLI command `optimize`

---

### 5. Confidence Calculation (Critical)

**Current:** Hardcoded confidence: 0.8 placeholder
**Problem:** Fake confidence values mislead users

**Fix:**
- Validation-based confidence: Use MAE/RMSE from validation set
- Prediction intervals: Calculate uncertainty bounds
- Ensemble variance: If using multiple models, use variance
- Formula: `confidence = max(0.1, min(0.95, 1 - (mae / price))`

**Files to modify:** `src/compute/prediction.ts` (line 61)

---

### 6. Ensemble Methods (Medium Priority)

**Current:** Single model per symbol
**Improvement:** Multiple models = better generalization

**Add:**
- Bagging: Train multiple models with different seeds
- Architecture ensembling: LSTM + GRU + CNN predictions
- Weight averaging: Performance-based model weights

**Files to add:** `src/compute/ensemble.ts`

---

### 7. Regularization Improvements (Medium Priority)

**Current:** Fixed 0.2 dropout rate
**Improvements:** Better stability and generalization

**Add:**
- Learning Rate Scheduling: Reduce on plateau
- Gradient Clipping: Prevent exploding gradients
- Batch Normalization: Stabilize training
- L1/L2 Regularization: Prevent overfitting
- Early Stopping: Already implemented, improve metrics

**Files to modify:** `src/compute/lstm-model.ts`

---

### 8. Prediction Horizon Optimization (Low Priority)

**Current:** Predict all days in one sequence
**Improvement:** Better multi-step accuracy

**Add:**
- Teacher forcing: Use actual values for better multi-step
- Recursive prediction with correction: Update predictions periodically

**Files to modify:** `src/compute/lstm-model.ts`, `src/compute/prediction.ts`

---

### 9. Data Quality Pipeline (Low Priority)

**Current:** Basic null filtering
**Add:**
- Outlier detection: Remove extreme price movements
- Data validation: Check for stock splits, dividends
- Imputation: Smart missing data handling

**Files to modify:** `src/gather/yahoo-finance.ts`

---

### 10. Performance Tracking (Low Priority)

**Current:** Basic loss tracking
**Add:**
- Backtesting: Simulate trading performance
- Sharpe Ratio: Risk-adjusted returns
- Win Rate: Percentage of correct directional predictions
- PnL Tracking: Actual profit/loss from signals

**Files to add:** `src/compute/backtester.ts`

---

### 11. Real-time Updates (Low Priority)

**Current:** Batch training only
**Add:**
- Incremental learning: Update models without full retraining
- Online adaptation: Adjust to market regimes
- Model versioning: Track performance over time

**Files to modify:** `src/compute/lstm-model.ts`, `src/cli/commands/train.ts`

---

## Overall Implementation Priority

**Phase 1 (Critical - Data Leakage & Confidence):**
1. Fix validation strategy (walk-forward)
2. Implement real confidence calculation
3. Add basic technical indicators

**Phase 2 (High Impact):**
4. Hyperparameter optimization
5. Model architecture variations
6. Feature engineering expansion

**Phase 3 (Advanced):**
7. Ensemble methods
8. Advanced regularization
9. Performance tracking/backtesting
