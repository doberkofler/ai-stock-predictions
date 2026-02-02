/**
 * Error handling utilities for CLI operations
 * Provides consistent error types and messaging
 */

import chalk from 'chalk';

/**
 * Custom error classes for different error types
 */
export class DataSourceError extends Error {
	public constructor(
		message: string,
		public readonly symbol?: string,
	) {
		super(chalk.red(`Data Source Error: ${message}${symbol ? ` (${symbol})` : ''}`));
		this.name = 'DataSourceError';
	}
}

export class ModelError extends Error {
	public constructor(
		message: string,
		public readonly symbol?: string,
	) {
		super(chalk.red(`Model Error: ${message}${symbol ? ` (${symbol})` : ''}`));
		this.name = 'ModelError';
	}
}

export class PredictionError extends Error {
	public constructor(
		message: string,
		public readonly symbol?: string,
	) {
		super(chalk.red(`Prediction Error: ${message}${symbol ? ` (${symbol})` : ''}`));
		this.name = 'PredictionError';
	}
}

/**
 * Error context information
 */
export type ErrorContext = {
	operation: string;
	symbol?: string;
	step?: string;
	additionalInfo?: Record<string, unknown>;
};

/**
 * Enhanced error with context
 */
export class ContextualError extends Error {
	public constructor(
		message: string,
		public readonly context: ErrorContext,
		public readonly originalError?: Error,
	) {
		super(
			`${chalk.red(message)}\n${chalk.dim('Context:')} ${context.operation}${context.symbol ? ` (${context.symbol})` : ''}${context.step ? ` - ${context.step}` : ''}`,
		);
		this.name = 'ContextualError';
	}
}

/**
 * Error handler utility functions
 */
export const ErrorHandler = {
	/**
	 * Create a retry error
	 * @param {string} operation - Operation that failed
	 * @param {number} attempts - Number of retry attempts
	 * @param {Error} originalError - Original error that caused retries
	 * @returns {Error} Retry error
	 */
	createRetryError: (operation: string, attempts: number, originalError: Error): Error => {
		return new Error(`Operation "${operation}" failed after ${attempts} attempts. Last error: ${originalError.message}`);
	},

	/**
	 * Wrap async function with error handling
	 * @template T
	 * @param {function(): Promise<T>} fn - Async function to wrap
	 * @param {ErrorContext} context - Error context
	 * @returns {Promise<T>} Wrapped function promise
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
	 * @param {function(): T} fn - Synchronous function to wrap
	 * @param {ErrorContext} context - Error context
	 * @returns {T} Result of the function
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
