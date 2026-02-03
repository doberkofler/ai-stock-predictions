import {Command} from 'commander';

import {exportCommand} from './cli/commands/export.ts';
import {importCommand} from './cli/commands/import.ts';
import {initCommand} from './cli/commands/init.ts';
import {predictCommand} from './cli/commands/predict.ts';
import {symbolAddCommand, symbolDefaultsCommand, symbolListCommand, symbolRemoveCommand} from './cli/commands/symbols.ts';
import {syncCommand} from './cli/commands/sync.ts';
import {trainCommand} from './cli/commands/train.ts';

const program = new Command();

program.name('ai-stock-predictions').description('AI-powered stock price prediction using LSTM neural networks').version('1.0.0');

// Global options
program.option('-c, --config <path>', 'path to configuration file', 'config.jsonc');

program
	.command('init')
	.description('Initialize project structure and create default configuration')
	.option('-f, --force', 'overwrite existing configuration and wipe all data', false)
	.action(async (options: {force: boolean}) => {
		const programOptions = program.opts<{config: string}>();
		await initCommand(programOptions.config, options.force);
	});

program
	.command('symbol-add')
	.description('Add new symbols to the portfolio and sync historical data')
	.argument('<symbols>', 'comma-separated list of symbols (e.g., AAPL,MSFT)')
	.action(async (symbols: string) => {
		const programOptions = program.opts<{config: string}>();
		await symbolAddCommand(programOptions.config, symbols);
	});

program
	.command('symbol-remove')
	.description('Remove symbols and associated data/models from the portfolio')
	.argument('<symbols>', 'comma-separated list of symbols to remove')
	.action(async (symbols: string) => {
		const programOptions = program.opts<{config: string}>();
		await symbolRemoveCommand(programOptions.config, symbols);
	});

program
	.command('symbol-defaults')
	.description('Add default symbols and sync historical data')
	.action(async () => {
		const programOptions = program.opts<{config: string}>();
		await symbolDefaultsCommand(programOptions.config);
	});

program
	.command('symbol-list')
	.description('Display detailed status of all symbols in the portfolio')
	.action(async () => {
		const programOptions = program.opts<{config: string}>();
		await symbolListCommand(programOptions.config);
	});

program
	.command('sync')
	.description('Update historical market data for all symbols in the portfolio')
	.action(async () => {
		const programOptions = program.opts<{config: string}>();
		await syncCommand(programOptions.config);
	});

program
	.command('train')
	.description('Train LSTM models for the symbols in the portfolio')
	.option('-q, --quick-test', 'run with limited data and epochs for rapid verification', false)
	.option('-s, --symbols <list>', 'comma-separated list of specific symbols to train')
	.action(async (options: {quickTest: boolean; symbols?: string}) => {
		const programOptions = program.opts<{config: string}>();
		await trainCommand(programOptions.config, options.quickTest, options.symbols);
	});

program
	.command('predict')
	.description('Generate future price forecasts and HTML reports')
	.option('-q, --quick-test', 'run with limited symbols and forecast window', false)
	.option('-s, --symbols <list>', 'comma-separated list of specific symbols to predict')
	.action(async (options: {quickTest: boolean; symbols?: string}) => {
		const programOptions = program.opts<{config: string}>();
		await predictCommand(programOptions.config, options.quickTest, options.symbols);
	});

program
	.command('export')
	.description('Export databases to a JSON file for portability')
	.argument('[path]', 'path to the export file', 'export.json')
	.action(async (path: string) => {
		const programOptions = program.opts<{config: string}>();
		await exportCommand(programOptions.config, path);
	});

program
	.command('import')
	.description('Import databases from a JSON file (overwrites existing)')
	.argument('[path]', 'path to the import file', 'export.json')
	.action(async (path: string) => {
		const programOptions = program.opts<{config: string}>();
		await importCommand(programOptions.config, path);
	});

// Parse command line arguments
program.parse(process.argv);
