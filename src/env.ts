/**
 * Environment and Backend Initialization
 * Handles dynamic loading of optimized backends and global process settings
 */

import process from 'node:process';
import util from 'node:util';

/**
 * Initialize the application environment
 * Attempts to load the optimized TensorFlow.js Node.js backend with a fallback
 */
export async function initializeEnvironment(): Promise<void> {
	// Suppress TensorFlow C++ informational logs (AVX2 FMA, etc.)
	// Must be set before importing @tensorflow/tfjs-node
	process.env.TF_CPP_MIN_LOG_LEVEL = '2';

	// Justification: Environment shims for library compatibility (better-sqlite3/ora/tfjs-node).
	// Runtime validation impossible as we are dynamically extending properties on core modules.
	// eslint-disable-next-line n/no-deprecated-api
	if (!(util as unknown as Record<string, unknown>).isNullOrUndefined) {
		// eslint-disable-next-line n/no-deprecated-api
		(util as unknown as Record<string, unknown>).isNullOrUndefined = (val: unknown): val is null | undefined => {
			return val === null || val === undefined;
		};
	}

	// eslint-disable-next-line n/no-deprecated-api
	if (!(util as unknown as Record<string, unknown>).isArray) {
		// eslint-disable-next-line n/no-deprecated-api
		(util as unknown as Record<string, unknown>).isArray = (val: unknown): val is unknown[] => {
			return Array.isArray(val);
		};
	}

	try {
		// Attempt to dynamic import the native Node.js backend for hardware acceleration
		await import('@tensorflow/tfjs-node');

		// Suppress the "Hi, looks like you are running TensorFlow.js in Node.js" message
		// and the Orthogonal initializer warnings by setting the production flag
		const tf = await import('@tensorflow/tfjs');
		tf.env().set('PROD', true);

		// Suppress Yahoo Finance survey notices
		const yahooFinanceModule = await import('yahoo-finance2');
		const yahooFinance = yahooFinanceModule.default;

		if ('setGlobalConfig' in yahooFinance) {
			(yahooFinance as {setGlobalConfig: (config: unknown) => void}).setGlobalConfig({
				suppressNotices: ['yahooSurvey'],
			});
		}
	} catch {
		// Fallback to CPU backend if native bindings are unavailable (common on Windows without build tools)
		console.warn('\n⚠️  TensorFlow native Node.js backend not found. Falling back to JavaScript CPU implementation.');
		console.warn('💡 To speed up training dramatically, try installing build tools or using a compatible environment.\n');
	}
}
