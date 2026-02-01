import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import regexp from 'eslint-plugin-regexp';
import unicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	importX.flatConfigs.recommended,
	importX.flatConfigs.typescript,
	jsdoc.configs['flat/recommended-error'],
	regexp.configs['flat/recommended'],
	unicorn.configs['flat/recommended'],
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
		settings: {
			'import-x/resolver': {
				node: true,
			},
		},
		rules: {
			'unicorn/filename-case': ['error', {case: 'kebabCase'}],
			'unicorn/no-null': 'off', // We use null for state per BEHAVIOR.md
			'unicorn/prevent-abbreviations': 'off',
			'unicorn/no-process-exit': 'off', // CLI apps need process.exit
			'unicorn/switch-case-braces': 'off', // Personal preference, keeping it simple
			'unicorn/import-style': 'off',
			'unicorn/numeric-separators-style': 'off', // Redundant for small numbers and sometimes messy
			'no-console': 'off',
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-returns-description': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'], // Enforce type over interface
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
			'import-x/no-unresolved': 'off', // TS covers this and it's being flaky with .ts extensions
			'import-x/namespace': 'off', // Extremely slow and flaky with TS
			'import-x/default': 'off', // Extremely slow and flaky with TS
			'import-x/no-duplicates': 'off',
			'import-x/no-named-as-default': 'off',
			'import-x/no-named-as-default-member': 'off',
		},
	},
	{
		ignores: ['dist/', 'node_modules/', 'coverage/', 'data/', 'models/', 'output/'],
	},
);
