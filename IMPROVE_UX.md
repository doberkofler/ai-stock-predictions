# AI Stock Predictions - UX Enhancement Proposals

## CLI UX

### Change export/import command 
Simplify export/import to only care about the symbols and the history.
All other data is redundant and only the data actually defined by the user should and must be serialized.

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

### HTML Templating
Description: Simplify the HTML generation by splitting it into multiple modules. The HTML could be stored in an external file and the JavaScript code as well.
The files could then be read and then combined. We should take advantage of eslint and lint the html and the js.
