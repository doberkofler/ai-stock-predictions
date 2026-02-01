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

## 2. CLI Workflow & Commands

Agents MUST verify changes using these commands:

### Core Commands

- `npm run dev` / `node src/index.ts [command]`: Run the application.
- `npm run ci`: Full verification (Typecheck + Lint + Test Coverage).
- `npm run typecheck`: `npx tsc --noEmit`.
- `npm run lint`: `npx eslint src --ext .ts`.
- `npm run format`: `npx prettier --write src/**/*.ts`.

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
- **Assertions**: Minimal use of `as`. If used, add a comment explaining why it's necessary.
- **No Any**: `any` type is strictly forbidden. Use `unknown` if type is truly unknown before validation.

### Error Handling

- **Throw Early**: Throw on all error conditions. Do not return error objects as values.
- **Type Guards**: Use custom type guards for safe data handling after validation.
- **Contextual Errors**: Use `src/cli/utils/errors.ts` to wrap errors with context.

## 4. Module Architecture

- **Gather**: Yahoo Finance API integration and `SqliteStorage` persistence.
- **Compute**: TensorFlow.js LSTM models. Persistence in `./models/`.
- **Output**: Static `index.html` generation with Chart.js visualization.

## 5. Verification Protocol

For every modification, the agent MUST execute:

1. `npx eslint [path]`
2. `npx tsc --noEmit`
3. `npx vitest run [relevant_tests]`
4. `npx prettier --write [path]`

## 6. Implementation Progress

- [x] Project Foundation (ES2024, Vitest 4, Node.js 24)
- [x] Configuration System (Zod validation, defaults)
- [x] CLI Framework (5 commands: init, gather, train, retrain, predict, export, import)
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
- [x] Added `gather --init` to allow clearing data before gathering
- [x] Added command execution titles and human-readable process duration
- [ ] Integration Tests
- [ ] Documentation (Finalized instructions)

## Current Status: 100% Complete (Migration & Optimization)

### ✅ Completed

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

Estimated Time Remaining: 0 minutes
Total Estimated Time Remaining: 0 minutes

