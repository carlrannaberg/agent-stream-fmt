# JSONL Stream Formatter for Agent CLIs

**Status**: Draft  
**Authors**: Claude Assistant  
**Date**: 2025-07-16  
**Version**: 1.0.0  

## Overview

The `agent-stream-fmt` package is a pure stream transformer that normalizes JSONL output from various AI agent CLIs (Claude Code, Gemini CLI, and Amp Code) into a unified event format and renders human-readable text or HTML output. It acts as a universal adapter between agent-specific output formats and downstream consumers (human readers, UIs, or programmatic processors).

## Background/Problem Statement

AI agent CLIs have become essential development tools, but each vendor outputs different JSONL formats:
- Claude Code uses `{"type":"message","role":"assistant","content":"…"}`
- Gemini CLI uses `{"kind":"content","data":{"role":"user","text":"…"}}`
- Amp Code uses `{"phase":"tool","name":"npm_test",…}`

This fragmentation creates several problems:
1. **Integration complexity**: Each consumer must handle vendor-specific formats
2. **Display inconsistency**: Different tools require different rendering logic
3. **Maintenance burden**: Changes to vendor formats break downstream tools
4. **Limited reusability**: Can't easily switch between agents or compare outputs

## Goals

- **Normalize** diverse JSONL formats into a single, well-defined event vocabulary
- **Stream efficiently** with bounded memory usage regardless of log size
- **Render beautifully** to ANSI terminals or HTML with consistent styling
- **Filter flexibly** with Unix-style command-line options
- **Integrate easily** via both CLI and programmatic SDK interfaces
- **Fail fast** on unrecognized formats to avoid silent corruption
- **Extend simply** to support new agent vendors without breaking changes

## Non-Goals

- **Not an orchestrator**: Does not run agents or manage their lifecycle
- **Not a logger**: Does not persist events or manage log files
- **Not a UI framework**: Provides basic HTML output, not a full web interface
- **Not a parser library**: Focused specifically on agent JSONL formats
- **Not a protocol converter**: Does not transform between different agent protocols
- **Not a message editor**: Preserves original content without modification

## Technical Dependencies

### Core Dependencies
- **Node.js**: >= 18.0.0 (for native stream support and performance)
- **TypeScript**: 5.x (for type safety and developer experience)
- **kleur**: ^4.1.5 (lightweight ANSI color library, 2KB, zero dependencies)

### Build Dependencies
- **tsup**: For zero-config TypeScript builds
- **vitest**: For testing (unit and integration)

### Peer Dependencies
- None (intentionally dependency-free for maximum compatibility)

## Detailed Design

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────┐
│ JSONL Input │────▶│ Vendor       │────▶│ Event      │────▶│ Renderer │
│   (stdin)   │     │ Detector     │     │ Normalizer │     │ (ANSI/   │
└─────────────┘     └──────────────┘     └────────────┘     │  HTML)   │
                            │                     │           └──────────┘
                            ▼                     ▼                 │
                    ┌──────────────┐     ┌────────────┐            ▼
                    │ Parser       │────▶│ AgentEvent │     ┌──────────┐
                    │ Registry     │     │   Stream   │     │  Output  │
                    └──────────────┘     └────────────┘     │ (stdout) │
                                                             └──────────┘
```

### Core Types

```typescript
// src/types.ts
export type AgentEvent =
  | { t: 'msg'; role: 'user' | 'assistant' | 'system'; text: string }
  | { t: 'tool'; name: string; phase: 'start' | 'stdout' | 'stderr' | 'end'; text?: string; exitCode?: number }
  | { t: 'cost'; deltaUsd: number }
  | { t: 'error'; message: string }
  | { t: 'debug'; raw: any };

export type Vendor = 'auto' | 'claude' | 'gemini' | 'amp';

export interface StreamEventOptions {
  vendor: Vendor;
  source: NodeJS.ReadableStream;
}

export interface FmtOptions {
  collapseTools?: boolean;
  hideTools?: boolean;
  hideCost?: boolean;
  ansi?: boolean | 'html';
  onEvent?: (ev: AgentEvent) => void;
  chunkSize?: number;
}
```

### Parser Architecture

Each vendor parser implements a simple interface:

```typescript
// src/parsers/types.ts
export interface VendorParser {
  vendor: string;
  detect: (line: string) => boolean;
  parse: (line: string) => AgentEvent[];
}
```

Example Claude parser:

```typescript
// src/parsers/claude.ts
export const detect = (line: string): boolean => {
  try {
    const obj = JSON.parse(line);
    return obj.type === 'message' && 'role' in obj;
  } catch {
    return false;
  }
};

export const parse = (line: string): AgentEvent[] => {
  const obj = JSON.parse(line);
  const events: AgentEvent[] = [];
  
  if (obj.type === 'message') {
    events.push({ t: 'msg', role: obj.role, text: obj.content });
  } else if (obj.type === 'tool_use') {
    events.push({ 
      t: 'tool', 
      name: obj.name, 
      phase: 'start',
      text: obj.input ? JSON.stringify(obj.input) : undefined
    });
  }
  // ... handle other event types
  
  return events;
};
```

### Streaming Pipeline

The streaming implementation uses async iterators for memory efficiency:

```typescript
// src/stream.ts
export async function* streamEvents(opts: StreamEventOptions): AsyncIterator<AgentEvent> {
  const parser = selectParser(opts.vendor);
  const reader = createLineReader(opts.source);
  
  for await (const line of reader) {
    try {
      const events = parser.parse(line);
      for (const event of events) {
        yield event;
      }
    } catch (error) {
      yield { t: 'error', message: `Parse error: ${error.message}` };
    }
  }
}
```

### Rendering Engine

The renderer applies formatting based on output mode:

```typescript
// src/render.ts
export class Renderer {
  constructor(private opts: FmtOptions) {}
  
  render(event: AgentEvent): string {
    if (this.opts.ansi === 'html') {
      return this.renderHtml(event);
    }
    return this.renderAnsi(event);
  }
  
  private renderAnsi(event: AgentEvent): string {
    switch (event.t) {
      case 'msg':
        const prefix = event.role === 'user' ? kleur.bold().cyan('👤 user:') 
                                              : kleur.bold().green('🤖 assistant:');
        return `${prefix} ${event.text}\n`;
      case 'tool':
        if (event.phase === 'start') {
          return kleur.dim().italic(`🔧 tool: ${event.name}\n`);
        }
        // ... other phases
    }
  }
}
```

### File Organization

```
agent-stream-fmt/
├── src/
│   ├── index.ts          # Main exports
│   ├── types.ts          # Type definitions
│   ├── stream.ts         # Core streaming logic
│   ├── render.ts         # Rendering engine
│   ├── cli.ts            # CLI entry point
│   ├── parsers/
│   │   ├── index.ts      # Parser registry
│   │   ├── claude.ts     # Claude parser
│   │   ├── gemini.ts     # Gemini parser
│   │   └── amp.ts        # Amp parser
│   └── utils/
│       ├── line-reader.ts # Line-by-line reader
│       └── backpressure.ts # Stream backpressure handling
├── specs/
│   └── feat-jsonl-stream-formatter.md
├── tests/
│   ├── parsers/
│   ├── stream.test.ts
│   └── fixtures/
├── dist/                 # Built output
├── package.json
├── tsconfig.json
└── README.md
```

## User Experience

### CLI Usage

Users interact with the formatter primarily through pipes:

```bash
# Basic usage - auto-detect vendor
claude --json "explain recursion" | agent-stream-fmt

# Explicit vendor with filtering
gemini --jsonl -i task.md | agent-stream-fmt --vendor gemini --hide-tools

# HTML output for web display
amp-code run build.yml -j | agent-stream-fmt --html > build-log.html

# Filter to specific event types
claude --json "debug this" | agent-stream-fmt --only tool
```

### SDK Usage

Programmatic users get full control:

```typescript
import { streamEvents, streamFormat } from 'agent-stream-fmt';

// Process events programmatically
for await (const event of streamEvents({ 
  vendor: 'claude', 
  source: process.stdin 
})) {
  if (event.t === 'tool' && event.phase === 'end' && event.exitCode !== 0) {
    console.error(`Tool ${event.name} failed with code ${event.exitCode}`);
  }
}

// Or use high-level formatting
await streamFormat({
  vendor: 'auto',
  source: fs.createReadStream('session.jsonl'),
  sink: process.stdout,
  opts: {
    collapseTools: true,
    onEvent: (ev) => metrics.record(ev)
  }
});
```

## Testing Strategy

### Unit Tests

- **Parser tests**: Verify each vendor parser handles all known event types
- **Stream tests**: Ensure proper event emission and error handling
- **Render tests**: Validate ANSI and HTML output formatting
- **Filter tests**: Confirm filtering logic works correctly

### Integration Tests

- **End-to-end CLI tests**: Run actual agent output through the formatter
- **Vendor detection tests**: Verify auto-detection works for all formats
- **Large file tests**: Ensure memory usage stays bounded
- **Pipe tests**: Verify proper behavior in shell pipelines

### Test Structure

```typescript
// tests/parsers/claude.test.ts
describe('Claude parser', () => {
  it('parses message events', () => {
    const line = '{"type":"message","role":"assistant","content":"Hello"}';
    const events = parse(line);
    expect(events).toEqual([
      { t: 'msg', role: 'assistant', text: 'Hello' }
    ]);
  });
  
  it('handles tool events', () => {
    // Test tool start, output, end lifecycle
  });
});
```

## Performance Considerations

### Streaming Architecture
- **Zero buffering**: Events are processed line-by-line without accumulation
- **Async iteration**: Leverages Node.js streams for natural backpressure
- **Bounded memory**: O(1) memory usage regardless of input size

### Optimization Targets
- Parse throughput: > 50k lines/second on modern hardware
- Memory ceiling: < 20MB RSS for infinite streams
- Startup time: < 100ms from invocation to first output

### Benchmarking

```typescript
// bench/throughput.ts
const lines = 1_000_000;
const start = process.hrtime.bigint();

for (let i = 0; i < lines; i++) {
  await write(`{"type":"message","role":"assistant","content":"Line ${i}"}\n`);
}

const elapsed = process.hrtime.bigint() - start;
const linesPerSec = (lines * 1e9) / Number(elapsed);
```

## Security Considerations

### Input Validation
- **JSON parsing**: Use native `JSON.parse()` with try-catch for safety
- **Size limits**: Truncate individual lines at 1MB to prevent DoS
- **No eval**: Never execute or evaluate message content
- **HTML escaping**: Properly escape all user content in HTML mode

### Process Isolation
- **No file access**: Formatter only reads from provided streams
- **No network**: No external connections or data transmission
- **No execution**: Never spawn processes or run commands
- **Minimal deps**: Only `kleur` dependency reduces attack surface

### Error Handling
```typescript
// Fail safely on malformed input
try {
  const obj = JSON.parse(line);
  // ... process
} catch (error) {
  yield { t: 'error', message: 'Invalid JSON' };
  // Continue processing next lines
}
```

## Documentation

### User Documentation
1. **README.md**: Quick start, installation, basic examples
2. **CLI help**: Built-in `--help` with all options
3. **API docs**: TypeScript types serve as documentation
4. **Examples folder**: Common usage patterns

### Developer Documentation
1. **Architecture guide**: How parsers and renderers work
2. **Adding vendors**: Step-by-step parser creation
3. **Testing guide**: How to test new features
4. **Contributing**: Code style, PR process

## Implementation Phases

### Phase 1: MVP/Core Functionality (Week 1)
- [ ] Core type definitions and interfaces
- [ ] Basic streaming pipeline
- [ ] Claude parser implementation
- [ ] ANSI rendering for terminal output
- [ ] CLI with essential options
- [ ] Basic test suite

### Phase 2: Multi-Vendor Support (Week 2)
- [ ] Gemini parser implementation
- [ ] Amp Code parser implementation
- [ ] Auto-detection logic
- [ ] HTML rendering mode
- [ ] Advanced filtering options
- [ ] Integration test suite

### Phase 3: Polish and Optimization (Week 3)
- [ ] Performance optimization
- [ ] Comprehensive error handling
- [ ] Full documentation
- [ ] Example scripts and use cases
- [ ] npm publishing setup
- [ ] CI/CD pipeline

## Open Questions

1. **Event granularity**: Should tool stdout/stderr be separate events or combined?
2. **Cost aggregation**: Should the formatter sum costs or leave that to consumers?
3. **Partial line handling**: How to handle incomplete JSON across chunk boundaries?
4. **Version detection**: Should we detect and handle different versions of each vendor's format?
5. **Plugin system**: Should we support user-defined parsers for custom formats?

## References

### Vendor Documentation
- [Claude Code JSON output](https://docs.anthropic.com/claude-code/cli-reference#output-formats)
- [Gemini CLI streaming](https://github.com/google/gemini-cli#streaming-output)
- [Amp Code JSONL format](https://amp.dev/code/output-formats)

### Related Projects
- [ndjson](https://github.com/ndjson/ndjson-spec): Newline-delimited JSON specification
- [pino-pretty](https://github.com/pinojs/pino-pretty): Similar log formatting approach
- [jq](https://github.com/stedolan/jq): JSON processing inspiration

### Design Patterns
- [Node.js Streams Best Practices](https://nodejs.org/en/docs/guides/backpressuring-in-streams/)
- [AsyncIterator Protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols)
- [Transform Streams](https://nodejs.org/api/stream.html#stream_class_stream_transform)