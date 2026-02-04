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

### Command Workflow (Separation of Concerns)

**IMPORTANT**: Symbol commands and data sync are now separate:
- `symbol-add` / `symbol-defaults` - ONLY add symbols to the database registry
- `sync` - Downloads historical data for ALL symbols in the database

**Correct Workflow:**
```bash
node src/index.ts init --force           # Creates config + adds market indices to DB
node src/index.ts symbol-add AAPL,NVDA   # Adds stocks to DB (no sync)
node src/index.ts sync                   # Downloads data for ALL symbols
node src/index.ts train                  # Trains models
node src/index.ts predict                # Generates predictions
```

**Why This Design:**
- Market indices (^GSPC, ^VIX) must exist in DB before syncing stocks
- Stocks require market index data for feature calculation (beta, correlation, etc.)
- Separating add/sync prevents race conditions and allows batch operations

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
