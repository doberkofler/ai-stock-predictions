# AI Stock Predictions CLI

A professional TypeScript CLI application for stock price prediction using TensorFlow.js LSTM (Long Short-Term Memory) models.

## 🚀 Features

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
Create the default `config.json` and necessary directory structure:
```bash
npm start init
```

### 2. Gather Data
Fetch historical stock data for all symbols in your configuration:
```bash
npm start gather
# or perform a full refresh
npm start gather -- --full
```

### 3. Train Models
Train fresh LSTM models using all available data:
```bash
npm start train
```

### 4. Predict & Report
Generate predictions based on the latest gathered data and existing models:
```bash
npm start predict
```
The report will be saved in the `output/` directory as `index.html`.

### 5. Data Management
Export or import your relational databases to/from a single JSON file:
```bash
npm start export [path]
npm start import [path]
```

## ⚙️ Configuration

All settings are managed via `config.json`. You can also specify a custom configuration file:
```bash
npm start -- --config my-portfolio.json gather
```

### Quick Test Mode
For rapid verification of the entire pipeline, use the `--quick-test` flag:
```bash
npm start gather -- --quick-test
npm start train -- --quick-test
```
This limits the run to 3 symbols and the most recent 50 data points.

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
