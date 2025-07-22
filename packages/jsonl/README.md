# @agent-io/jsonl

JSONL parsing framework for AI agent CLIs.

## Installation

```bash
npm install @agent-io/jsonl
# or
yarn add @agent-io/jsonl
# or
pnpm add @agent-io/jsonl
```

## Usage

This package provides the parser interface and utilities for implementing vendor-specific JSONL
parsers.

```typescript
import { VendorParser, ParseError } from '@agent-io/jsonl';
import { AgentEvent } from '@agent-io/core';

// Implement a custom parser
const myParser: VendorParser = {
  vendor: 'mycli',

  detect: (line: string) => {
    try {
      const obj = JSON.parse(line);
      return obj.source === 'mycli';
    } catch {
      return false;
    }
  },

  parse: (line: string) => {
    try {
      const obj = JSON.parse(line);
      return parseMyCliFormat(obj);
    } catch (error) {
      throw new ParseError('Invalid JSON format', 'mycli', line, error);
    }
  },
};
```

## API Reference

### Interfaces

#### `VendorParser`

Core interface that all vendor parsers must implement:

```typescript
interface VendorParser {
  /** Unique vendor identifier */
  vendor: string;

  /**
   * Detect if a line belongs to this vendor's format
   * Should be fast and avoid throwing errors
   */
  detect: (line: string) => boolean;

  /**
   * Parse a single line into zero or more events
   * May throw ParseError for invalid input
   */
  parse: (line: string) => AgentEvent[];

  /** Optional metadata about the parser */
  metadata?: {
    version?: string;
    supportedVersions?: string[];
    documentationUrl?: string;
  };
}
```

#### `ParseOptions`

Options for configuring parsing behavior:

```typescript
interface ParseOptions {
  /** Vendor format to use (default: 'auto') */
  vendor?: Vendor;

  /** Enable strict parsing mode */
  strict?: boolean;
}
```

### Classes

#### `ParseError`

Error class for parsing failures with detailed context:

```typescript
class ParseError extends Error {
  constructor(
    message: string,
    vendor: string,
    line: string,
    cause?: unknown,
    context?: {
      lineNumber?: number;
      characterPosition?: number;
      expectedFormat?: string;
    },
  );

  vendor: string; // Which parser failed
  line: string; // The problematic line
  cause?: unknown; // Original error
  context?: object; // Additional context
}
```

### Error Handling

#### Throwing ParseError

```typescript
parse: (line: string) => {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch (error) {
    throw new ParseError('Invalid JSON', 'mycli', line, error, { expectedFormat: 'JSON object' });
  }

  if (!obj.type) {
    throw new ParseError('Missing required field: type', 'mycli', line, undefined, {
      expectedFormat: '{ type: string, ... }',
    });
  }

  // Parse logic...
};
```

#### Handling ParseError

```typescript
try {
  const events = parser.parse(line);
} catch (error) {
  if (error instanceof ParseError) {
    console.error(`Parse error in ${error.vendor}:`);
    console.error(`  Message: ${error.message}`);
    console.error(`  Line: ${error.line}`);

    if (error.context?.lineNumber) {
      console.error(`  Line number: ${error.context.lineNumber}`);
    }

    if (error.cause) {
      console.error(`  Caused by:`, error.cause);
    }
  }
}
```

## Parser Implementation Guide

### Basic Parser Structure

```typescript
import { VendorParser, ParseError } from '@agent-io/jsonl';
import { AgentEvent } from '@agent-io/core';

export const myParser: VendorParser = {
  vendor: 'mycli',

  metadata: {
    version: '1.0.0',
    supportedVersions: ['1.x', '2.x'],
    documentationUrl: 'https://mycli.example.com/docs',
  },

  detect: (line: string) => {
    // Fast detection logic
    // Avoid parsing if possible
    if (!line.includes('"source":"mycli"')) {
      return false;
    }

    try {
      const obj = JSON.parse(line);
      return obj.source === 'mycli' && obj.version >= 1;
    } catch {
      return false;
    }
  },

  parse: (line: string) => {
    const events: AgentEvent[] = [];

    let obj;
    try {
      obj = JSON.parse(line);
    } catch (error) {
      throw new ParseError('Invalid JSON', 'mycli', line, error);
    }

    // Convert to AgentEvent format
    switch (obj.type) {
      case 'message':
        events.push({
          t: 'msg',
          role: obj.role || 'assistant',
          text: obj.content || '',
        });
        break;

      case 'tool_call':
        events.push({
          t: 'tool',
          name: obj.tool_name,
          phase: 'start',
        });
        break;

      // Handle other types...
    }

    return events;
  },
};
```

### Detection Best Practices

1. **Fast Path First**: Check simple string patterns before parsing JSON
2. **Avoid Exceptions**: Use try-catch to prevent detection errors
3. **Be Specific**: Return true only for definite matches

```typescript
detect: (line: string) => {
  // Fast string checks
  if (!line.startsWith('{') || !line.includes('"mycli"')) {
    return false;
  }

  // Detailed validation only if fast check passes
  try {
    const obj = JSON.parse(line);
    return obj.vendor === 'mycli' && obj.version >= 1.0 && typeof obj.type === 'string';
  } catch {
    return false;
  }
};
```

### Parsing Best Practices

1. **Validate Input**: Check required fields exist
2. **Handle Missing Data**: Provide sensible defaults
3. **Clear Errors**: Include context in ParseError

```typescript
parse: (line: string) => {
  const obj = JSON.parse(line); // Throws on invalid JSON

  // Validate structure
  if (!obj || typeof obj !== 'object') {
    throw new ParseError('Expected JSON object', 'mycli', line, undefined, {
      expectedFormat: 'object',
    });
  }

  const events: AgentEvent[] = [];

  // Safe property access
  const type = obj.type || 'unknown';
  const content = obj.content || '';
  const metadata = obj.metadata || {};

  // Convert to events...

  return events;
};
```

### Multi-Event Parsing

Some lines may produce multiple events:

```typescript
parse: (line: string) => {
  const obj = JSON.parse(line);
  const events: AgentEvent[] = [];

  // A tool execution with output
  if (obj.type === 'tool_execution') {
    // Start event
    events.push({
      t: 'tool',
      name: obj.tool,
      phase: 'start',
    });

    // Output events
    if (obj.stdout) {
      events.push({
        t: 'tool',
        name: obj.tool,
        phase: 'stdout',
        text: obj.stdout,
      });
    }

    if (obj.stderr) {
      events.push({
        t: 'tool',
        name: obj.tool,
        phase: 'stderr',
        text: obj.stderr,
      });
    }

    // End event
    events.push({
      t: 'tool',
      name: obj.tool,
      phase: 'end',
      exitCode: obj.exitCode || 0,
    });
  }

  return events;
};
```

## Testing Parsers

### Unit Testing

```typescript
import { describe, it, expect } from 'vitest';
import { myParser } from './my-parser';
import { ParseError } from '@agent-io/jsonl';

describe('MyParser', () => {
  describe('detect', () => {
    it('should detect valid mycli format', () => {
      const line = '{"source":"mycli","version":1,"type":"message"}';
      expect(myParser.detect(line)).toBe(true);
    });

    it('should reject other formats', () => {
      expect(myParser.detect('{"type":"claude"}')).toBe(false);
      expect(myParser.detect('not json')).toBe(false);
      expect(myParser.detect('')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse message events', () => {
      const line = '{"source":"mycli","type":"message","content":"Hello"}';
      const events = myParser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: 'Hello',
      });
    });

    it('should throw ParseError for invalid JSON', () => {
      expect(() => myParser.parse('invalid')).toThrow(ParseError);
    });
  });
});
```

### Integration Testing

```typescript
import { createReadStream } from 'fs';
import { streamEvents } from '@agent-io/stream';

// Test with real fixture files
const fixtures = ['fixtures/mycli/session1.jsonl', 'fixtures/mycli/session2.jsonl'];

for (const fixture of fixtures) {
  it(`should parse ${fixture}`, async () => {
    const source = createReadStream(fixture);
    const events = [];

    for await (const event of streamEvents({
      vendor: 'mycli',
      source,
    })) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.t === 'msg')).toBe(true);
  });
}
```

## Examples

### Streaming Parser

```typescript
import { VendorParser } from '@agent-io/jsonl';

// Parser that handles streaming chunks
export const streamingParser: VendorParser = {
  vendor: 'stream-cli',

  detect: (line: string) => {
    return line.includes('"stream":true');
  },

  parse: (line: string) => {
    const obj = JSON.parse(line);
    const events: AgentEvent[] = [];

    // Handle streaming text chunks
    if (obj.type === 'text_delta') {
      events.push({
        t: 'msg',
        role: 'assistant',
        text: obj.delta || '',
      });
    }

    // Handle streaming completions
    if (obj.type === 'completion' && obj.partial) {
      events.push({
        t: 'msg',
        role: 'assistant',
        text: obj.text || '',
      });
    }

    return events;
  },
};
```

### Error Recovery Parser

```typescript
import { VendorParser, ParseError } from '@agent-io/jsonl';

// Parser with graceful error handling
export const resilientParser: VendorParser = {
  vendor: 'resilient-cli',

  detect: (line: string) => {
    return line.includes('resilient-cli');
  },

  parse: (line: string) => {
    let obj;

    // Try to parse as JSON
    try {
      obj = JSON.parse(line);
    } catch {
      // Fall back to parsing key=value format
      const match = line.match(/type=(\w+) content="([^"]+)"/);
      if (match) {
        obj = { type: match[1], content: match[2] };
      } else {
        throw new ParseError('Unrecognized format', 'resilient-cli', line);
      }
    }

    // Convert to events...
    return [];
  },
};
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.
