import type {KnipConfig} from 'knip';

const config: KnipConfig = {
	entry: ['tests/unit/**/*.test.ts'],
	project: ['src/**/*.ts'],
	ignore: ['src/types/index.ts', 'src/output/assets/report.js'],
};

export default config;
