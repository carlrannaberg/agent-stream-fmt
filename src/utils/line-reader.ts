import { Readable } from 'stream';

/**
 * Options for line reading behavior
 */
export interface LineReaderOptions {
  /** Maximum line length in bytes (default: 1MB) */
  maxLineLength?: number;
  
  /** Encoding for text decoding (default: 'utf8') */
  encoding?: BufferEncoding;
  
  /** Include empty lines (default: false) */
  includeEmpty?: boolean;
}

/**
 * Creates an async iterator that yields complete lines from a stream
 * Handles partial lines across chunk boundaries
 */
export async function* createLineReader(
  source: NodeJS.ReadableStream,
  options: LineReaderOptions = {}
): AsyncGenerator<string, void, unknown> {
  const {
    maxLineLength = 1024 * 1024, // 1MB
    encoding = 'utf8',
    includeEmpty = false
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
    // Ensure stream is properly closed
    if (!readable.destroyed) {
      readable.destroy();
    }
  }
}

/**
 * Line reader with line number tracking
 */
export async function* createLineReaderWithLineNumbers(
  source: NodeJS.ReadableStream,
  options: LineReaderOptions = {}
): AsyncGenerator<{ line: string; lineNumber: number }, void, unknown> {
  let lineNumber = 0;
  
  for await (const line of createLineReader(source, options)) {
    lineNumber++;
    yield { line, lineNumber };
  }
}