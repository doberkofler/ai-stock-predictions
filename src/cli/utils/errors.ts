/**
 * Error handling utilities for CLI operations
 * Provides consistent error types and messaging
 */

import chalk from 'chalk';

/**
 * Error context information
 */
type ErrorContext = {
	additionalInfo?: Record<string, unknown>;
	operation: string;
	step?: string;
	symbol?: string;
};

/**
 * Enhanced error with context
 */
class ContextualError extends Error {
	public constructor(
		message: string,
		public readonly context: ErrorContext,
		public readonly originalError?: Error,
	) {
		let contextualMessage = `${chalk.red(message)}\n${chalk.dim('Context:')} ${context.operation}`;
		if (context.symbol) contextualMessage += ` (${context.symbol})`;
		if (context.step) contextualMessage += ` - ${context.step}`;

		super(contextualMessage);
		this.name = 'ContextualError';
	}
}

/**
 * Custom error classes for different error types
 */
export class DataSourceError extends Error {
	public constructor(message: string, symbol?: string) {
		let msg = `Data Source Error: ${message}`;
		if (symbol) msg += ` (${symbol})`;
		super(chalk.red(msg));
		this.name = 'DataSourceError';
	}
}

export class ModelError extends Error {
	public constructor(message: string, symbol?: string) {
		let msg = `Model Error: ${message}`;
		if (symbol) msg += ` (${symbol})`;
		super(chalk.red(msg));
		this.name = 'ModelError';
	}
}

export class PredictionError extends Error {
	public constructor(message: string, symbol?: string) {
		let msg = `Prediction Error: ${message}`;
		if (symbol) msg += ` (${symbol})`;
		super(chalk.red(msg));
		this.name = 'PredictionError';
	}
}

/**
 * Error handler utility functions
 */
export const ErrorHandler = {
	/**
	 * Create a retry error
	 * @param operation - Operation that failed
	 * @param attempts - Number of retry attempts
	 * @param originalError - Original error that caused retries
	 * @returns Retry error
	 */
	createRetryError: (operation: string, attempts: number, originalError: Error): Error => {
		const msg = `Operation "${operation}" failed after ${attempts} attempts. Last error: ${originalError.message}`;
		return new Error(msg);
	},

	/**
	 * Wrap async function with error handling
	 * @template T
	 * @param fn - Async function to wrap
	 * @param context - Error context
	 * @returns Wrapped function promise
	 */
	wrapAsync: async <T>(fn: () => Promise<T>, context: ErrorContext): Promise<T> => {
		try {
			return await fn();
		} catch (error) {
			if (error instanceof Error) {
				throw new ContextualError(error.message, context, error);
			}
			throw new ContextualError(String(error), context);
		}
	},

	/**
	 * Wrap synchronous function with error handling
	 * @template T
	 * @param fn - Synchronous function to wrap
	 * @param context - Error context
	 * @returns Result of the function
	 */
	wrapSync: <T>(fn: () => T, context: ErrorContext): T => {
		try {
			return fn();
		} catch (error) {
			if (error instanceof Error) {
				throw new ContextualError(error.message, context, error);
			}
			throw new ContextualError(String(error), context);
		}
	},
};
