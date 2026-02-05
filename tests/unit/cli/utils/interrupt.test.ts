import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {InterruptError, InterruptHandler} from '../../../../src/cli/utils/interrupt.ts';

describe('InterruptHandler', () => {
	beforeEach(() => {
		InterruptHandler.reset();
		vi.useFakeTimers();
		// @ts-expect-error -- Mocking process.on
		vi.spyOn(process, 'on').mockImplementation((_event: string, _listener: unknown) => process);
		vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null) => undefined as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('should initialize and listen for SIGINT', () => {
		const onSpy = vi.spyOn(process, 'on');
		InterruptHandler.initialize();
		expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
		expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
	});

	it('should handle first SIGINT gracefully', () => {
		const listeners: Record<string, Function> = {};
		// @ts-expect-error -- Mocking process.on
		vi.spyOn(process, 'on').mockImplementation((event: string, listener: Function) => {
			listeners[event] = listener;
			return process;
		});

		InterruptHandler.initialize();
		const sigintListener = listeners.SIGINT;

		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

		sigintListener?.();

		expect(InterruptHandler.isInterrupted()).toBe(true);
		expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Interrupt received'));
	});

	it('should force exit on second SIGINT', () => {
		const listeners: Record<string, Function> = {};
		// @ts-expect-error -- Mocking process.on
		vi.spyOn(process, 'on').mockImplementation((event: string, listener: Function) => {
			listeners[event] = listener;
			return process;
		});

		InterruptHandler.initialize();
		const sigintListener = listeners.SIGINT;

		vi.spyOn(console, 'log').mockImplementation(() => {});
		const exitSpy = vi.spyOn(process, 'exit');

		sigintListener?.(); // First
		sigintListener?.(); // Second

		expect(exitSpy).toHaveBeenCalledWith(130);
	});

	it('should throw InterruptError when throwIfInterrupted is called', () => {
		const listeners: Record<string, Function> = {};
		// @ts-expect-error -- Mocking process.on
		vi.spyOn(process, 'on').mockImplementation((event: string, listener: Function) => {
			listeners[event] = listener;
			return process;
		});

		InterruptHandler.initialize();
		const sigintListener = listeners.SIGINT;

		vi.spyOn(console, 'log').mockImplementation(() => {});
		sigintListener?.();

		expect(() => InterruptHandler.throwIfInterrupted()).toThrow(InterruptError);
	});

	it('should call registered cleanup handlers on interrupt', () => {
		const cleanup = vi.fn();
		InterruptHandler.registerCleanup(cleanup);
		const listeners: Record<string, Function> = {};
		// @ts-expect-error -- Mocking process.on
		vi.spyOn(process, 'on').mockImplementation((event: string, listener: Function) => {
			listeners[event] = listener;
			return process;
		});

		InterruptHandler.initialize();
		const sigintListener = listeners.SIGINT;
		vi.spyOn(console, 'log').mockImplementation(() => {});

		sigintListener?.();

		expect(cleanup).toHaveBeenCalled();
	});

	it('should unregister cleanup handlers', () => {
		const cleanup = vi.fn();
		InterruptHandler.registerCleanup(cleanup);
		InterruptHandler.unregisterCleanup(cleanup);
		const listeners: Record<string, Function> = {};
		// @ts-expect-error -- Mocking process.on
		vi.spyOn(process, 'on').mockImplementation((event: string, listener: Function) => {
			listeners[event] = listener;
			return process;
		});

		InterruptHandler.initialize();
		const sigintListener = listeners.SIGINT;
		vi.spyOn(console, 'log').mockImplementation(() => {});

		sigintListener?.();

		expect(cleanup).not.toHaveBeenCalled();
	});
});
