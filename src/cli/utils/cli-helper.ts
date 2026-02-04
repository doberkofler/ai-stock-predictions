/**
 * CLI Helper - Utilities for detecting CLI invocation and formatting
 */

/**
 * Detects actual CLI command invocation string based on how the program is being run.
 * Returns "node src/index.ts" when running directly via node, otherwise returns the package name.
 * @returns The CLI command prefix to use in help messages
 */
export function getCliInvocation(): string {
	const isNodeExecution = (process.argv[0]?.endsWith('/node') ?? false) || process.argv[0] === 'node';
	const isRunningFromSource = process.argv[1]?.includes('src/index.ts');
	const invocation = isNodeExecution && isRunningFromSource ? 'node src/index.ts' : 'ai-stock-predictions';
	return invocation;
}
