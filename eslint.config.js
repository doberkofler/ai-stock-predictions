import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import regexp from 'eslint-plugin-regexp';
import unicorn from 'eslint-plugin-unicorn';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import promise from 'eslint-plugin-promise';
import node from 'eslint-plugin-n';
import perfectionist from 'eslint-plugin-perfectionist';

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	importX.flatConfigs.recommended,
	importX.flatConfigs.typescript,
	jsdoc.configs['flat/recommended-error'],
	regexp.configs['flat/recommended'],
	unicorn.configs['flat/recommended'],
	security.configs.recommended,
	sonarjs.configs.recommended,
	promise.configs['flat/recommended'],
	node.configs['flat/recommended-module'],
	perfectionist.configs['recommended-natural'],
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ['**/*.ts'],
		rules: {
			// Unicorn
			'unicorn/filename-case': ['error', {case: 'kebabCase'}],
			'unicorn/no-null': 'off', // We use null for state per BEHAVIOR.md
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/no-process-exit': 'off', // CLI apps need process.exit
			'unicorn/switch-case-braces': 'off',
			'unicorn/import-style': 'off',
			'unicorn/numeric-separators-style': 'off',

			// JSDoc
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-returns-description': 'off',
			'jsdoc/require-returns': 'off',
			'jsdoc/no-types': 'error',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns-type': 'off',
			'no-console': 'error',

			// sonarjs
			'sonarjs/cognitive-complexity': ['error', 18],

			// TypeScript
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': [
				'error',
				{
					checksVoidReturn: false,
				},
			],
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{
					allowNumber: true,
					allowBoolean: true,
					allowAny: false,
					allowNullish: true,
				},
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: 'Reference|_',
					varsIgnorePattern: 'Reference|_',
					caughtErrorsIgnorePattern: 'Reference|_',
				},
			],

			// Node (eslint-plugin-n)
			'n/no-missing-import': 'off', // Covered by TypeScript
			'n/no-unpublished-import': 'off', // Inconsistent with devDependencies
			'n/no-process-exit': 'off', // Handled by unicorn/no-process-exit

			// Import
			'import-x/no-unresolved': 'off',
			'import-x/namespace': 'off',
			'import-x/default': 'off',
			'import-x/no-duplicates': 'off',
			'import-x/no-named-as-default': 'off',
			'import-x/no-named-as-default-member': 'off',

			// perfectionist
			'perfectionist/sort-objects': 'off',
			'perfectionist/sort-interfaces': 'off',
			'perfectionist/sort-classes': 'off',
		},
	},
	{
		ignores: ['dist/', 'node_modules/', 'coverage/', 'data/', 'models/', 'output/'],
	},
);
