#!/usr/bin/env node

/**
 * AI Stock Predictions CLI Application
 * Entry point for the stock price prediction tool
 */

import util from 'node:util';
import {initializeEnvironment} from './env.ts';

// Polyfills for Node.js 23+ compatibility with older tfjs-node versions
if (!('isNullOrUndefined' in util)) {
	// We use 'as unknown as' to safely inject the polyfill into the core module
	(util as unknown as Record<string, unknown>).isNullOrUndefined = (val: unknown): val is null | undefined => {
		return val === null || val === undefined;
	};
}

if (!('isArray' in util)) {
	// We use 'as unknown as' to safely inject the polyfill into the core module
	(util as unknown as Record<string, unknown>).isArray = (val: unknown): val is unknown[] => {
		return Array.isArray(val);
	};
}

import {Command} from 'commander';
import {initCommand} from './cli/commands/init.ts';
import {gatherCommand} from './cli/commands/gather.ts';
import {trainCommand} from './cli/commands/train.ts';
import {predictCommand} from './cli/commands/predict.ts';
import {exportCommand} from './cli/commands/export.ts';
import {importCommand} from './cli/commands/import.ts';
import {portfolioCommand} from './cli/commands/portfolio.ts';

const program = new Command();

program
	.name('ai-stock-predictions')
	.description('CLI application for stock price prediction using TensorFlow.js LSTM models')
	.version('1.0.0')
	.option('-c, --config <path>', 'path to configuration file', 'config.json')
	.option('--quick-test', 'run with 3 symbols and 50 data points for verification', false);

// Register CLI commands
program
	.command('init')
	.description('Initialize configuration file with default values')
	.action(async () => {
		await initializeEnvironment();
		const options = program.opts<{config: string}>();
		await initCommand(options.config);
	});

program
	.command('gather')
	.description('Gather new stock data from Yahoo Finance API')
	.option('--init', 'clear all existing data before gathering', false)
	.action(async (options: {init: boolean}) => {
		await initializeEnvironment();
		const programOptions = program.opts<{config: string; quickTest: boolean}>();
		await gatherCommand(programOptions.config, programOptions.quickTest, options.init);
	});

program
	.command('train')
	.description('Train models from scratch using all available data')
	.option('-s, --symbols <list>', 'comma-separated list of symbols to train')
	.action(async (options: {symbols?: string}) => {
		await initializeEnvironment();
		const programOptions = program.opts<{config: string; quickTest: boolean}>();
		await trainCommand(programOptions.config, programOptions.quickTest, options.symbols);
	});

program
	.command('predict')
	.description('Generate predictions and create HTML reports')
	.option('-s, --symbols <list>', 'comma-separated list of symbols to predict')
	.action(async (options: {symbols?: string}) => {
		await initializeEnvironment();
		const programOptions = program.opts<{config: string}>();
		await predictCommand(programOptions.config, options.symbols);
	});

program
	.command('export')
	.description('Export all databases to a JSON file')
	.argument('[path]', 'path to the export file', 'export.json')
	.action(async (path: string) => {
		await initializeEnvironment();
		await exportCommand(path);
	});

program
	.command('import')
	.description('Import databases from a JSON file (overwrites existing)')
	.argument('[path]', 'path to the import file', 'export.json')
	.action(async (path: string) => {
		await initializeEnvironment();
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
		await initializeEnvironment();
		const programOptions = program.opts<{config: string}>();
		await portfolioCommand(programOptions.config, options);
	});

// Parse command line arguments
program.parse(process.argv);
