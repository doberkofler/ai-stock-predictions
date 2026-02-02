import ora, {type Ora} from 'ora';

/**
 * Minimal interface representing the subset of Ora we use.
 */
type MockOra = {
	start: () => MockOra;
	stop: () => MockOra;
	succeed: (text?: string) => MockOra;
	fail: (text?: string) => MockOra;
	warn: (text?: string) => MockOra;
	info: (text?: string) => MockOra;
	text: string;
};

/**
 * UI Service to centralize CLI communication and handle TTY/non-TTY environments.
 * Ensures a clean output during tests and CI while providing a rich dashboard in terminals.
 */
export class UiService {
	private readonly isInteractive: boolean;

	public constructor() {
		// Detect if we are in a real interactive terminal and not in a test environment
		this.isInteractive = process.stdout.isTTY && process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true';
	}

	/**
	 * Log decorative or status text.
	 * Only shows in interactive terminals to prevent cluttering test/CI logs.
	 * @param {string} message - The message to log.
	 */
	public log(message: string): void {
		if (this.isInteractive) {
			console.log(message);
		}
	}

	/**
	 * Always log errors regardless of environment to ensure critical issues are visible.
	 * @param {string} message - The error message to log.
	 */
	public error(message: string): void {
		console.error(message);
	}

	/**
	 * Returns a real animated spinner if TTY, or a non-op spinner for non-interactive environments.
	 * @param {string} text - The initial text for the spinner.
	 * @returns {Ora | MockOra} The spinner instance.
	 */
	public spinner(text: string): Ora | MockOra {
		if (this.isInteractive) {
			return ora(text);
		}

		// Return a no-op implementation that satisfies the common Ora interface
		const mock: MockOra = {
			start: () => mock,
			stop: () => mock,
			succeed: () => mock,
			fail: () => mock,
			warn: () => mock,
			info: () => mock,
			text: text,
		};
		return mock;
	}

	/**
	 * Helper to print a line only in interactive mode
	 */
	public divider(): void {
		this.log('─────────────────────────────────────────────────────────────────────────────────────────────────');
	}
}

// Export a singleton instance
export const ui = new UiService();
