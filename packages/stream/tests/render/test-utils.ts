/**
 * Test utilities for render tests
 */

/**
 * Strip ANSI escape codes from a string
 * Used to test the content without color codes
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
