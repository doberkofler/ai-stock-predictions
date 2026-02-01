/**
 * Environment and Backend Initialization
 * Handles dynamic loading of optimized backends and global process settings
 */

import process from 'node:process';

/**
 * Initialize the application environment
 * Attempts to load the optimized TensorFlow.js Node.js backend with a fallback
 */
export async function initializeEnvironment(): Promise<void> {
	// Suppress TensorFlow C++ informational logs (AVX2 FMA, etc.)
	// Must be set before importing @tensorflow/tfjs-node
	process.env.TF_CPP_MIN_LOG_LEVEL = '2';

	try {
		// Attempt to dynamic import the native Node.js backend for hardware acceleration
		await import('@tensorflow/tfjs-node');
	} catch {
		// Fallback to CPU backend if native bindings are unavailable (common on Windows without build tools)
		console.warn('\n⚠️  TensorFlow native Node.js backend not found. Falling back to JavaScript CPU implementation.');
		console.warn('💡 To speed up training dramatically, try installing build tools or using a compatible environment.\n');
	}
}
