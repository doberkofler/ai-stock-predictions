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

## 6. Current Status

All core features and market features implementation completed (96.1% test coverage).

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

---

## 7. ML Engine Improvements (Future Work)

### Implementation Priority

**Phase 1 (Critical):** Fix validation strategy, implement real confidence calculation, add basic technical indicators  
**Phase 2 (High Impact):** Hyperparameter optimization, model architecture variations, feature engineering expansion  
**Phase 3 (Advanced):** Ensemble methods, advanced regularization, performance tracking/backtesting

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
