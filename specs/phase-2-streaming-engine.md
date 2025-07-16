# Phase 2: Streaming Engine

**Status**: Draft  
**Authors**: Claude Assistant  
**Date**: 2025-07-16  
**Version**: 1.0.0  

## Overview

Phase 2 implements the core streaming engine that transforms JSONL input into normalized `AgentEvent` streams. This phase builds upon the type system and parsers from Phase 1 to create an efficient, memory-bounded streaming pipeline. The implementation focuses on handling real-world challenges like partial lines, backpressure, error recovery, and async iteration patterns.

## Background/Problem Statement

With parsers ready from Phase 1, we need to:
1. **Stream JSONL efficiently** without loading entire files into memory
2. **Handle partial lines** that span across chunk boundaries
3. **Implement backpressure** to prevent memory overflow
4. **Provide error recovery** so one bad line doesn't crash the stream
5. **Create async iterators** that integrate naturally with Node.js streams
6. **Build a minimal CLI** for testing the streaming pipeline

The key challenges are:
- **Chunk boundaries**: JSON lines can be split across read chunks
- **Memory efficiency**: Must handle gigabyte-sized logs with constant memory
- **Error resilience**: Malformed lines shouldn't terminate processing
- **Performance**: Target 50k+ lines/second throughput
- **Composability**: Design for easy integration with renderers (Phase 3)

## Goals

- **Implement** a robust line-by-line reader that handles partial lines
- **Create** the `streamEvents` async generator function
- **Handle** errors gracefully with recovery strategies
- **Support** backpressure through async iteration
- **Build** a minimal CLI for end-to-end testing
- **Achieve** memory-bounded operation (< 20MB RSS)
- **Test** against all captured fixtures

## Non-Goals

- **Not implementing** rendering or formatting (Phase 3)
- **Not building** the full CLI with all options (Phase 3)
- **Not optimizing** for absolute maximum performance (Phase 5)
- **Not handling** vendor-specific edge cases beyond parsing
- **Not implementing** `streamFormat` function (Phase 3)
- **Not adding** filtering or transformation logic (Phase 3)

## Technical Dependencies

### From Previous Phases
- **Phase 0**: Captured fixtures for testing
- **Phase 1**: Type system, parser interface, and Claude parser

### Node.js APIs
- **Readable streams**: For input handling
- **AsyncIterator protocol**: For composable streaming
- **Buffer**: For chunk handling

### No New Dependencies
Maintaining zero runtime dependencies for maximum compatibility.

## Detailed Design

### 1. Line Reader Implementation

**File: `src/utils/line-reader.ts`**

```typescript
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
```

### 2. Stream Events Implementation

**File: `src/stream.ts`**

```typescript
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
```

### 3. Basic CLI Implementation

**File: `src/cli.ts`**

```typescript
#!/usr/bin/env node
import { createReadStream } from 'fs';
import { streamEvents } from './stream.js';
import { Vendor } from './types.js';

/**
 * Minimal CLI for testing the streaming engine
 * Full CLI with formatting will be implemented in Phase 3
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Basic argument parsing
  let vendor: Vendor = 'auto';
  let inputFile: string | null = null;
  let showHelp = false;
  let debug = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--vendor':
      case '-v':
        vendor = args[++i] as Vendor;
        break;
        
      case '--debug':
      case '-d':
        debug = true;
        break;
        
      case '--help':
      case '-h':
        showHelp = true;
        break;
        
      default:
        if (!arg.startsWith('-')) {
          inputFile = arg;
        }
    }
  }
  
  if (showHelp) {
    console.log(`agent-stream-fmt (Phase 2 - Basic CLI)

Usage: agent-stream-fmt [options] [file]

Options:
  --vendor, -v <vendor>  Vendor: auto, claude, gemini, amp (default: auto)
  --debug, -d            Show debug events
  --help, -h             Show this help

Examples:
  agent-stream-fmt output.jsonl
  agent-stream-fmt --vendor claude < output.jsonl
  claude --json "hello" | agent-stream-fmt --debug
`);
    process.exit(0);
  }
  
  try {
    // Create input stream
    const source = inputFile 
      ? createReadStream(inputFile, { encoding: 'utf8' })
      : process.stdin;
    
    // Stream and output events as JSON
    for await (const event of streamEvents({
      vendor,
      source,
      emitDebugEvents: debug
    })) {
      // Output each event as JSON (for testing)
      console.log(JSON.stringify(event));
    }
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
```

### 4. File Organization Update

```
src/
├── types.ts              # From Phase 1
├── parsers/              # From Phase 1
│   ├── types.ts
│   ├── index.ts
│   └── claude.ts
├── utils/                # New in Phase 2
│   ├── line-reader.ts
│   └── __tests__/
│       └── line-reader.test.ts
├── stream.ts             # New in Phase 2
├── cli.ts                # New in Phase 2
├── __tests__/
│   └── stream.test.ts
└── index.ts              # Updated exports
```

**Updated `src/index.ts`**:

```typescript
// Re-export all public types
export * from './types.js';
export type { VendorParser, ParseError } from './parsers/types.js';

// Export parser registry
export { registry, selectParser } from './parsers/index.js';

// Export streaming functions
export { streamEvents, collectEvents } from './stream.js';
export type { StreamOptions } from './stream.js';

// Export utilities
export { createLineReader, createLineReaderWithLineNumbers } from './utils/line-reader.js';
export type { LineReaderOptions } from './utils/line-reader.js';
```

## User Experience

Phase 2 provides both programmatic and CLI interfaces:

### Programmatic Usage

```typescript
import { streamEvents } from 'agent-stream-fmt';
import { createReadStream } from 'fs';

// Stream from file
const events = streamEvents({
  vendor: 'claude',
  source: createReadStream('session.jsonl')
});

for await (const event of events) {
  if (event.t === 'tool' && event.phase === 'end') {
    console.log(`Tool ${event.name} exited with code ${event.exitCode}`);
  }
}
```

### CLI Usage (Basic)

```bash
# Test with captured fixtures
$ node dist/cli.js tests/fixtures/claude/basic-message.jsonl
{"t":"msg","role":"user","text":"write hello world"}
{"t":"msg","role":"assistant","text":"Here's a hello world function..."}

# Test with pipe
$ claude --json "test" | node dist/cli.js --vendor claude --debug

# Auto-detect vendor
$ node dist/cli.js < mixed-output.jsonl
```

## Testing Strategy

### 1. Line Reader Tests

**File: `src/utils/__tests__/line-reader.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { createLineReader } from '../line-reader.js';

describe('Line reader', () => {
  it('handles complete lines', async () => {
    const input = 'line1\nline2\nline3\n';
    const stream = Readable.from(input);
    
    const lines = [];
    for await (const line of createLineReader(stream)) {
      lines.push(line);
    }
    
    expect(lines).toEqual(['line1', 'line2', 'line3']);
  });
  
  it('handles partial lines across chunks', async () => {
    const chunks = ['partial', ' line\ncomp', 'lete line\n'];
    const stream = Readable.from(chunks);
    
    const lines = [];
    for await (const line of createLineReader(stream)) {
      lines.push(line);
    }
    
    expect(lines).toEqual(['partial line', 'complete line']);
  });
  
  it('handles missing final newline', async () => {
    const input = 'line1\nline2\nlast line without newline';
    const stream = Readable.from(input);
    
    const lines = [];
    for await (const line of createLineReader(stream)) {
      lines.push(line);
    }
    
    expect(lines).toEqual(['line1', 'line2', 'last line without newline']);
  });
  
  it('enforces max line length', async () => {
    const longLine = 'x'.repeat(2000);
    const stream = Readable.from(longLine + '\nnext line');
    
    const lines = [];
    for await (const line of createLineReader(stream, { maxLineLength: 1000 })) {
      lines.push(line);
    }
    
    expect(lines[0].length).toBe(1000);
    expect(lines[1]).toBe('x'.repeat(1000));
    expect(lines[2]).toBe('next line');
  });
});
```

### 2. Stream Events Tests

**File: `src/__tests__/stream.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createReadStream } from 'fs';
import { join } from 'path';
import { streamEvents, collectEvents } from '../stream.js';
import { Readable } from 'stream';

describe('Stream events', () => {
  const fixturesDir = join(process.cwd(), 'tests/fixtures');
  
  describe('fixture processing', () => {
    it('streams all Claude fixtures without errors', async () => {
      const files = ['basic-message.jsonl', 'tool-use.jsonl', 'complex-session.jsonl'];
      
      for (const file of files) {
        const source = createReadStream(join(fixturesDir, 'claude', file));
        const events = await collectEvents({ vendor: 'claude', source });
        
        // Should have events and no unhandled errors
        expect(events.length).toBeGreaterThan(0);
        
        // Count error events
        const errors = events.filter(e => e.t === 'error');
        expect(errors.length).toBe(0);
      }
    });
  });
  
  describe('error handling', () => {
    it('continues on parse errors by default', async () => {
      const input = [
        '{"type":"message","content":"valid"}',
        'invalid json',
        '{"type":"message","content":"also valid"}'
      ].join('\n');
      
      const source = Readable.from(input);
      const events = await collectEvents({ vendor: 'claude', source });
      
      expect(events).toHaveLength(3);
      expect(events[0].t).toBe('msg');
      expect(events[1].t).toBe('error');
      expect(events[2].t).toBe('msg');
    });
    
    it('stops on error when continueOnError is false', async () => {
      const input = [
        '{"type":"message","content":"valid"}',
        'invalid json',
        '{"type":"message","content":"never reached"}'
      ].join('\n');
      
      const source = Readable.from(input);
      
      await expect(
        collectEvents({ 
          vendor: 'claude', 
          source, 
          continueOnError: false 
        })
      ).rejects.toThrow();
    });
  });
  
  describe('auto-detection', () => {
    it('detects Claude format', async () => {
      const input = '{"type":"message","role":"assistant","content":"Hello"}';
      const source = Readable.from(input);
      
      const events = await collectEvents({ 
        vendor: 'auto', 
        source,
        emitDebugEvents: true 
      });
      
      // First event should be debug with detected vendor
      expect(events[0].t).toBe('debug');
      expect(events[0].raw.detected).toBe('claude');
      
      // Second event should be the parsed message
      expect(events[1].t).toBe('msg');
    });
  });
});
```

### 3. CLI Tests

**File: `src/__tests__/cli.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';

describe('CLI', () => {
  const cliPath = join(process.cwd(), 'dist/cli.js');
  const fixturesDir = join(process.cwd(), 'tests/fixtures');
  
  it('processes fixture file', async () => {
    const proc = spawn('node', [
      cliPath,
      join(fixturesDir, 'claude/basic-message.jsonl')
    ]);
    
    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    await new Promise((resolve, reject) => {
      proc.on('exit', (code) => {
        if (code === 0) resolve(void 0);
        else reject(new Error(`Exit code: ${code}`));
      });
    });
    
    // Output should be valid JSON events
    const lines = output.trim().split('\n');
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
```

## Performance Considerations

### Memory Efficiency
1. **Streaming architecture**: Never load entire file into memory
2. **Line buffer limit**: Prevent unbounded buffer growth
3. **Lazy parsing**: Parse only when iterating
4. **No event accumulation**: Yield events immediately

### Throughput Optimization
1. **Minimal allocations**: Reuse buffers where possible
2. **Fast path for complete lines**: Avoid unnecessary string operations
3. **Batch processing ready**: Design supports future batching

### Benchmarking

```typescript
// bench/throughput.ts
import { streamEvents } from '../dist/index.js';
import { Readable } from 'stream';

const lines = 100_000;
const testLine = '{"type":"message","content":"Test message for benchmarking"}\n';
const data = testLine.repeat(lines);

const start = process.hrtime.bigint();
let count = 0;

for await (const event of streamEvents({
  vendor: 'claude',
  source: Readable.from(data)
})) {
  count++;
}

const elapsed = process.hrtime.bigint() - start;
const linesPerSec = (lines * 1e9) / Number(elapsed);

console.log(`Processed ${count} events from ${lines} lines`);
console.log(`Throughput: ${linesPerSec.toFixed(0)} lines/sec`);
console.log(`Memory: ${process.memoryUsage().rss / 1024 / 1024}MB RSS`);
```

## Security Considerations

1. **Line length limits**: Prevent DoS via huge lines
2. **Error count limits**: Stop processing after too many errors
3. **No eval/Function**: Never execute parsed content
4. **Resource cleanup**: Always close streams properly
5. **Input validation**: Validate vendor parameter

## Documentation

### Created in Phase 2

1. **Streaming guide**: How to use `streamEvents`
2. **Error handling**: Recovery strategies and options
3. **Performance tips**: Best practices for large files

### Example Documentation

```markdown
# Streaming Guide

## Basic Usage

```typescript
import { streamEvents } from 'agent-stream-fmt';

for await (const event of streamEvents({ 
  vendor: 'claude', 
  source: process.stdin 
})) {
  console.log(event);
}
```

## Error Handling

By default, parse errors are converted to error events:

```typescript
for await (const event of streamEvents({ vendor: 'claude', source })) {
  if (event.t === 'error') {
    console.error('Parse error:', event.message);
  } else {
    // Process normal event
  }
}
```

## Memory Management

The streaming engine uses constant memory regardless of input size.
For a 1GB JSONL file, memory usage stays under 20MB.
```

## Implementation Phases

Within Phase 2:

1. **Line reader** (3-4 hours)
   - Implement chunk handling
   - Add tests for edge cases
   - Benchmark performance

2. **Stream events** (3-4 hours)
   - Implement async generator
   - Add error handling
   - Test with all fixtures

3. **Basic CLI** (2 hours)
   - Create minimal interface
   - Add basic arguments
   - Test end-to-end

4. **Integration testing** (2 hours)
   - Test all fixtures
   - Verify memory bounds
   - Measure throughput

## Open Questions

1. **Chunk size**: What's the optimal read chunk size?
2. **Error recovery**: Should we attempt to resync after errors?
3. **Parallel parsing**: Can we parse multiple lines concurrently?
4. **Stream metadata**: Should we track line numbers globally?
5. **Progress reporting**: How to report progress for large files?

## References

- [Node.js Streams documentation](https://nodejs.org/api/stream.html)
- [AsyncIterator protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols)
- [Backpressuring in Streams](https://nodejs.org/en/docs/guides/backpressuring-in-streams/)
- Phase 0 fixtures
- Phase 1 parser implementation

## Next Steps

After Phase 2 completion:
1. Verify streaming works with all fixtures
2. Confirm memory stays bounded
3. Measure throughput performance
4. Document any issues found
5. Proceed to Phase 3: Rendering Engine