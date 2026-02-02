ML Engine Improvements
1. Feature Engineering Module (High Priority)
Current: Only uses close prices
Missing: Technical indicators that provide market context
Add: 
- Technical Indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, OBV
- Price Transformations: Log returns, percentage changes, price momentum
- Volatility Measures: Rolling std dev, historical volatility
- Time Features: Day of week, month, quarter effects
- Volume Features: Volume changes, volume-weighted price
Files to modify: src/gather/yahoo-finance.ts (add feature extraction), src/types/index.ts (new types), src/config/schema.ts (feature config)
2. Model Architecture Enhancements (High Priority)
Current: Basic 2-layer LSTM with 50 units each
Limitation: Single architecture, no variation
Add: 
- Alternative Architectures:
  - GRU cells (faster training, fewer parameters)
  - Bidirectional LSTM (access to future context)
  - Stacked LSTM with residual connections
  - 1D Conv layers before LSTM (feature extraction)
- Attention Mechanisms: Self-attention layers for better feature focus
- Configurable Architecture: Allow different architectures via config
Files to modify: src/compute/lstm-model.ts, src/config/schema.ts
3. Validation Strategy (Critical - Data Leakage Issue)
Current: Simple 90/10 train-validation split with random shuffle
Problem: Time series data shouldn't be shuffled! This causes look-ahead bias
Fix: 
- Walk-forward validation: Rolling window approach
- Time series cross-validation: Expanding window CV
- Hold-out test set: Last 20% of data never seen during training
Files to modify: src/compute/lstm-model.ts, src/cli/commands/train.ts
4. Hyperparameter Optimization (High Priority)
Current: Fixed hyperparameters in config
Missing: Automated optimization
Add:
- Grid Search: Systematic hyperparameter exploration
- Bayesian Optimization: More efficient search (using tune or Optuna)
- Parameters to tune: Learning rate, batch size, hidden units, dropout, window size
Files to add: src/compute/hyperparameter-tuner.ts, new CLI command optimize
5. Confidence Calculation (Critical)
Current: Hardcoded confidence: 0.8 placeholder
Problem: Fake confidence values mislead users
Fix:
- Validation-based confidence: Use MAE/RMSE from validation set
- Prediction intervals: Calculate uncertainty bounds
- Ensemble variance: If using multiple models, use variance
- Formula: confidence = max(0.1, min(0.95, 1 - (mae / price))
Files to modify: src/compute/prediction.ts (line 61)
6. Ensemble Methods (Medium Priority)
Current: Single model per symbol
Improvement: Multiple models = better generalization
Add:
- Bagging: Train multiple models with different seeds
- Architecture ensembling: LSTM + GRU + CNN predictions
- Weight averaging: Performance-based model weights
Files to add: src/compute/ensemble.ts
7. Regularization Improvements (Medium Priority)
Current: Fixed 0.2 dropout rate
Improvements:
- Learning Rate Scheduling: Reduce on plateau
- Gradient Clipping: Prevent exploding gradients
- Batch Normalization: Stabilize training
- L1/L2 Regularization: Prevent overfitting
- Early Stopping: Already implemented, improve metrics
Files to modify: src/compute/lstm-model.ts
8. Prediction Horizon Optimization (Low Priority)
Current: Predict all days in one sequence
Improvement: 
- Teacher forcing: Use actual values for better multi-step
- Recursive prediction with correction: Update predictions periodically
Non-ML Improvements
9. Data Quality Pipeline
Current: Basic null filtering
Add:
- Outlier detection: Remove extreme price movements
- Data validation: Check for stock splits, dividends
- Imputation: Smart missing data handling
10. Performance Tracking
Current: Basic loss tracking
Add:
- Backtesting: Simulate trading performance
- Sharpe Ratio: Risk-adjusted returns
- Win Rate: Percentage of correct directional predictions
- PnL tracking: Actual profit/loss from signals
11. Real-time Updates
Current: Batch training only
Add:
- Incremental learning: Update models without full retraining
- Online adaptation: Adjust to market regimes
- Model versioning: Track performance over time
Implementation Priority
Phase 1 (Critical - Data Leakage & Confidence):
1. Fix validation strategy (walk-forward)
2. Implement real confidence calculation
3. Add basic technical indicators
Phase 2 (High Impact):
4. Hyperparameter optimization
5. Model architecture variations
6. Feature engineering expansion
Phase 3 (Advanced):
7. Ensemble methods
8. Advanced regularization
9. Performance tracking/backtesting