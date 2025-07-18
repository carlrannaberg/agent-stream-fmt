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
 * @param format - The output format to use
 * @param options - Additional options to pass to the renderer
 * @returns A configured renderer instance
 * @throws Error if the format is not supported
 */
export function createRenderer(
  format: 'ansi' | 'html' | 'json',
  options: Partial<RenderOptions> = {}
): Renderer {
  // Merge format into options
  const fullOptions: RenderOptions = {
    ...options,
    format
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
 * @param format - The format to check
 * @returns True if the format is supported
 */
export function isFormatSupported(format: string): format is 'ansi' | 'html' | 'json' {
  return format === 'ansi' || format === 'html' || format === 'json';
}

/**
 * Get list of supported formats
 * 
 * @returns Array of supported format names
 */
export function getSupportedFormats(): ('ansi' | 'html' | 'json')[] {
  return ['ansi', 'html', 'json'];
}