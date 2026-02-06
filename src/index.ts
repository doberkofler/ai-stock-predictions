import {Command} from 'commander';

const program = new Command();

program.name('ai-stock-predictions').description('AI-powered stock price prediction using LSTM neural networks').version('1.0.0');

// Global options
program.option('-w, --workspace-dir <path>', 'path to the workspace directory', 'data');

program
	.command('init')
	.description('Create default configuration file')
	.option('-f, --force', 'overwrite existing configuration and wipe all data', false)
	.action(async (options: {force: boolean}) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {initCommand} = await import('./cli/commands/init.ts');
		await initCommand(programOptions.workspaceDir, options.force);
	});

program
	.command('symbol-add')
	.description('Add new symbols to the portfolio')
	.argument('<symbols>', 'comma-separated list of symbols (e.g., AAPL,MSFT)')
	.action(async (symbols: string) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {symbolAddCommand} = await import('./cli/commands/symbols.ts');
		await symbolAddCommand(programOptions.workspaceDir, symbols);
	});

program
	.command('symbol-remove')
	.description('Remove symbols and associated data/models from the portfolio')
	.argument('<symbols>', 'comma-separated list of symbols to remove')
	.action(async (symbols: string) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {symbolRemoveCommand} = await import('./cli/commands/symbols.ts');
		await symbolRemoveCommand(programOptions.workspaceDir, symbols);
	});

program
	.command('symbol-defaults')
	.description('Add default symbols to the portfolio')
	.action(async () => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {symbolDefaultsCommand} = await import('./cli/commands/symbols.ts');
		await symbolDefaultsCommand(programOptions.workspaceDir);
	});

program
	.command('symbol-list')
	.description('Display detailed status of all symbols in the portfolio')
	.action(async () => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {symbolListCommand} = await import('./cli/commands/symbols.ts');
		await symbolListCommand(programOptions.workspaceDir);
	});

program
	.command('symbol-import')
	.description('Import a symbol and its history from a JSON file')
	.argument('<path>', 'path to the JSON file')
	.action(async (path: string) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {symbolImportCommand} = await import('./cli/commands/symbols.ts');
		await symbolImportCommand(programOptions.workspaceDir, path);
	});

program
	.command('sync')
	.description('Update historical market data for all symbols in the portfolio')
	.action(async () => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {syncCommand} = await import('./cli/commands/sync.ts');
		await syncCommand(programOptions.workspaceDir);
	});

program
	.command('train')
	.description('Train LSTM models for the symbols in the portfolio')
	.option('-q, --quick-test', 'run with limited data and epochs for rapid verification', false)
	.option('-s, --symbols <list>', 'comma-separated list of specific symbols to train')
	.action(async (options: {quickTest: boolean; symbols?: string}) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {trainCommand} = await import('./cli/commands/train.ts');
		await trainCommand(programOptions.workspaceDir, options.quickTest, options.symbols);
	});

program
	.command('tune')
	.description('Find optimal hyperparameters for a specific symbol')
	.argument('<symbol>', 'The stock symbol to tune (e.g., AAPL)')
	.action(async (symbol: string) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {tuneCommand} = await import('./cli/commands/tune.ts');
		await tuneCommand(programOptions.workspaceDir, symbol);
	});

program
	.command('predict')
	.description('Generate future price forecasts and HTML reports')
	.option('-q, --quick-test', 'run with limited symbols and forecast window', false)
	.option('-s, --symbols <list>', 'comma-separated list of specific symbols to predict')
	.action(async (options: {quickTest: boolean; symbols?: string}) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {predictCommand} = await import('./cli/commands/predict.ts');
		await predictCommand(programOptions.workspaceDir, options.quickTest, options.symbols);
	});

program
	.command('backtest')
	.description('Evaluate trading strategy based on historical predictions')
	.option('-s, --symbols <list>', 'comma-separated list of specific symbols to backtest')
	.option('-d, --days <number>', 'number of historical days to backtest', '252')
	.action(async (options: {days: string; symbols?: string}) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {backtestCommand} = await import('./cli/commands/backtest.ts');
		await backtestCommand(programOptions.workspaceDir, options.symbols, Number.parseInt(options.days, 10));
	});

program
	.command('export')
	.description('Export databases to a JSON file for portability')
	.argument('[path]', 'path to the export file', 'export.json')
	.action(async (path: string) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {exportCommand} = await import('./cli/commands/export.ts');
		await exportCommand(programOptions.workspaceDir, path);
	});

program
	.command('import')
	.description('Import databases from a JSON file (overwrites existing)')
	.argument('[path]', 'path to the import file', 'export.json')
	.action(async (path: string) => {
		const programOptions = program.opts<{workspaceDir: string}>();
		const {importCommand} = await import('./cli/commands/import.ts');
		await importCommand(programOptions.workspaceDir, path);
	});

// Parse command line arguments
program.parse(process.argv);
