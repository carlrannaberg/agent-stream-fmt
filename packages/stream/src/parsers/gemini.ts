import { VendorParser } from './types.js';
import { AgentEvent, MessageEvent } from '../types.js';

/**
 * Gemini CLI plain text parser
 *
 * Parses the plain text output from Gemini CLI and converts it to message events.
 * Since Gemini CLI doesn't support JSONL output, this parser treats all non-empty
 * lines as assistant messages.
 *
 * @example
 * ```typescript
 * const parser = new GeminiParser();
 * const events = parser.parse('Hello, how can I help you?');
 * ```
 */
export class GeminiParser implements VendorParser {
  /** Vendor identifier */
  vendor = 'gemini';

  /** Parser metadata */
  metadata = {
    version: '1.0.0',
    supportedVersions: ['0.1.x'],
    documentationUrl: 'https://github.com/google-gemini/gemini-cli',
  };

  /**
   * Detect if a line belongs to Gemini CLI output
   *
   * Since Gemini outputs plain text, we detect by checking if it's NOT JSON
   * and the line contains text content.
   *
   * @param line - Raw text line to test
   * @returns True if this parser can handle the line
   */
  detect(line: string): boolean {
    // Skip empty lines
    if (!line.trim()) return false;

    // Skip lines that look like JSON (other parsers should handle those)
    try {
      JSON.parse(line);
      return false; // It's JSON, not plain text
    } catch {
      // Not JSON, could be Gemini text
    }

    // Accept any non-JSON text line
    return true;
  }

  /**
   * Parse a single text line into zero or more events
   *
   * Converts Gemini's plain text output into normalized AgentEvent objects.
   * Treats content lines as assistant messages and filters out system messages.
   *
   * @param line - Raw text line to parse
   * @returns Array of parsed events
   */
  parse(line: string): AgentEvent[] {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      return [];
    }

    // Skip Gemini system messages
    if (trimmed === 'Loaded cached credentials.') {
      return [];
    }

    // Everything else is treated as an assistant message
    // Use original line to preserve code indentation
    return [
      {
        t: 'msg',
        role: 'assistant',
        text: line,
      } as MessageEvent,
    ];
  }
}

/**
 * Singleton instance of Gemini parser
 */
export const geminiParser = new GeminiParser();
