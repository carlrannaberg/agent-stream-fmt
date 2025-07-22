import { VendorParser, ParseError } from './types.js';
import { AgentEvent, ToolEvent } from '../types.js';

/**
 * Amp Code JSONL parser
 *
 * Parses the JSONL output from Amp Code CLI when using the --output jsonl flag.
 * Handles task phases, output events, and completion events.
 *
 * @example
 * ```typescript
 * const parser = new AmpParser();
 * const events = parser.parse('{"phase":"start","task":"build"}');
 * ```
 */
export class AmpParser implements VendorParser {
  /** Vendor identifier */
  vendor = 'amp';

  /** Parser metadata */
  metadata = {
    version: '1.0.0',
    supportedVersions: ['1.0', '1.1'],
    documentationUrl: 'https://docs.amp-code.com/cli',
  };

  /**
   * Detect if a line belongs to Amp's JSONL format
   *
   * Fast detection method that checks for Amp-specific event types.
   * Does not throw errors and returns false for any parsing issues.
   *
   * @param line - Raw JSONL line to test
   * @returns True if this parser can handle the line
   */
  detect(line: string): boolean {
    try {
      const obj = JSON.parse(line);

      // Amp events have phase and task fields
      return (
        typeof obj.phase === 'string' &&
        typeof obj.task === 'string' &&
        (obj.phase === 'start' || obj.phase === 'output' || obj.phase === 'end')
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse a single JSONL line into zero or more events
   *
   * Converts Amp's JSONL format into normalized AgentEvent objects.
   * Handles all known Amp event types and converts unknowns to DebugEvent.
   *
   * @param line - Raw JSONL line to parse
   * @returns Array of parsed events
   * @throws {ParseError} When JSON parsing fails
   */
  parse(line: string): AgentEvent[] {
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch (error) {
      throw new ParseError('Invalid JSON', this.vendor, line, error, {
        expectedFormat:
          'Valid JSON object with "phase" and "task" fields (phase: start, output, or end)',
      });
    }

    const events: AgentEvent[] = [];

    // Type guard to ensure obj is a record
    if (!obj || typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return [
        {
          t: 'debug',
          raw: obj,
        },
      ];
    }

    const record = obj as Record<string, unknown>;
    if (!('phase' in record)) {
      return [
        {
          t: 'debug',
          raw: obj,
        },
      ];
    }

    switch (record.phase) {
      case 'start':
        events.push(this.parseStart(record));
        break;

      case 'output':
        events.push(this.parseOutput(record));
        break;

      case 'end':
        events.push(this.parseEnd(record));
        break;

      default:
        // Unknown phase - emit as debug
        events.push({
          t: 'debug',
          raw: obj,
        });
    }

    return events;
  }

  /**
   * Parse a start phase event
   *
   * Converts Amp start events into ToolEvent with start phase.
   *
   * @param obj - Raw start event from Amp
   * @returns ToolEvent with start phase
   */
  private parseStart(obj: Record<string, unknown>): ToolEvent {
    return {
      t: 'tool',
      name:
        typeof obj.task === 'string' && obj.task !== '' ? obj.task : 'unknown',
      phase: 'start',
    };
  }

  /**
   * Parse an output phase event
   *
   * Converts Amp output events into ToolEvent with appropriate phase.
   *
   * @param obj - Raw output event from Amp
   * @returns ToolEvent with stdout or stderr phase
   */
  private parseOutput(obj: Record<string, unknown>): ToolEvent {
    const phase = obj.type === 'stderr' ? 'stderr' : 'stdout';

    return {
      t: 'tool',
      name:
        typeof obj.task === 'string' && obj.task !== '' ? obj.task : 'unknown',
      phase,
      text: typeof obj.content === 'string' ? obj.content : '',
    };
  }

  /**
   * Parse an end phase event
   *
   * Converts Amp end events into ToolEvent with end phase.
   *
   * @param obj - Raw end event from Amp
   * @returns ToolEvent with end phase
   */
  private parseEnd(obj: Record<string, unknown>): ToolEvent {
    return {
      t: 'tool',
      name:
        typeof obj.task === 'string' && obj.task !== '' ? obj.task : 'unknown',
      phase: 'end',
      exitCode: typeof obj.exitCode === 'number' ? obj.exitCode : 0,
    };
  }
}

/**
 * Singleton instance of Amp parser
 */
export const ampParser = new AmpParser();
