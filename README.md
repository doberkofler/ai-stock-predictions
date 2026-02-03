# AI Stock Predictions CLI

A professional TypeScript CLI application for stock price prediction using TensorFlow.js LSTM (Long Short-Term Memory) models.

## 🚀 Features

-   **Market Context**: LSTM models incorporate 8 market features (market returns, relative returns, beta, correlation, VIX, volatility spread, market regime, distance from MA) for more robust predictions.
-   **Modular Architecture**: Clean separation between Data Gathering, Computing, and Output generation.
-   **Native Performance**: Uses `@tensorflow/tfjs-node` for hardware-accelerated training.
-   **Incremental Updates**: Efficiently fetches only missing historical data using the modern Yahoo Finance `chart()` API.
-   **Relational Storage**: High-performance SQLite persistence for historical quotes and model metadata.
-   **Quality First**: Strict Null filtering for financial data integrity and Zod validation at all boundaries.
-   **Interactive Reports**: Generates responsive HTML reports with Chart.js visualizations.
-   **Scalable**: Default configuration includes the top 100 global companies.

## 📋 Prerequisites

-   **Node.js**: v24.0.0 or higher
-   **OS**: macOS, Linux, or Windows

## 🛠️ Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

## 📖 Usage

The application is controlled via a simple set of CLI commands.

### 1. Initialize
Create the default `config.jsonc` and necessary directory structure:
```bash
node src/index.ts init
```

### 2. Gather Data
Fetch historical stock data for all symbols in your configuration:
```bash
node src/index.ts sync
```

### 3. Train Models
Train fresh LSTM models using all available data:
```bash
node src/index.ts train
```

### 4. Predict & Report
Generate predictions based on the latest gathered data and existing models:
```bash
node src/index.ts predict
```
The report will be saved in the `output/` directory as `index.html`.

### 5. Data Management
Export or import your relational databases to/from a single JSON file:
```bash
node src/index.ts export [path]
node src/index.ts import [path]
```

## ⚙️ Configuration

All settings are managed via `config.jsonc` (JSON with comments). You can also specify a custom configuration file:
```bash
node src/index.ts --config my-portfolio.jsonc sync
```

### Market Feature Configuration

The LSTM model can use 8 market context features (all enabled by default):
- `includeMarketReturn`: Daily S&P 500 percentage change
- `includeRelativeReturn`: Stock return minus market return
- `includeBeta`: 30-day rolling market sensitivity
- `includeCorrelation`: 20-day rolling correlation with S&P 500
- `includeVix`: Current VIX volatility index level
- `includeVolatilitySpread`: Stock volatility minus market volatility
- `includeRegime`: Market regime (BULL/BEAR/NEUTRAL) based on moving averages
- `includeDistanceFromMA`: S&P 500 % distance from 200-day MA

To disable specific features, edit `config.jsonc`:
```jsonc
{
  "market": {
    "featureConfig": {
      "enabled": true,
      "includeMarketReturn": true,
      "includeRelativeReturn": true,
      "includeBeta": true,
      "includeCorrelation": true,
      "includeVix": true,
      "includeVolatilitySpread": false,  // Disable this feature
      "includeRegime": true,
      "includeDistanceFromMA": true
    }
  }
}
```

### Quick Test Mode
For rapid verification of the entire pipeline, use the `--quick-test` flag:
```bash
node src/index.ts train --quick-test
node src/index.ts predict --quick-test
```
This limits the run to 3 symbols and the most recent 50 data points for training.

## 🧪 Development

-   **Run Tests**: `npm test`
-   **Coverage**: `npm run test:coverage`
-   **Linting**: `npm run lint`
-   **Typecheck**: `npm run typecheck`
-   **CI Workflow**: `npm run ci` (Runs all checks)

## 🏗️ Tech Stack

-   **Language**: TypeScript (ES2024)
-   **ML Engine**: TensorFlow.js (LSTM)
-   **Database**: SQLite (`better-sqlite3`)
-   **Data Source**: Yahoo Finance API
-   **Visuals**: Chart.js
-   **Validation**: Zod
