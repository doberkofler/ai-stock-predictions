import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import node from 'eslint-plugin-n';
import perfectionist from 'eslint-plugin-perfectionist';
import promise from 'eslint-plugin-promise';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
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
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			// TypeScript
			'@typescript-eslint/no-explicit-any': 'error',
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
			'@typescript-eslint/restrict-template-expressions': [
				'error',
				{
					allowAny: false,
					allowBoolean: true,
					allowNullish: true,
					allowNumber: true,
				},
			],
			'import-x/default': 'off',

			'import-x/namespace': 'off',
			'import-x/no-duplicates': 'off',
			'import-x/no-named-as-default': 'off',
			'import-x/no-named-as-default-member': 'off',
			// Import
			'import-x/no-unresolved': 'off',
			'jsdoc/no-types': 'error',
			// JSDoc
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

			// perfectionist - disable all sorting rules
			'perfectionist/sort-array-includes': 'off',
			'perfectionist/sort-classes': 'off',
			'perfectionist/sort-enums': 'off',
			'perfectionist/sort-exports': 'off',
			'perfectionist/sort-imports': 'off',
			'perfectionist/sort-interfaces': 'off',
			'perfectionist/sort-intersection-types': 'off',
			'perfectionist/sort-jsx-props': 'off',
			'perfectionist/sort-maps': 'off',
			'perfectionist/sort-named-exports': 'off',
			'perfectionist/sort-named-imports': 'off',
			'perfectionist/sort-object-types': 'off',
			'perfectionist/sort-objects': 'off',
			'perfectionist/sort-sets': 'off',
			'perfectionist/sort-switch-case': 'off',
			'perfectionist/sort-union-types': 'off',
			'perfectionist/sort-variable-declarations': 'off',

			// Security
			'security/detect-object-injection': 'off',
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
		ignores: ['dist/', 'node_modules/', 'coverage/', 'data/', 'models/', 'output/'],
	},
);
