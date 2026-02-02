import {Command} from 'commander';
import {initCommand} from './cli/commands/init.ts';
import {gatherCommand} from './cli/commands/gather.ts';
import {trainCommand} from './cli/commands/train.ts';
import {predictCommand} from './cli/commands/predict.ts';
import {exportCommand} from './cli/commands/export.ts';
import {importCommand} from './cli/commands/import.ts';
import {portfolioCommand} from './cli/commands/portfolio.ts';

const program = new Command();

program.name('ai-stock-predictions').description('AI-powered stock price prediction using LSTM neural networks').version('1.0.0');

// Global options
program
	.option('-c, --config <path>', 'path to configuration file', 'config.yaml')
	.option('--quick-test', 'run with limited data for rapid verification', false);

program
	.command('init')
	.description('Initialize project structure and create default configuration')
	.action(async () => {
		const options = program.opts<{config: string}>();
		await initCommand(options.config);
	});

program
	.command('gather')
	.description('Gather new stock data from Yahoo Finance API')
	.option('--init', 'clear all existing data before gathering', false)
	.action(async (options: {init: boolean}) => {
		const programOptions = program.opts<{config: string; quickTest: boolean}>();
		await gatherCommand(programOptions.config, programOptions.quickTest, options.init);
	});

program
	.command('train')
	.description('Train models from scratch using all available data')
	.option('-s, --symbols <list>', 'comma-separated list of symbols to train')
	.action(async (options: {symbols?: string}) => {
		const programOptions = program.opts<{config: string; quickTest: boolean}>();
		await trainCommand(programOptions.config, programOptions.quickTest, options.symbols);
	});

program
	.command('predict')
	.description('Generate predictions and create HTML reports')
	.option('-s, --symbols <list>', 'comma-separated list of symbols to predict')
	.action(async (options: {symbols?: string}) => {
		const programOptions = program.opts<{config: string}>();
		await predictCommand(programOptions.config, options.symbols);
	});

program
	.command('export')
	.description('Export databases to a JSON file for portability')
	.argument('[path]', 'path to the export file', 'export.json')
	.action(async (path: string) => {
		await exportCommand(path);
	});

program
	.command('import')
	.description('Import databases from a JSON file (overwrites existing)')
	.argument('[path]', 'path to the import file', 'export.json')
	.action(async (path: string) => {
		await importCommand(path);
	});

program
	.command('portfolio')
	.description('Manage the list of symbols in the database')
	.option('--add-defaults', 'add default symbols to the database', false)
	.option('--add <list>', 'comma-separated list of symbols to add')
	.option('--remove <list>', 'comma-separated list of symbols to remove')
	.option('-l, --list', 'show detailed tabular list of all symbols', false)
	.action(async (options: {addDefaults?: boolean; add?: string; remove?: string; list?: boolean}) => {
		const programOptions = program.opts<{config: string}>();
		await portfolioCommand(programOptions.config, options);
	});

// Parse command line arguments
program.parse(process.argv);
