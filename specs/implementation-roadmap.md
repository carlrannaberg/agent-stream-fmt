# Implementation Roadmap

This roadmap outlines the execution order for implementing the agent-stream-fmt package based on the
specifications in:

- [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md) - Main specification
- [`testing-strategy.md`](./testing-strategy.md) - Testing approach and fixture management

## Execution Order

### Phase 0: Project Setup & Fixture Collection (Day 1)

**Goal**: Establish foundation and gather real data

1. **Project initialization**

   ```bash
   npm init -y
   npm install -D typescript tsup vitest @types/node
   npm install kleur
   ```

2. **Capture real JSONL fixtures** (CRITICAL - Do this first!)
   - Follow fixture collection approach from
     [`testing-strategy.md`](./testing-strategy.md#discovering-agent-output-formats)

   ```bash
   # Create fixture directories
   mkdir -p tests/fixtures/{claude,gemini,amp}

   # Capture Claude Code outputs
   claude --json "write hello world" > tests/fixtures/claude/basic-message.jsonl
   claude --json "run npm test" > tests/fixtures/claude/tool-use.jsonl
   claude --json "create a React component" > tests/fixtures/claude/complex-session.jsonl

   # Capture Gemini CLI outputs (if available)
   gemini --jsonl "explain recursion" > tests/fixtures/gemini/basic-content.jsonl

   # Capture Amp Code outputs (if available)
   amp-code run simple.yml -j > tests/fixtures/amp/simple-task.jsonl
   ```

3. **Analyze captured fixtures**
   - Run discovery script from
     [`testing-strategy.md`](./testing-strategy.md#output-schema-discovery-script)
   - Document all event types found
   - Create schema documentation

### Phase 1: Core Types & Parser Infrastructure (Day 2-3)

**Goal**: Build the foundation

1. **Core types** (`src/types.ts`)
   - Implement types from
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#core-types)
   - Define `AgentEvent` union type
   - Define vendor types
   - Define options interfaces

2. **Parser interface** (`src/parsers/types.ts`)
   - Create `VendorParser` interface as specified in
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#parser-architecture)
   - Define detection and parsing contracts

3. **Claude parser** (`src/parsers/claude.ts`)
   - Implement based on captured fixtures
   - Handle all discovered event types
   - Write tests following [`testing-strategy.md`](./testing-strategy.md#parser-correctness-tests)

4. **Parser registry** (`src/parsers/index.ts`)
   - Auto-detection logic
   - Parser selection mechanism

### Phase 2: Streaming Engine (Day 4-5)

**Goal**: Implement core transformation logic

1. **Line reader utility** (`src/utils/line-reader.ts`)
   - Handle partial lines across chunks
   - Proper backpressure support per
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#performance-considerations)

2. **Stream events function** (`src/stream.ts`)
   - Implement `streamEvents` async generator from
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#streaming-pipeline)
   - Error handling and recovery
   - Test with fixture files using
     [`testing-strategy.md`](./testing-strategy.md#stream-processing-tests)

3. **Basic CLI** (`src/cli.ts`)
   - Minimal version for testing
   - Just parse and output events as JSON

### Phase 3: Rendering Engine (Day 6-7)

**Goal**: Make output human-readable

1. **ANSI renderer** (`src/render/ansi.ts`)
   - Implement formatting from
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#output-formatting-rules)
   - Use kleur for colors
   - Handle all event types with proper styling
   - Test using [`testing-strategy.md`](./testing-strategy.md#rendering-tests)

2. **Stream format function** (`src/stream.ts`)
   - Implement `streamFormat` API from
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#32-api-surface-only-two-calls)
   - Filtering logic per
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#filtering-semantics)
   - Backpressure handling

3. **Enhanced CLI** (`src/cli.ts`)
   - Implement CLI interface from
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#cli-interface)
   - Add all command-line options
   - Help text and version

### Phase 4: Additional Vendors (Day 8-9)

**Goal**: Expand coverage

1. **Gemini parser** (`src/parsers/gemini.ts`)
   - Only if fixtures available
   - Follow same pattern as Claude

2. **Amp parser** (`src/parsers/amp.ts`)
   - Only if fixtures available
   - Handle phase-based events

3. **Update auto-detection**
   - Ensure reliable vendor detection
   - Fallback strategies

### Phase 5: HTML & Advanced Features (Day 10-11)

**Goal**: Polish and extras

1. **HTML renderer** (`src/render/html.ts`)
   - Generate semantic HTML
   - Include basic CSS

2. **Advanced filtering**
   - `--only` option implementation
   - Event statistics collection

3. **Performance optimization**
   - Benchmark against 50k lines/sec target from
     [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#performance-considerations)
   - Memory profiling per [`testing-strategy.md`](./testing-strategy.md#performance-testing)

### Phase 6: Package & Documentation (Day 12)

**Goal**: Ready for release

1. **Build configuration**
   - tsup setup for ESM/CJS
   - Proper exports in package.json

2. **Documentation**
   - README with examples
   - API documentation
   - CLI help text

3. **Publishing prep**
   - npm scripts
   - GitHub Actions CI
   - Release automation

## Critical Path Dependencies

```
Fixtures Collection
    ↓
Core Types → Parser Interface → Claude Parser
    ↓              ↓                  ↓
Stream Engine ←────┴──────────────────┘
    ↓
ANSI Renderer → CLI v1
    ↓
Additional Parsers (parallel)
    ↓
HTML Renderer → CLI v2
    ↓
Package & Release
```

## Risk Mitigation

### Fixture Availability

- **Risk**: Can't access all three CLIs
- **Mitigation**: Start with Claude (most likely available), design for extensibility
- **Fallback**: Create synthetic fixtures based on documentation

### Format Changes

- **Risk**: Vendors change output format
- **Mitigation**: Version detection, graceful degradation, clear error messages

### Performance Targets

- **Risk**: Can't achieve 50k lines/sec
- **Mitigation**: Profile early, use native streams, minimize allocations

## Testing Checkpoints

After each phase, ensure:

1. All tests pass against fixtures (see [`testing-strategy.md`](./testing-strategy.md))
2. Memory usage stays under 20MB as specified in
   [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#performance-considerations)
3. No regressions in parsing accuracy
4. CLI works end-to-end with real fixtures

## Success Criteria

The implementation is complete when:

- [ ] All captured fixtures parse correctly per [`testing-strategy.md`](./testing-strategy.md)
- [ ] CLI works with all three vendors per
      [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#supported-input-formats)
- [ ] Tests achieve 90%+ coverage
- [ ] Performance meets targets from
      [`feat-jsonl-stream-formatter.md`](./feat-jsonl-stream-formatter.md#performance-considerations)
- [ ] Documentation is complete
- [ ] Package publishes successfully

## Next Steps

1. **Immediate**: Start fixture collection (Phase 0)
2. **Then**: Implement in order, testing against real fixtures
3. **Finally**: Polish and release

Remember: **Fixtures first!** Everything else depends on understanding the real output formats.
