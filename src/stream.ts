import { AgentEvent, StreamEventOptions, Vendor } from './types.js';
import { selectParser } from './parsers/index.js';
import { createLineReaderWithLineNumbers } from './utils/line-reader.js';
import { ParseError } from './parsers/types.js';

/**
 * Options for streaming behavior
 */
export interface StreamOptions extends StreamEventOptions {
  /** Continue on parse errors (default: true) */
  continueOnError?: boolean;
  
  /** Emit debug events for unknown formats (default: false) */
  emitDebugEvents?: boolean;
  
  /** Maximum consecutive errors before stopping (default: 100) */
  maxConsecutiveErrors?: number;
  
  /** Line reader options */
  lineReaderOptions?: {
    maxLineLength?: number;
    encoding?: BufferEncoding;
  };
}

/**
 * Stream events from JSONL input
 * 
 * @example
 * ```typescript
 * for await (const event of streamEvents({ 
 *   vendor: 'claude', 
 *   source: process.stdin 
 * })) {
 *   console.log(event);
 * }
 * ```
 */
export async function* streamEvents(
  options: StreamOptions
): AsyncGenerator<AgentEvent, void, unknown> {
  const {
    vendor,
    source,
    continueOnError = true,
    emitDebugEvents = false,
    maxConsecutiveErrors = 100,
    lineReaderOptions = {}
  } = options;
  
  let parser: ReturnType<typeof selectParser> | null = null;
  let consecutiveErrors = 0;
  let totalLines = 0;
  let successfulLines = 0;
  
  // Create line reader
  const lineReader = createLineReaderWithLineNumbers(source, lineReaderOptions);
  
  try {
    for await (const { line, lineNumber } of lineReader) {
      totalLines++;
      
      try {
        // Auto-detect parser on first line if needed
        if (!parser) {
          parser = selectParser(vendor, line);
          
          // Emit debug event about detected vendor
          if (emitDebugEvents && vendor === 'auto') {
            yield {
              t: 'debug',
              raw: { detected: parser.vendor, lineNumber }
            };
          }
        }
        
        // Parse line into events
        const events = parser.parse(line);
        
        // Yield each event
        for (const event of events) {
          yield event;
        }
        
        // Reset error counter on success
        consecutiveErrors = 0;
        successfulLines++;
        
      } catch (error) {
        consecutiveErrors++;
        
        // Create error event
        const errorEvent: AgentEvent = {
          t: 'error',
          message: error instanceof ParseError 
            ? error.message 
            : `Line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`
        };
        
        // Always yield error event
        yield errorEvent;
        
        // Emit debug info if requested
        if (emitDebugEvents) {
          yield {
            t: 'debug',
            raw: {
              lineNumber,
              line: line.substring(0, 200),
              error: error instanceof Error ? error.stack : String(error)
            }
          };
        }
        
        // Check if we should stop
        if (!continueOnError) {
          throw error;
        }
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(
            `Stopped after ${maxConsecutiveErrors} consecutive errors. ` +
            `Processed ${successfulLines}/${totalLines} lines successfully.`
          );
        }
      }
    }
  } finally {
    // Emit summary debug event if requested
    if (emitDebugEvents && totalLines > 0) {
      yield {
        t: 'debug',
        raw: {
          summary: {
            totalLines,
            successfulLines,
            errorLines: totalLines - successfulLines,
            successRate: (successfulLines / totalLines * 100).toFixed(2) + '%'
          }
        }
      };
    }
  }
}

/**
 * Convenience function to collect all events into an array
 * WARNING: This loads all events into memory, use only for testing
 */
export async function collectEvents(
  options: StreamOptions
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  
  for await (const event of streamEvents(options)) {
    events.push(event);
  }
  
  return events;
}