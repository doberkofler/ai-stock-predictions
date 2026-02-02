/// <reference types="vitest" />
import {defineConfig} from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@/': new URL('./src/', import.meta.url).pathname,
		},
	},
	test: {
		environment: 'node',
		globals: false,
		testTimeout: 30000,
		coverage: {
			provider: 'v8',
			enabled: true,
			thresholds: {
				statements: 90,
				lines: 90,
				functions: 90,
			},
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.d.ts', 'src/index.ts', 'src/cli/**/*.ts'],
		},
	},
});
