import {describe, expect, it} from 'vitest';

import {DataSourceError, ErrorHandler, ModelError, PredictionError} from '../../../../src/cli/utils/errors.ts';

describe('ErrorHandler', () => {
	it('should create retry error', () => {
		const originalError = new Error('Network timeout');
		const retryError = ErrorHandler.createRetryError('fetch data', 3, originalError);

		expect(retryError.message).toContain('fetch data');
		expect(retryError.message).toContain('failed after 3 attempts');
		expect(retryError.message).toContain('Network timeout');
	});

	it('should wrap async function with Error exception', async () => {
		const context = {operation: 'test-operation', step: 'test-step'};

		await expect(
			ErrorHandler.wrapAsync(async () => {
				throw new Error('Test error');
			}, context),
		).rejects.toThrow('Test error');
	});

	it('should wrap async function with non-Error exception', async () => {
		const context = {operation: 'test-operation', step: 'test-step'};

		await expect(
			ErrorHandler.wrapAsync(async () => {
				throw 'string error';
			}, context),
		).rejects.toThrow('string error');
	});

	it('should wrap sync function with Error exception', () => {
		const context = {operation: 'test-operation', step: 'test-step'};

		expect(() =>
			ErrorHandler.wrapSync(() => {
				throw new Error('Sync error');
			}, context),
		).toThrow('Sync error');
	});

	it('should wrap sync function with non-Error exception', () => {
		const context = {operation: 'test-operation', step: 'test-step'};

		expect(() =>
			ErrorHandler.wrapSync(() => {
				throw 'string error';
			}, context),
		).toThrow('string error');
	});
});

describe('Custom Error Classes', () => {
	it('should create DataSourceError with symbol', () => {
		const error = new DataSourceError('API failed', 'AAPL');
		expect(error.message).toContain('Data Source Error');
		expect(error.message).toContain('API failed');
		expect(error.message).toContain('AAPL');
		expect(error.name).toBe('DataSourceError');
	});

	it('should create DataSourceError without symbol', () => {
		const error = new DataSourceError('API failed');
		expect(error.message).toContain('Data Source Error');
		expect(error.message).not.toContain('undefined');
	});

	it('should create ModelError with symbol', () => {
		const error = new ModelError('Training failed', 'TSLA');
		expect(error.message).toContain('Model Error');
		expect(error.message).toContain('Training failed');
		expect(error.message).toContain('TSLA');
		expect(error.name).toBe('ModelError');
	});

	it('should create PredictionError with symbol', () => {
		const error = new PredictionError('Prediction failed', 'GOOGL');
		expect(error.message).toContain('Prediction Error');
		expect(error.message).toContain('Prediction failed');
		expect(error.message).toContain('GOOGL');
		expect(error.name).toBe('PredictionError');
	});
});
