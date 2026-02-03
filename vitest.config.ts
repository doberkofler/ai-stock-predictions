/// <reference types="vitest" />
import {defineConfig} from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'@/': new URL('src/', import.meta.url).pathname,
		},
	},
	test: {
		coverage: {
			exclude: ['src/**/*.d.ts', 'src/index.ts'],
			include: ['src/**/*.ts'],
			provider: 'v8',
			thresholds: {
				branches: 65,
				functions: 90,
				lines: 90,
				statements: 90,
			},
		},
		environment: 'node',
		globals: false,
		testTimeout: 30000,
	},
});
