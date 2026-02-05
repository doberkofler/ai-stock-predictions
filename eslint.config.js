import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import node from 'eslint-plugin-n';
import promise from 'eslint-plugin-promise';
import regexp from 'eslint-plugin-regexp';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	importX.flatConfigs.recommended,
	importX.flatConfigs.typescript,
	jsdoc.configs['flat/recommended-error'],
	regexp.configs['flat/recommended'],
	unicorn.configs['flat/recommended'],
	sonarjs.configs.recommended,
	promise.configs['flat/recommended'],
	node.configs['flat/recommended-module'],
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: 'warn',
			reportUnusedInlineConfigs: 'warn',
		},
	},
	{
		files: ['**/*.ts'],
		rules: {
			// TypeScript
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{
					allowNumber: true,
					allowBoolean: true,
					allowNullish: true,
				},
			],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': [
				'error',
				{
					checksVoidReturn: false,
				},
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: 'Reference|_',
					caughtErrorsIgnorePattern: 'Reference|_',
					varsIgnorePattern: 'Reference|_',
				},
			],

			// Import
			'import-x/default': 'off',
			'import-x/namespace': 'off',
			'import-x/no-duplicates': 'off',
			'import-x/no-named-as-default': 'off',
			'import-x/no-named-as-default-member': 'off',
			'import-x/no-unresolved': 'off',

			// JSDoc
			'jsdoc/no-types': 'error',
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns': 'off',
			'jsdoc/require-returns-description': 'off',
			'jsdoc/require-returns-type': 'off',

			// Node (eslint-plugin-n)
			'n/no-missing-import': 'off', // Covered by TypeScript
			'n/no-process-exit': 'off', // Handled by unicorn/no-process-exit
			'n/no-unpublished-import': 'off', // Inconsistent with devDependencies

			'no-console': 'error',

			// sonarjs
			'sonarjs/cognitive-complexity': ['error', 18],

			// Unicorn
			'unicorn/filename-case': ['error', {case: 'kebabCase'}],
			'unicorn/import-style': 'off',
			'unicorn/no-null': 'off', // We use null for state per BEHAVIOR.md
			'unicorn/no-process-exit': 'off', // CLI apps need process.exit
			'unicorn/numeric-separators-style': 'off',
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/switch-case-braces': 'off',
		},
	},
	{
		files: ['src/output/assets/*.js'],
		languageOptions: {
			globals: {
				document: 'readonly',
				window: 'readonly',
				globalThis: 'readonly',
				Chart: 'readonly',
			},
		},
		rules: {
			'no-console': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
		},
	},
	{
		ignores: ['dist/', 'node_modules/', 'coverage/', 'data/', 'models/', 'output/'],
	},
);
