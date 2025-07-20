/**
 * Renderer factory module
 *
 * This module provides the factory function for creating renderer instances
 * based on the requested format. It acts as the central point for instantiating
 * the appropriate renderer implementation.
 */

import type { Renderer, RenderOptions } from './types.js';
import { JsonRenderer } from './json.js';
import { AnsiRenderer } from './ansi.js';
import { HtmlRenderer } from './html.js';

/**
 * Create a renderer instance based on the specified format
 *
 * Factory function that instantiates the appropriate renderer for the
 * requested output format. Each renderer handles formatting AgentEvents
 * into its specific output format.
 *
 * @param format - The output format to use ('ansi', 'html', or 'json')
 * @param options - Additional options to pass to the renderer
 * @returns A configured renderer instance
 * @throws {Error} If the format is not supported
 *
 * @example
 * ```typescript
 * // Create an ANSI renderer for terminal output
 * const ansiRenderer = createRenderer('ansi', {
 *   collapseTools: true,
 *   hideTimestamps: false
 * });
 *
 * // Create an HTML renderer with dark theme
 * const htmlRenderer = createRenderer('html', {
 *   theme: 'dark',
 *   standalone: true
 * });
 *
 * // Create a JSON renderer for raw output
 * const jsonRenderer = createRenderer('json', {
 *   pretty: true
 * });
 *
 * // Use renderer in streaming pipeline
 * const renderer = createRenderer(format);
 * renderer.start();
 * for await (const event of events) {
 *   const output = renderer.render(event);
 *   if (output) process.stdout.write(output);
 * }
 * renderer.end();
 * ```
 *
 * @category Renderers
 * @since 0.1.0
 */
export function createRenderer(
  format: 'ansi' | 'html' | 'json',
  options: Partial<RenderOptions> = {},
): Renderer {
  // Merge format into options
  const fullOptions: RenderOptions = {
    ...options,
    format,
  };

  switch (format) {
    case 'ansi':
      return new AnsiRenderer(fullOptions);

    case 'html':
      return new HtmlRenderer(fullOptions);

    case 'json':
      return new JsonRenderer(fullOptions);

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Check if a format is supported
 *
 * Type guard function that validates whether a string is a supported
 * output format. Useful for runtime validation of user input.
 *
 * @param format - The format string to check
 * @returns True if the format is supported, with type narrowing
 *
 * @example
 * ```typescript
 * const userFormat = process.argv[2];
 *
 * if (isFormatSupported(userFormat)) {
 *   // TypeScript knows userFormat is 'ansi' | 'html' | 'json'
 *   const renderer = createRenderer(userFormat);
 * } else {
 *   console.error(`Unsupported format: ${userFormat}`);
 *   console.error(`Supported formats: ${getSupportedFormats().join(', ')}`);
 *   process.exit(1);
 * }
 * ```
 *
 * @category Renderers
 * @since 0.1.0
 */
export function isFormatSupported(
  format: string,
): format is 'ansi' | 'html' | 'json' {
  return format === 'ansi' || format === 'html' || format === 'json';
}

/**
 * Get list of supported formats
 *
 * Returns an array of all supported output format names.
 * Useful for displaying help text or validating configuration.
 *
 * @returns Array of supported format names
 *
 * @example
 * ```typescript
 * // Display supported formats in help text
 * console.log('Supported formats:');
 * getSupportedFormats().forEach(format => {
 *   console.log(`  - ${format}`);
 * });
 *
 * // Create format option for CLI
 * const formatOption = {
 *   type: 'string',
 *   choices: getSupportedFormats(),
 *   default: 'ansi',
 *   description: 'Output format'
 * };
 * ```
 *
 * @category Renderers
 * @since 0.1.0
 */
export function getSupportedFormats(): ('ansi' | 'html' | 'json')[] {
  return ['ansi', 'html', 'json'];
}
