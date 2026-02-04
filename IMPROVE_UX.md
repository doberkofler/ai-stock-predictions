# AI Stock Predictions - UX Enhancement Proposals

## CLI UX

## Developer Experience & Logic (Priority: Low)

### Backtesting Command
Description: Implement a backtest command. This simulates trading based on the model's past "next-day" predictions to calculate a hypothetical ROI.
Impact: The only way to prove if the model works.

### Model Drift Detection
Description: Lower confidence automatically if recent (last 5 days) real prices differ significantly from the model's past predictions.
Impact: Smart risk management.
