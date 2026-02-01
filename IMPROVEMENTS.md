# IMPROVEMENTS


## Machine Learning & Compute Module (Priority: High)

### Log-Return Training
Description: Instead of absolute prices, train the model on Daily Log Returns. Raw prices are non-stationary and prone to "look-ahead bias" in normalization.
Impact: Improves generalization significantly.

### Feature Engineering
Description: Incorporate Volume, Volatility (High-Low/Close), and technical indicators like RSI or MACD as additional LSTM input channels.
Impact: Provides more context than just price action.

### Attention Mechanism
Description: Add a Self-Attention or 1D-Attention layer after the LSTM. This helps the model focus on critical historical time steps.
Impact: Better long-term trend awareness.

### Window Normalization
Description: Normalize each sliding window relative to its first element or via Z-score, rather than a global min-max over 2 years.
Impact: Fixes data leakage and scaling issues.


## Data Gathering & Resilience (Priority: Medium)

### Linear Interpolation
Description: Implement a "Gap Fill" utility. Financial APIs often have missing days or "null" values. Current defaults (0) will break ML convergence.
Impact: Prevents training on corrupted data.

### Multi-Source Fallback
Description: Add a secondary data source (e.g., Alpha Vantage) if Yahoo Finance returns empty or throttled responses.
Impact: Higher reliability.


## UI/UX & Output Module (Priority: Medium)

### Historical Context
Description: Overlay the last 30–60 days of actual data on the interactive charts to provide context for the prediction.
Impact: Essential for visual validation.

### Confidence Ribbons
Description: Visualize the prediction uncertainty (using MAE) as a shaded area around the prediction line. 
Impact: Better risk communication.

### Signal Dashboard
Description: Add a sortable/filterable summary table at the top of the report to quickly find high-confidence "BUY" or "SELL" signals.
Impact: Better usability.

## Developer Experience & Logic (Priority: Low)

### Backtesting Command
Description: Implement a backtest command. This simulates trading based on the model's past "next-day" predictions to calculate a hypothetical ROI.
Impact: The only way to prove if the model works.

### Unified Command
Description: Add a sync or run-all command that sequentially runs gather, train, and predict for a seamless daily update.
Impact: Better DX.

### Model Drift Detection
Description: Lower confidence automatically if recent (last 5 days) real prices differ significantly from the model's past predictions.
Impact: Smart risk management.
