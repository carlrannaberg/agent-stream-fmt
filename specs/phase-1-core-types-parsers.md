# Phase 1: Core Types & Parser Infrastructure

**Status**: Draft  
**Authors**: Claude Assistant  
**Date**: 2025-07-16  
**Version**: 1.0.0

## Overview

Phase 1 establishes the foundational type system and parser infrastructure for the agent-stream-fmt
package. This phase focuses on defining the core data structures, implementing the Claude parser (as
the primary parser), and creating a flexible parser registry that can accommodate additional
vendors. This phase assumes Phase 0 has been completed and fixtures are available for testing.

## Background/Problem Statement

With fixtures captured in Phase 0, we now need to:

1. Define a unified event model that can represent all vendor-specific formats
2. Create a parser architecture that's extensible and maintainable
3. Implement the first parser (Claude) to validate our design
4. Establish patterns for error handling and edge cases
5. Build a test framework that validates parsers against real fixtures

The core challenge is creating abstractions that are:

- **Specific enough** to capture important event details
- **Generic enough** to work across all vendors
- **Efficient enough** for streaming processing
- **Simple enough** for easy implementation

## Goals

- **Define** the complete TypeScript type system for the package
- **Implement** the parser interface and registry system
- **Create** a fully-functional Claude parser based on fixtures
- **Establish** testing patterns using captured fixtures
- **Document** parser implementation guidelines
- **Validate** the design can handle all discovered event types

## Non-Goals

- **Not implementing** Gemini or Amp parsers (Phase 4)
- **Not building** the streaming engine (Phase 2)
- **Not creating** rendering logic (Phase 3)
- **Not optimizing** for performance yet
- **Not handling** streaming backpressure (Phase 2)
- **Not building** the CLI interface

## Technical Dependencies

### From Phase 0

- **Captured fixtures**: Real JSONL outputs in `tests/fixtures/`
- **Schema analysis**: Understanding of event types from each vendor
- **TypeScript setup**: Configured build environment

### New in Phase 1

- No new runtime dependencies (staying minimal)
- Development dependencies already installed in Phase 0

## Detailed Design

### 1. Core Type Definitions

**File: `src/types.ts`**

```typescript
/**
 * Normalized event types emitted by the parser
 */
export type AgentEvent = MessageEvent | ToolEvent | CostEvent | ErrorEvent | DebugEvent;

export interface MessageEvent {
  t: 'msg';
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export interface ToolEvent {
  t: 'tool';
  name: string;
  phase: 'start' | 'stdout' | 'stderr' | 'end';
  text?: string;
  exitCode?: number;
}

export interface CostEvent {
  t: 'cost';
  deltaUsd: number;
}

export interface ErrorEvent {
  t: 'error';
  message: string;
}

export interface DebugEvent {
  t: 'debug';
  raw: any;
}

/**
 * Supported vendor identifiers
 */
export type Vendor = 'auto' | 'claude' | 'gemini' | 'amp';

/**
 * Options for streaming events
 */
export interface StreamEventOptions {
  vendor: Vendor;
  source: NodeJS.ReadableStream;
}

/**
 * Options for formatting output
 */
export interface FmtOptions {
  /** Group tool phases into collapsible blocks */
  collapseTools?: boolean;

  /** Completely hide tool events */
  hideTools?: boolean;

  /** Hide cost information */
  hideCost?: boolean;

  /** Output format: true = ANSI, false = plain, 'html' = HTML */
  ansi?: boolean | 'html';

  /** Callback for every parsed event (before filtering) */
  onEvent?: (ev: AgentEvent) => void;

  /** Batch size for write operations (performance tuning) */
  chunkSize?: number;
}

/**
 * Type guards for event discrimination
 */
export const isMessageEvent = (e: AgentEvent): e is MessageEvent => e.t === 'msg';
export const isToolEvent = (e: AgentEvent): e is ToolEvent => e.t === 'tool';
export const isCostEvent = (e: AgentEvent): e is CostEvent => e.t === 'cost';
export const isErrorEvent = (e: AgentEvent): e is ErrorEvent => e.t === 'error';
export const isDebugEvent = (e: AgentEvent): e is DebugEvent => e.t === 'debug';
```

### 2. Parser Interface

**File: `src/parsers/types.ts`**

```typescript
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
   */
  detect: (line: string) => boolean;

  /**
   * Parse a single line into zero or more events
   * May throw errors for invalid JSON
   */
  parse: (line: string) => AgentEvent[];

  /**
   * Optional metadata about the parser
   */
  metadata?: {
    version?: string;
    supportedVersions?: string[];
    documentationUrl?: string;
  };
}

/**
 * Parser registration entry
 */
export interface ParserEntry {
  parser: VendorParser;
  priority: number; // Higher priority parsers are tried first
}

/**
 * Error thrown when parsing fails
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly vendor: string,
    public readonly line: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ParseError';
  }
}
```

### 3. Claude Parser Implementation

**File: `src/parsers/claude.ts`**

```typescript
import { VendorParser, ParseError } from './types.js';
import { AgentEvent, MessageEvent, ToolEvent, CostEvent } from '../types.js';

/**
 * Claude Code JSONL parser
 * Based on fixtures captured with --json flag
 */
export class ClaudeParser implements VendorParser {
  vendor = 'claude';

  metadata = {
    version: '1.0.0',
    supportedVersions: ['3.5', '3.6'],
    documentationUrl: 'https://docs.anthropic.com/claude-code/cli-reference',
  };

  detect(line: string): boolean {
    try {
      const obj = JSON.parse(line);
      // Claude messages have type field
      return (
        typeof obj.type === 'string' &&
        (obj.type === 'message' ||
          obj.type === 'tool_use' ||
          obj.type === 'tool_result' ||
          obj.type === 'usage')
      );
    } catch {
      return false;
    }
  }

  parse(line: string): AgentEvent[] {
    let obj: any;
    try {
      obj = JSON.parse(line);
    } catch (error) {
      throw new ParseError('Invalid JSON', this.vendor, line, error);
    }

    const events: AgentEvent[] = [];

    switch (obj.type) {
      case 'message':
        events.push(this.parseMessage(obj));
        break;

      case 'tool_use':
        events.push(this.parseToolStart(obj));
        break;

      case 'tool_result':
        events.push(...this.parseToolResult(obj));
        break;

      case 'usage':
        const cost = this.parseUsage(obj);
        if (cost) events.push(cost);
        break;

      default:
        // Unknown event type - emit as debug
        events.push({
          t: 'debug',
          raw: obj,
        });
    }

    return events;
  }

  private parseMessage(obj: any): MessageEvent {
    return {
      t: 'msg',
      role: obj.role || 'assistant',
      text: obj.content || '',
    };
  }

  private parseToolStart(obj: any): ToolEvent {
    return {
      t: 'tool',
      name: obj.name || 'unknown',
      phase: 'start',
      text: obj.input ? JSON.stringify(obj.input, null, 2) : undefined,
    };
  }

  private parseToolResult(obj: any): ToolEvent[] {
    const events: ToolEvent[] = [];

    // Tool output (stdout)
    if (obj.content) {
      events.push({
        t: 'tool',
        name: obj.tool_use_id || 'unknown',
        phase: 'stdout',
        text: typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content),
      });
    }

    // Tool errors (stderr)
    if (obj.error) {
      events.push({
        t: 'tool',
        name: obj.tool_use_id || 'unknown',
        phase: 'stderr',
        text: obj.error.message || JSON.stringify(obj.error),
      });
    }

    // Tool completion
    events.push({
      t: 'tool',
      name: obj.tool_use_id || 'unknown',
      phase: 'end',
      exitCode: obj.error ? 1 : 0,
    });

    return events;
  }

  private parseUsage(obj: any): CostEvent | null {
    // Calculate cost based on token usage
    // Prices are approximate and should be configurable
    const inputTokens = obj.usage?.input_tokens || 0;
    const outputTokens = obj.usage?.output_tokens || 0;

    if (inputTokens === 0 && outputTokens === 0) {
      return null;
    }

    // Claude 3.5 Sonnet pricing (example)
    const inputCostPerToken = 0.000003;
    const outputCostPerToken = 0.000015;

    const deltaUsd = inputTokens * inputCostPerToken + outputTokens * outputCostPerToken;

    return {
      t: 'cost',
      deltaUsd,
    };
  }
}

// Export singleton instance
export const claudeParser = new ClaudeParser();
```

### 4. Parser Registry

**File: `src/parsers/index.ts`**

```typescript
import { VendorParser, ParserEntry } from './types.js';
import { claudeParser } from './claude.js';
// Future: import { geminiParser } from './gemini.js';
// Future: import { ampParser } from './amp.js';

/**
 * Registry of all available parsers
 */
export class ParserRegistry {
  private parsers: Map<string, ParserEntry> = new Map();

  constructor() {
    // Register built-in parsers
    this.register(claudeParser, 100);
    // Future: this.register(geminiParser, 90);
    // Future: this.register(ampParser, 80);
  }

  /**
   * Register a parser with priority
   */
  register(parser: VendorParser, priority = 50): void {
    this.parsers.set(parser.vendor, { parser, priority });
  }

  /**
   * Get parser by vendor name
   */
  get(vendor: string): VendorParser | undefined {
    return this.parsers.get(vendor)?.parser;
  }

  /**
   * Auto-detect vendor from a line
   */
  detect(line: string): VendorParser | undefined {
    // Sort by priority (highest first)
    const entries = Array.from(this.parsers.values()).sort((a, b) => b.priority - a.priority);

    for (const entry of entries) {
      if (entry.parser.detect(line)) {
        return entry.parser;
      }
    }

    return undefined;
  }

  /**
   * Get all registered vendors
   */
  getVendors(): string[] {
    return Array.from(this.parsers.keys());
  }
}

// Export singleton registry
export const registry = new ParserRegistry();

/**
 * Helper to select parser based on vendor option
 */
export function selectParser(vendor: string, firstLine?: string): VendorParser {
  if (vendor === 'auto') {
    if (!firstLine) {
      throw new Error('Auto-detection requires at least one line');
    }

    const detected = registry.detect(firstLine);
    if (!detected) {
      throw new Error(`Failed to auto-detect vendor from line: ${firstLine.substring(0, 100)}...`);
    }

    return detected;
  }

  const parser = registry.get(vendor);
  if (!parser) {
    throw new Error(`Unknown vendor: ${vendor}. Available: ${registry.getVendors().join(', ')}`);
  }

  return parser;
}
```

### 5. File Organization

```
src/
├── types.ts              # Core type definitions
├── parsers/
│   ├── types.ts         # Parser interfaces
│   ├── index.ts         # Parser registry
│   ├── claude.ts        # Claude parser
│   └── __tests__/
│       ├── claude.test.ts
│       └── registry.test.ts
└── index.ts             # Main exports
```

**File: `src/index.ts`**

```typescript
// Re-export all public types
export * from './types.js';
export type { VendorParser, ParseError } from './parsers/types.js';

// Export parser registry
export { registry, selectParser } from './parsers/index.js';

// Future exports will include:
// export { streamEvents, streamFormat } from './stream.js';
```

## User Experience

Phase 1 provides the foundation that future phases will build upon. Developers can:

1. **Import types** for TypeScript projects:

   ```typescript
   import { AgentEvent, isMessageEvent } from 'agent-stream-fmt';
   ```

2. **Test parsers** directly:

   ```typescript
   import { registry } from 'agent-stream-fmt';

   const parser = registry.get('claude');
   const events = parser.parse(jsonLine);
   ```

3. **Extend with custom parsers**:

   ```typescript
   import { registry, VendorParser } from 'agent-stream-fmt';

   class CustomParser implements VendorParser {
     // Implementation
   }

   registry.register(new CustomParser(), 70);
   ```

## Testing Strategy

### 1. Type Safety Tests

**File: `src/types.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { isMessageEvent, isToolEvent, AgentEvent } from './types.js';

describe('Type guards', () => {
  it('correctly identifies message events', () => {
    const event: AgentEvent = { t: 'msg', role: 'user', text: 'hello' };
    expect(isMessageEvent(event)).toBe(true);
    expect(isToolEvent(event)).toBe(false);
  });

  it('provides type narrowing', () => {
    const event: AgentEvent = { t: 'msg', role: 'user', text: 'hello' };
    if (isMessageEvent(event)) {
      // TypeScript knows event.role exists here
      expect(event.role).toBe('user');
    }
  });
});
```

### 2. Claude Parser Tests

**File: `src/parsers/__tests__/claude.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { claudeParser } from '../claude.js';
import { MessageEvent, ToolEvent } from '../../types.js';

describe('Claude parser', () => {
  const fixturesDir = join(process.cwd(), 'tests/fixtures/claude');

  describe('detection', () => {
    it('detects Claude message format', () => {
      const line = '{"type":"message","role":"assistant","content":"Hello"}';
      expect(claudeParser.detect(line)).toBe(true);
    });

    it('rejects non-Claude formats', () => {
      const line = '{"kind":"content","data":{"text":"Hello"}}'; // Gemini
      expect(claudeParser.detect(line)).toBe(false);
    });
  });

  describe('parsing real fixtures', () => {
    it('parses basic-message.jsonl', () => {
      const content = readFileSync(join(fixturesDir, 'basic-message.jsonl'), 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        const events = claudeParser.parse(line);
        expect(events.length).toBeGreaterThan(0);

        // Verify no parse errors
        expect(events.every(e => e.t !== 'error')).toBe(true);
      }
    });

    it('parses tool-use.jsonl correctly', () => {
      const content = readFileSync(join(fixturesDir, 'tool-use.jsonl'), 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      const allEvents: AgentEvent[] = [];
      for (const line of lines) {
        allEvents.push(...claudeParser.parse(line));
      }

      // Verify tool lifecycle
      const toolEvents = allEvents.filter(e => e.t === 'tool') as ToolEvent[];
      const toolStarts = toolEvents.filter(e => e.phase === 'start');
      const toolEnds = toolEvents.filter(e => e.phase === 'end');

      expect(toolStarts.length).toBeGreaterThan(0);
      expect(toolEnds.length).toBe(toolStarts.length);
    });
  });

  describe('edge cases', () => {
    it('handles malformed JSON', () => {
      const line = '{"type":"message","content":"unclosed';
      expect(() => claudeParser.parse(line)).toThrow('Invalid JSON');
    });

    it('handles unknown event types as debug', () => {
      const line = '{"type":"unknown","data":"something"}';
      const events = claudeParser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0].t).toBe('debug');
    });
  });
});
```

### 3. Registry Tests

**File: `src/parsers/__tests__/registry.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ParserRegistry } from '../index.js';
import { VendorParser } from '../types.js';

describe('Parser registry', () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    registry = new ParserRegistry();
  });

  it('auto-detects Claude format', () => {
    const line = '{"type":"message","role":"assistant","content":"Hi"}';
    const parser = registry.detect(line);

    expect(parser).toBeDefined();
    expect(parser?.vendor).toBe('claude');
  });

  it('returns undefined for unknown formats', () => {
    const line = '{"unknown":"format"}';
    const parser = registry.detect(line);

    expect(parser).toBeUndefined();
  });

  it('respects parser priority', () => {
    const mockParser1: VendorParser = {
      vendor: 'mock1',
      detect: () => true,
      parse: () => [],
    };

    const mockParser2: VendorParser = {
      vendor: 'mock2',
      detect: () => true,
      parse: () => [],
    };

    registry.register(mockParser1, 50);
    registry.register(mockParser2, 100);

    const detected = registry.detect('anything');
    expect(detected?.vendor).toBe('mock2'); // Higher priority
  });
});
```

## Performance Considerations

While Phase 1 doesn't focus on optimization, we establish patterns for efficiency:

1. **Lazy parsing**: Don't parse fields we don't need
2. **Minimal allocations**: Reuse objects where possible
3. **Fast detection**: Detection should be quick and avoid full parsing
4. **Error boundaries**: Failed parsing shouldn't crash the stream

Benchmarking will be added in Phase 5.

## Security Considerations

1. **JSON parsing safety**: Use native `JSON.parse()` with try-catch
2. **Size limits**: Future phases will add line size limits
3. **No code execution**: Never eval or execute parsed content
4. **Sanitization**: Tool output is preserved as-is (sanitization is renderer's job)

## Documentation

### Created in Phase 1

1. **Type documentation**: TSDoc comments on all public types
2. **Parser guide**: How to implement a new vendor parser
3. **Test examples**: Patterns for testing against fixtures

### Parser Implementation Guide

Create `docs/adding-parsers.md`:

````markdown
# Adding a New Parser

To add support for a new agent CLI:

1. Create `src/parsers/yourvendor.ts`
2. Implement the `VendorParser` interface
3. Register in `src/parsers/index.ts`
4. Add tests using captured fixtures

## Example Structure

```typescript
export class YourParser implements VendorParser {
  vendor = 'yourvendor';

  detect(line: string): boolean {
    // Quick detection logic
  }

  parse(line: string): AgentEvent[] {
    // Full parsing logic
  }
}
```
````

## Testing

Always test against real fixtures captured from the agent.

```

## Implementation Phases

This spec IS Phase 1. Sub-tasks within Phase 1:

1. **Core types** (2 hours)
   - Define all TypeScript interfaces
   - Add type guards and utilities
   - Document with TSDoc

2. **Parser interfaces** (1 hour)
   - Define VendorParser interface
   - Create ParseError class
   - Document extension points

3. **Claude parser** (3-4 hours)
   - Implement based on fixtures
   - Handle all event types
   - Add comprehensive tests

4. **Parser registry** (2 hours)
   - Build registration system
   - Implement auto-detection
   - Add priority handling

5. **Integration** (1 hour)
   - Wire everything together
   - Verify against all fixtures
   - Update documentation

## Open Questions

1. **Tool naming**: Should we track tool names separately from IDs?
2. **Cost calculation**: Should cost logic be in parser or separate?
3. **Streaming state**: Do any events require stateful parsing?
4. **Error recovery**: How much context to preserve on parse errors?
5. **Version detection**: Should parsers detect and adapt to versions?

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Node.js Streams](https://nodejs.org/api/stream.html)
- Phase 0 fixtures and schema analysis
- [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md)
- [`testing-strategy.md`](./testing-strategy.md)

## Next Steps

After Phase 1 completion:
1. Run all tests against captured fixtures
2. Verify Claude parser handles all event types
3. Document any new event types discovered
4. Proceed to Phase 2: Streaming Engine
```
