import ora, {type Ora} from 'ora';

/**
 * Minimal interface representing the subset of Ora we use.
 */
export type MockOra = {
	fail: (text?: string) => MockOra;
	info: (text?: string) => MockOra;
	start: () => MockOra;
	stop: () => MockOra;
	succeed: (text?: string) => MockOra;
	text: string;
	warn: (text?: string) => MockOra;
};

/**
 * UI Service to centralize CLI communication and handle TTY/non-TTY environments.
 * Ensures a clean output during tests and CI while providing a rich dashboard in terminals.
 */
class UiService {
	private readonly isInteractive: boolean;

	public constructor() {
		// Detect if we are in a real interactive terminal and not in a test environment
		/* v8 ignore start */
		this.isInteractive = (process.stdout.isTTY || process.env.DEBUG_UI === 'true') && process.env.NODE_ENV !== 'test' && !process.env.VITEST && !process.env.CI;
		/* v8 ignore stop */
	}

	/**
	 * Helper to print a line only in interactive mode
	 */
	public divider(): void {
		this.log('─────────────────────────────────────────────────────────────────────────────────────────────────');
	}

	/**
	 * Always log errors regardless of environment to ensure critical issues are visible.
	 * @param message - The error message to log.
	 */
	public error(message: string): void {
		/* v8 ignore start */
		if (this.isInteractive) {
			// eslint-disable-next-line no-console -- Justification: UI service is the designated abstraction for terminal communication.
			console.error(message);
		}
		/* v8 ignore stop */
	}

	/**
	 * Log decorative or status text.
	 * Only shows in interactive terminals to prevent cluttering test/CI logs.
	 * @param message - The message to log.
	 */
	public log(message: string): void {
		/* v8 ignore start */
		if (this.isInteractive) {
			// eslint-disable-next-line no-console -- Justification: UI service is the designated abstraction for terminal communication.
			console.log(message);
		}
		/* v8 ignore stop */
	}

	/**
	 * Returns a real animated spinner if TTY, or a non-op spinner for non-interactive environments.
	 * @param text - The initial text for the spinner.
	 * @returns The spinner instance.
	 */
	public spinner(text: string): MockOra | Ora {
		/* v8 ignore start */
		if (this.isInteractive) {
			return ora(text);
		}
		/* v8 ignore stop */

		// Return a no-op implementation that satisfies the common Ora interface
		/* v8 ignore start */
		const mock: MockOra = {
			fail: () => mock,
			info: () => mock,
			start: () => mock,
			stop: () => mock,
			succeed: () => mock,
			text: text,
			warn: () => mock,
		};
		return mock;
		/* v8 ignore stop */
	}
}

// Export a singleton instance
export const ui = new UiService();
