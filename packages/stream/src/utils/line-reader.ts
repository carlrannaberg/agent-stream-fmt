import { Readable } from 'stream';

/**
 * Options for line reading behavior
 */
export interface LineReaderOptions {
  /** Maximum line length in bytes (default: 1MB) */
  maxLineLength?: number;

  /** Encoding for text decoding (default: 'utf8') */
  encoding?:
    | 'utf8'
    | 'ascii'
    | 'utf-8'
    | 'utf16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'latin1'
    | 'binary'
    | 'hex';

  /** Include empty lines (default: false) */
  includeEmpty?: boolean;
}

/**
 * Creates an async iterator that yields complete lines from a stream
 *
 * This function handles the complexities of reading line-by-line from a stream,
 * including partial lines across chunk boundaries, different line endings,
 * and maximum line length enforcement.
 *
 * @param source - Readable stream to read lines from
 * @param options - Configuration options
 * @param options.maxLineLength - Maximum line length in bytes (default: 1MB)
 * @param options.encoding - Text encoding (default: 'utf8')
 * @param options.includeEmpty - Include empty lines (default: false)
 * @yields Complete lines from the stream
 *
 * @example
 * ```typescript
 * // Read lines from stdin
 * for await (const line of createLineReader(process.stdin)) {
 *   console.log('Line:', line);
 * }
 *
 * // Read with options
 * const reader = createLineReader(fileStream, {
 *   maxLineLength: 10 * 1024 * 1024, // 10MB
 *   encoding: 'utf8',
 *   includeEmpty: true
 * });
 *
 * for await (const line of reader) {
 *   if (line.trim()) {
 *     processLine(line);
 *   }
 * }
 * ```
 *
 * @category Utilities
 * @since 0.1.0
 */
export async function* createLineReader(
  source: NodeJS.ReadableStream,
  options: LineReaderOptions = {},
): AsyncGenerator<string, void, unknown> {
  const {
    maxLineLength = 1024 * 1024, // 1MB
    encoding = 'utf8',
    includeEmpty = false,
  } = options;

  let buffer = '';
  const readable = source as Readable;

  // Set encoding if not already set
  if (!readable.readableEncoding) {
    readable.setEncoding(encoding);
  }

  try {
    for await (const chunk of readable) {
      // Append chunk to buffer
      buffer += chunk;

      // Check for max line length violation
      if (buffer.length > maxLineLength) {
        // Find the last newline within limit
        const lastNewline = buffer.lastIndexOf('\n', maxLineLength);
        if (lastNewline === -1) {
          // No newline found, yield truncated line
          yield buffer.substring(0, maxLineLength);
          buffer = buffer.substring(maxLineLength);
          continue;
        }
      }

      // Extract complete lines
      const lines = buffer.split('\n');

      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      // Yield complete lines
      for (const line of lines) {
        if (includeEmpty || line.trim()) {
          yield line;
        }
      }
    }

    // Yield any remaining content
    if (buffer && (includeEmpty || buffer.trim())) {
      yield buffer;
    }
  } finally {
    // Don't destroy stdin - let it close naturally
    if (!readable.destroyed && readable !== process.stdin) {
      readable.destroy();
    }
  }
}

/**
 * Extended line reader that yields lines with their line numbers
 *
 * Similar to createLineReader but includes line numbers with each line,
 * useful for error reporting, debugging, and maintaining position context
 * during parsing.
 *
 * @param source - Readable stream to read lines from
 * @param options - Same options as createLineReader
 * @yields Objects containing line content and line number
 *
 * @example
 * ```typescript
 * // Read with line numbers for error reporting
 * for await (const { line, lineNumber } of createLineReaderWithLineNumbers(stream)) {
 *   try {
 *     const data = JSON.parse(line);
 *     processData(data);
 *   } catch (error) {
 *     console.error(`Error on line ${lineNumber}: ${error.message}`);
 *     console.error(`Content: ${line}`);
 *   }
 * }
 *
 * // Track progress through large files
 * const reader = createLineReaderWithLineNumbers(fileStream, {
 *   maxLineLength: 5 * 1024 * 1024
 * });
 *
 * for await (const { line, lineNumber } of reader) {
 *   if (lineNumber % 1000 === 0) {
 *     console.log(`Processed ${lineNumber} lines...`);
 *   }
 *   await processLine(line);
 * }
 * ```
 *
 * @category Utilities
 * @since 0.1.0
 */
export async function* createLineReaderWithLineNumbers(
  source: NodeJS.ReadableStream,
  options: LineReaderOptions = {},
): AsyncGenerator<{ line: string; lineNumber: number }, void, unknown> {
  let lineNumber = 0;

  for await (const line of createLineReader(source, options)) {
    lineNumber++;
    yield { line, lineNumber };
  }
}
