/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
	testEnvironment: 'node',
	extensionsToTreatAsEsm: ['.ts'],
	resolve: {
		alias: {
			'@/': new URL('./src/', import.meta.url).pathname,
		},
	},
	test: {
		globals: true,
		coverage: {
			provider: 'v8',
			enabled: true,
			thresholds: {
				global: {
					branches: 90,
					functions: 90,
					lines: 90,
					statements: 90,
				},
			},
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.d.ts',
				'src/index.ts',
				'src/cli/**/*.ts',
			],
		},
	},
});