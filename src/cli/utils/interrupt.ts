/**
 * Interrupt Handler for Graceful Ctrl+C Support
 * Provides mechanisms to handle SIGINT signals and allow operations to complete gracefully
 */

/**
 * Custom error thrown when an operation is interrupted by the user
 */
export class InterruptError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = 'InterruptError';
	}
}

/**
 * Global interrupt handler that manages SIGINT signals and cleanup
 * This class uses static methods to maintain global state across the application
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Static utility class for global interrupt state
export class InterruptHandler {
	private static interrupted = false;
	private static sigintCount = 0;
	private static cleanupHandlers: (() => void)[] = [];
	private static initialized = false;

	/**
	 * Initialize the interrupt handler to listen for SIGINT signals
	 * Supports double Ctrl+C for immediate force exit
	 */
	public static initialize(): void {
		if (this.initialized) {
			return;
		}

		this.initialized = true;

		process.on('SIGINT', () => {
			this.sigintCount++;

			if (this.sigintCount === 1) {
				this.interrupted = true;

				// Trigger all registered cleanup handlers IMMEDIATELY
				// This includes stopping spinners so they don't overwrite our message
				for (const handler of this.cleanupHandlers) {
					try {
						handler();
					} catch {
						// Ignore cleanup errors during interrupt
					}
				}

				// eslint-disable-next-line no-console -- Justification: User interrupt notification
				console.log('\n\n🛑 Interrupt received. Finishing current operation...');
				// eslint-disable-next-line no-console -- Justification: User interrupt notification
				console.log('💡 Press Ctrl+C again to force exit immediately.');

				// Give 5 seconds for graceful cleanup, then force exit
				setTimeout(() => {
					// eslint-disable-next-line no-console -- Justification: User interrupt notification
					console.log('\n⏱️  Graceful shutdown timeout reached. Forcing exit...');
					process.exit(130); // Standard SIGINT exit code
				}, 5000);
			} else {
				// Second Ctrl+C: Force immediate exit
				// eslint-disable-next-line no-console -- Justification: User interrupt notification
				console.log('\n⚡ Force exit!');
				process.exit(130);
			}
		});
	}

	/**
	 * Check if an interrupt signal has been received
	 * @returns True if interrupted, false otherwise
	 */
	public static isInterrupted(): boolean {
		return this.interrupted;
	}

	/**
	 * Reset the interrupt state (used for testing or command resets)
	 */
	public static reset(): void {
		this.interrupted = false;
		this.sigintCount = 0;
		this.cleanupHandlers = [];
	}

	/**
	 * Register a cleanup handler to be called on interrupt
	 * @param handler - Function to call during cleanup
	 */
	public static registerCleanup(handler: () => void): void {
		this.cleanupHandlers.push(handler);
	}

	/**
	 * Unregister a cleanup handler
	 * @param handler - Function to remove
	 */
	public static unregisterCleanup(handler: () => void): void {
		this.cleanupHandlers = this.cleanupHandlers.filter((h) => h !== handler);
	}

	/**
	 * Throw an InterruptError if an interrupt has been received
	 * Use this to check for interrupts at safe points in long-running operations
	 * @throws {InterruptError} if interrupted
	 */
	public static throwIfInterrupted(): void {
		if (this.interrupted) {
			throw new InterruptError('Operation interrupted by user');
		}
	}
}
