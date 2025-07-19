import { AgentEvent } from '../types.js';

/**
 * Interface that all vendor parsers must implement
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
    }
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
      context: this.context
    };
  }
}