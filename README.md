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

### Quick Start

Complete workflow from initialization to predictions:
```bash
# 1. Create workspace and default configuration file
node src/index.ts init

# 2. Add your stock symbols
node src/index.ts symbol-add AAPL,NVDA,TSLA

# 3. Download historical data for all symbols
node src/index.ts sync

# 4. Train models
node src/index.ts train

# 5. Optional: Optimize hyperparameters for a symbol
node src/index.ts tune AAPL

# 6. Optional: Evaluate strategy performance
node src/index.ts backtest AAPL

# 7. Generate predictions and report
node src/index.ts predict
```
The workspace defaults to the `data/` directory. The report will be saved in the `data/output/` directory as `index.html`.

### Command Details

#### 1. Initialize
Create the workspace and default `config.jsonc`:
```bash
node src/index.ts init
```
This command creates the workspace directory and the configuration file. All other initialization (database creation, market indices) happens dynamically when first needed. For example, running `symbol-add` or `sync` will automatically set up the database.

#### 2. Add Symbols
Add stock symbols to your portfolio:
```bash
node src/index.ts symbol-add AAPL,MSFT,GOOGL
```
Or add default symbols (top 100 global companies):
```bash
node src/index.ts symbol-defaults
```

#### 3. Sync Data
Download historical data for ALL symbols in the database:
```bash
node src/index.ts sync
```
This command fetches data for both market indices and stocks.

#### 4. Train Models
Train fresh LSTM models using all available data:
```bash
node src/index.ts train
```

#### 5. Predict & Generate Report
Generate predictions and interactive HTML report:
```bash
node src/index.ts predict
```

#### 6. Hyperparameter Tuning (Optional)
Optimize LSTM parameters for a specific symbol using Grid Search:
```bash
node src/index.ts tune AAPL
```

#### 7. Backtesting (Optional)
Evaluate trading strategy performance over historical data:
```bash
node src/index.ts backtest AAPL --days 252
```

### 8. Symbol Management
List all symbols in your portfolio:
```bash
node src/index.ts symbol-list
```

Remove symbols from your portfolio:
```bash
node src/index.ts symbol-remove AAPL,MSFT
```

### 7. Data Management
Export or import your relational databases to/from a single JSON file:
```bash
node src/index.ts export [path]
node src/index.ts import [path]
```

## ⚙️ Configuration

All settings are managed via `config.jsonc` (JSON with comments). The configuration file is always stored within the workspace directory. You can specify a custom workspace directory:
```bash
node src/index.ts --workspace-dir ./my-portfolio sync
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

## 🐳 Docker Deployment

Docker support uses a **self-contained image** with **named volumes** for persistent data, eliminating volume mount conflicts and providing a clean separation between application code (immutable) and runtime data (mutable).

### Docker Quick Start

Complete workflow using npm scripts:

```bash
# 1. Build the Docker image
npm run docker:build

# 2. Initialize workspace and configuration (required first time)
npm run docker:init

# 3. Add your stock symbols
npm run docker:symbol-add AAPL,NVDA,TSLA

# 4. Download historical data for all symbols
npm run docker:sync

# 5. Train models
npm run docker:train

# 6. Generate predictions
npm run docker:predict

# 7. Extract results to local directory
npm run docker:copy-output    # Copies data/output/index.html to ./docker-output/
npm run docker:copy-export    # Copies data/export.json to ./docker-export/
```

Open `./docker-output/index.html` in your browser to view the prediction report.

### Docker-Compose Alternative

For simplified multi-command workflows:

```bash
# Build the image
docker-compose build

# Run commands
docker-compose run --rm app init --force
docker-compose run --rm app symbol-add AAPL,NVDA,TSLA
docker-compose run --rm app sync
docker-compose run --rm app train
docker-compose run --rm app predict

# Extract results (same as above)
npm run docker:copy-output
npm run docker:copy-export
```

### Docker NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run docker:build` | Build the self-contained Docker image |
| `npm run docker:init` | Create default configuration file |
| `npm run docker:symbol-add` | Add stock symbols (prompts for input) |
| `npm run docker:symbol-defaults` | Add default portfolio (top 100 companies) |
| `npm run docker:sync` | Download historical data for all symbols |
| `npm run docker:train` | Train LSTM models |
| `npm run docker:predict` | Generate predictions and HTML report |
| `npm run docker:copy-output` | Copy output files to `./docker-output/` |
| `npm run docker:copy-export` | Copy export.json to `./docker-export/` |
| `npm run docker:shell` | Open interactive shell in container (debugging) |
| `npm run docker:clean-volumes` | Delete all named volumes (reset data) |
| `npm run docker:save` | Export image to `ai-stock-predictions.tar` |

### Named Volumes

Data persists across container runs using a named Docker volume:

| Volume Name | Container Path | Purpose |
|-------------|---------------|---------|
| `ai-stock-data` | `/app/data` | Workspace (config, database, models, output) |

**Key Benefits:**
- ✅ **Persistent**: Data survives container restarts
- ✅ **Isolated**: Multiple projects can use different named volumes
- ✅ **Performance**: No filesystem translation overhead (vs bind mounts)
- ✅ **Clean**: Code is baked into image (immutable), data is separate (mutable)

### Volume Management

```bash
# List all volumes
docker volume ls | grep ai-stock

# Inspect volume details
docker volume inspect ai-stock-data

# Backup volumes (example for data volume)
docker run --rm -v ai-stock-data:/data -v $(pwd)/backup:/backup alpine tar czf /backup/ai-stock-data.tar.gz -C /data .

# Restore volumes (example for data volume)
docker run --rm -v ai-stock-data:/data -v $(pwd)/backup:/backup alpine tar xzf /backup/ai-stock-data.tar.gz -C /data

# Delete all volumes (WARNING: Deletes all data!)
npm run docker:clean-volumes
# or
docker volume rm ai-stock-data
```

### Architecture: Self-Contained vs Bind Mounts

**This project uses a self-contained approach:**

```bash
# ✅ CORRECT (Self-contained with named volumes)
npm run docker:init
# Runs: docker run --rm -it -v ai-stock-data:/app/data ... ai-stock-predictions:latest init

# ❌ INCORRECT (Old approach with bind mounts - DEPRECATED)
docker run --rm -it -v $(PWD):/app ai-stock-predictions:latest init
# This overwrites the container's /app directory with host files, breaking dependencies
```

**Why Self-Contained?**
- **No volume conflicts**: Named volumes don't overwrite container internals
- **No dependency issues**: `node_modules` stay intact inside the container
- **Production-ready**: Same image runs everywhere (dev, CI, prod)
- **Clean separation**: Code changes require rebuild (enforces discipline)
- **Easy extraction**: Helper scripts copy results to host when needed

### Troubleshooting

#### "Cannot find module '/app/src/index.ts'"
❌ **Cause**: Using bind mount `-v $(PWD):/app` which overwrites the container's `/app` directory.  
✅ **Fix**: Use the npm scripts (`npm run docker:init`) or named volumes as shown above.

#### View container logs with full output
```bash
# Enable debug output (shows spinners and progress)
docker run --rm -it \
  -e DEBUG_UI=true \
  -v ai-stock-data:/app/data \
  ai-stock-predictions:latest sync
```

#### Access container filesystem for debugging
```bash
npm run docker:shell
# Opens an interactive shell inside the container
```

#### Rebuild after code changes
```bash
npm run docker:build
# Source code is baked into the image, so rebuild after any code modifications
```

#### Reset everything and start fresh
```bash
npm run docker:clean-volumes  # Delete all data
npm run docker:build           # Rebuild image
npm run docker:init            # Reinitialize
```

## 🏗️ Tech Stack

-   **Language**: TypeScript (ES2024)
-   **ML Engine**: TensorFlow.js (LSTM)
-   **Database**: SQLite (`better-sqlite3`)
-   **Data Source**: Yahoo Finance API
-   **Visuals**: Chart.js
-   **Validation**: Zod
