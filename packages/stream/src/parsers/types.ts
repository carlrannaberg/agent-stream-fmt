import { AgentEvent } from '../types.js';

/**
 * Interface that all vendor parsers must implement
 *
 * VendorParser defines the contract for parsing vendor-specific JSONL formats
 * into normalized AgentEvent objects. Each parser handles detection and parsing
 * for a specific AI agent CLI format.
 *
 * @example
 * ```typescript
 * const myParser: VendorParser = {
 *   vendor: 'mycli',
 *
 *   detect: (line: string) => {
 *     try {
 *       const obj = JSON.parse(line);
 *       return obj.source === 'mycli';
 *     } catch {
 *       return false;
 *     }
 *   },
 *
 *   parse: (line: string) => {
 *     const obj = JSON.parse(line);
 *     if (obj.type === 'message') {
 *       return [{ t: 'msg', role: obj.role, text: obj.content }];
 *     }
 *     return [];
 *   },
 *
 *   metadata: {
 *     version: '1.0.0',
 *     supportedVersions: ['1.x'],
 *     documentationUrl: 'https://example.com/mycli/docs'
 *   }
 * };
 * ```
 *
 * @category Parsers
 * @since 0.1.0
 */
export interface VendorParser {
  /** Unique vendor identifier */
  vendor: string;

  /**
   * Detect if a line belongs to this vendor's format
   * Should be fast and avoid throwing errors
   * @param line - Raw JSONL line to test
   * @returns True if this parser can handle the line
   */
  detect: (line: string) => boolean;

  /**
   * Parse a single line into zero or more events
   * May throw errors for invalid JSON
   * @param line - Raw JSONL line to parse
   * @returns Array of parsed events
   * @throws {ParseError} When parsing fails
   */
  parse: (line: string) => AgentEvent[];

  /**
   * Optional metadata about the parser
   */
  metadata?: {
    /** Parser version */
    version?: string;
    /** Supported vendor/CLI versions */
    supportedVersions?: string[];
    /** URL to documentation */
    documentationUrl?: string;
  };
}

/**
 * Parser registration entry for the registry
 */
export interface ParserEntry {
  /** The parser instance */
  parser: VendorParser;
  /** Priority for auto-detection (higher = tried first) */
  priority: number;
}

/**
 * Result of vendor detection with confidence scoring
 */
export interface DetectionResult {
  /** The detected parser */
  parser: VendorParser;
  /** Confidence score from 0 to 1 (1 = highest confidence) */
  confidence: number;
  /** Human-readable reason for the detection result */
  reason: string;
}

/**
 * Error thrown when parsing fails
 *
 * ParseError provides detailed context about parsing failures, including
 * the vendor that failed, the problematic line, and optional position information.
 *
 * @example
 * ```typescript
 * try {
 *   const events = parser.parse(line);
 * } catch (error) {
 *   if (error instanceof ParseError) {
 *     console.error(`Parse error in ${error.vendor}:`);
 *     console.error(`  Line: ${error.line}`);
 *     console.error(`  Message: ${error.message}`);
 *     if (error.context?.lineNumber) {
 *       console.error(`  Line number: ${error.context.lineNumber}`);
 *     }
 *   }
 * }
 *
 * // Throwing a ParseError
 * throw new ParseError(
 *   'Invalid message format',
 *   'claude',
 *   line,
 *   originalError,
 *   { lineNumber: 42, expectedFormat: 'MessageEvent' }
 * );
 * ```
 *
 * @category Parsers
 * @since 0.1.0
 */
export class ParseError extends Error {
  /**
   * Create a new ParseError
   * @param message - Error description
   * @param vendor - Vendor that failed to parse
   * @param line - Original line that failed
   * @param cause - Underlying error cause
   * @param context - Additional context about the error
   */
  constructor(
    message: string,
    public readonly vendor: string,
    public readonly line: string,
    public readonly cause?: unknown,
    public readonly context?: {
      lineNumber?: number;
      characterPosition?: number;
      expectedFormat?: string;
    },
  ) {
    super(message);
    this.name = 'ParseError';
  }

  /**
   * Convert error to JSON representation
   * @returns JSON object with error details
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      vendor: this.vendor,
      context: this.context,
    };
  }
}
