# Testing Strategy for Agent JSONL Outputs

## Overview

Testing the agent-stream-fmt formatter requires capturing real outputs from Claude Code, Gemini CLI, and Amp Code. Since these tools evolve rapidly, we need a systematic approach to discover, capture, and validate their output formats.

## Discovering Agent Output Formats

### 1. Empirical Testing Approach

The most reliable way to understand agent outputs is to run them and capture their JSONL:

```bash
# Claude Code
claude --json "write a hello world function" > fixtures/claude-basic.jsonl
claude --json "create a React component with tests" > fixtures/claude-complex.jsonl
claude --json "debug this error: undefined is not a function" > fixtures/claude-debug.jsonl

# Gemini CLI
gemini --jsonl "explain recursion" > fixtures/gemini-basic.jsonl
gemini --jsonl -i task.md > fixtures/gemini-file-input.jsonl
gemini --stream-json "write unit tests" > fixtures/gemini-streaming.jsonl

# Amp Code
amp-code run simple.yml -j > fixtures/amp-simple.jsonl
amp-code run build.yml --output jsonl > fixtures/amp-build.jsonl
```

### 2. Output Schema Discovery Script

Create a discovery script that analyzes captured outputs:

```typescript
// scripts/discover-schemas.ts
import { readFileSync } from 'fs';
import { glob } from 'glob';

interface SchemaInfo {
  vendor: string;
  file: string;
  uniqueTypes: Set<string>;
  uniqueKeys: Set<string>;
  samples: any[];
}

async function discoverSchemas() {
  const files = await glob('fixtures/*.jsonl');
  const schemas: SchemaInfo[] = [];
  
  for (const file of files) {
    const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
    const info: SchemaInfo = {
      vendor: file.includes('claude') ? 'claude' : 
              file.includes('gemini') ? 'gemini' : 'amp',
      file,
      uniqueTypes: new Set(),
      uniqueKeys: new Set(),
      samples: []
    };
    
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        
        // Collect type fields
        if (obj.type) info.uniqueTypes.add(obj.type);
        if (obj.kind) info.uniqueTypes.add(`kind:${obj.kind}`);
        if (obj.phase) info.uniqueTypes.add(`phase:${obj.phase}`);
        
        // Collect all keys
        Object.keys(obj).forEach(k => info.uniqueKeys.add(k));
        
        // Save unique samples
        const typeKey = obj.type || obj.kind || obj.phase || 'unknown';
        if (!info.samples.find(s => (s.type || s.kind || s.phase) === typeKey)) {
          info.samples.push(obj);
        }
      } catch (e) {
        console.error(`Failed to parse line in ${file}: ${line}`);
      }
    }
    
    schemas.push(info);
  }
  
  // Generate schema documentation
  for (const schema of schemas) {
    console.log(`\n## ${schema.vendor.toUpperCase()} Schema`);
    console.log(`File: ${schema.file}`);
    console.log(`Event types: ${Array.from(schema.uniqueTypes).join(', ')}`);
    console.log(`Keys: ${Array.from(schema.uniqueKeys).join(', ')}`);
    console.log('\nSamples:');
    schema.samples.forEach(s => console.log(JSON.stringify(s, null, 2)));
  }
}
```

### 3. Continuous Schema Validation

Set up automated tests that run against live CLIs:

```typescript
// tests/live-validation.test.ts
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { streamEvents } from '../src';

describe('Live CLI validation', () => {
  it.skipIf(!process.env.TEST_LIVE)('validates Claude Code output', async () => {
    const claude = spawn('claude', ['--json', 'say hello']);
    const events = [];
    
    for await (const event of streamEvents({ 
      vendor: 'claude', 
      source: claude.stdout 
    })) {
      events.push(event);
    }
    
    expect(events).toContainEqual(
      expect.objectContaining({ t: 'msg', role: 'assistant' })
    );
  });
});
```

## Test Fixture Strategy

### 1. Fixture Organization

```
tests/fixtures/
├── claude/
│   ├── basic-message.jsonl
│   ├── tool-use.jsonl
│   ├── streaming.jsonl
│   ├── error-handling.jsonl
│   └── cost-tracking.jsonl
├── gemini/
│   ├── basic-content.jsonl
│   ├── code-generation.jsonl
│   ├── multi-turn.jsonl
│   └── tool-calls.jsonl
└── amp/
    ├── simple-task.jsonl
    ├── build-process.jsonl
    ├── test-execution.jsonl
    └── deployment.jsonl
```

### 2. Fixture Generation Script

```typescript
// scripts/generate-fixtures.ts
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';

const TEST_CASES = {
  claude: [
    { args: ['--json', 'write a function'], output: 'basic-message.jsonl' },
    { args: ['--json', 'run npm test'], output: 'tool-use.jsonl' },
    { args: ['--json', 'explain this error: ...'], output: 'error-handling.jsonl' }
  ],
  gemini: [
    { args: ['--jsonl', 'hello world'], output: 'basic-content.jsonl' },
    { args: ['--stream-json', 'create a class'], output: 'code-generation.jsonl' }
  ],
  amp: [
    { args: ['run', 'task.yml', '-j'], output: 'simple-task.jsonl' },
    { args: ['run', 'build.yml', '--output', 'jsonl'], output: 'build-process.jsonl' }
  ]
};

async function generateFixtures() {
  for (const [vendor, cases] of Object.entries(TEST_CASES)) {
    console.log(`Generating ${vendor} fixtures...`);
    
    for (const testCase of cases) {
      const output = createWriteStream(`tests/fixtures/${vendor}/${testCase.output}`);
      const proc = spawn(vendor, testCase.args);
      
      proc.stdout.pipe(output);
      
      await new Promise((resolve, reject) => {
        proc.on('exit', resolve);
        proc.on('error', reject);
      });
    }
  }
}
```

### 3. Synthetic Test Data

For edge cases and error conditions, create synthetic fixtures:

```typescript
// tests/fixtures/synthetic/edge-cases.ts
export const EDGE_CASES = {
  claude: {
    // Malformed JSON
    malformed: '{"type":"message","role":"assistant"',
    
    // Unknown event type
    unknown: '{"type":"unknown_event","data":"something"}',
    
    // Deeply nested tool output
    nestedTool: JSON.stringify({
      type: "tool_result",
      tool_use_id: "123",
      content: {
        stdout: "Line 1\nLine 2\nLine 3",
        stderr: "Warning: deprecated",
        exitCode: 0
      }
    }),
    
    // Very long message
    longMessage: JSON.stringify({
      type: "message",
      role: "assistant",
      content: "x".repeat(10000)
    }),
    
    // Unicode and special characters
    unicode: JSON.stringify({
      type: "message",
      role: "assistant",
      content: "Hello 👋 世界 🌍\n\tTabbed\r\nWindows EOL"
    })
  }
};
```

## Testing Different Scenarios

### 1. Parser Correctness Tests

```typescript
// tests/parsers/claude.test.ts
describe('Claude parser', () => {
  it('parses all known event types', () => {
    const fixtures = loadFixtures('claude/*.jsonl');
    
    for (const fixture of fixtures) {
      const lines = fixture.content.split('\n').filter(Boolean);
      
      for (const line of lines) {
        expect(() => parse(line)).not.toThrow();
        
        const events = parse(line);
        expect(events).toSatisfy((evs: AgentEvent[]) => 
          evs.every(ev => ['msg', 'tool', 'cost', 'error', 'debug'].includes(ev.t))
        );
      }
    }
  });
  
  it('preserves message content exactly', () => {
    const line = '{"type":"message","role":"assistant","content":"  spaces  \\n\\ttabs"}';
    const events = parse(line);
    
    expect(events[0]).toEqual({
      t: 'msg',
      role: 'assistant',
      text: '  spaces  \n\ttabs'
    });
  });
});
```

### 2. Stream Processing Tests

```typescript
// tests/stream.test.ts
describe('Stream processing', () => {
  it('handles interleaved tool output', async () => {
    const input = createReadStream('fixtures/claude/tool-use.jsonl');
    const events = [];
    
    for await (const event of streamEvents({ vendor: 'claude', source: input })) {
      events.push(event);
    }
    
    // Verify tool lifecycle
    const toolEvents = events.filter(e => e.t === 'tool');
    expect(toolEvents).toMatchObject([
      { phase: 'start', name: 'bash' },
      { phase: 'stdout', text: expect.any(String) },
      { phase: 'stderr', text: expect.any(String) },
      { phase: 'end', exitCode: expect.any(Number) }
    ]);
  });
});
```

### 3. Rendering Tests

```typescript
// tests/render.test.ts
describe('ANSI rendering', () => {
  it('renders tool output with proper indentation', () => {
    const renderer = new Renderer({ ansi: true });
    
    const output = renderer.render({
      t: 'tool',
      phase: 'stdout',
      name: 'npm',
      text: 'Installing dependencies...\n✓ Completed'
    });
    
    expect(output).toContain('  Installing dependencies...');
    expect(output).toContain('  ✓ Completed');
  });
});
```

## Regression Testing

### 1. Snapshot Testing

```typescript
// tests/snapshots.test.ts
describe('Output snapshots', () => {
  it('matches Claude formatting snapshot', async () => {
    const input = createReadStream('fixtures/claude/complex-session.jsonl');
    const output = await collectOutput(input, { vendor: 'claude', ansi: false });
    
    expect(output).toMatchSnapshot('claude-complex-output.txt');
  });
});
```

### 2. Version Compatibility Matrix

```typescript
// tests/compatibility.test.ts
const COMPATIBILITY_MATRIX = {
  claude: {
    '3.5': ['fixtures/claude/v3.5/*.jsonl'],
    '3.6': ['fixtures/claude/v3.6/*.jsonl'],
    'latest': ['fixtures/claude/latest/*.jsonl']
  },
  gemini: {
    '0.10': ['fixtures/gemini/v0.10/*.jsonl'],
    '0.11': ['fixtures/gemini/v0.11/*.jsonl']
  }
};

describe('Version compatibility', () => {
  for (const [vendor, versions] of Object.entries(COMPATIBILITY_MATRIX)) {
    for (const [version, fixtures] of Object.entries(versions)) {
      it(`supports ${vendor} ${version}`, async () => {
        // Test each version's fixtures
      });
    }
  }
});
```

## Performance Testing

```typescript
// tests/performance.test.ts
describe('Performance benchmarks', () => {
  it('processes 50k lines/second', async () => {
    const lines = 50_000;
    const testData = Array(lines).fill(
      '{"type":"message","role":"assistant","content":"Test message"}\n'
    ).join('');
    
    const input = Readable.from(testData);
    const start = performance.now();
    
    let count = 0;
    for await (const event of streamEvents({ vendor: 'claude', source: input })) {
      count++;
    }
    
    const elapsed = performance.now() - start;
    const linesPerSec = (lines * 1000) / elapsed;
    
    expect(linesPerSec).toBeGreaterThan(50_000);
  });
});
```

## Integration with CI/CD

```yaml
# .github/workflows/test.yml
name: Test Agent Outputs

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        vendor: [claude, gemini, amp]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Install vendor CLI
      run: |
        case ${{ matrix.vendor }} in
          claude) npm install -g @anthropic/claude-cli ;;
          gemini) npm install -g @google/gemini-cli ;;
          amp) npm install -g amp-code ;;
        esac
    
    - name: Generate fresh fixtures
      run: npm run fixtures:generate -- --vendor=${{ matrix.vendor }}
    
    - name: Run tests
      run: npm test -- --vendor=${{ matrix.vendor }}
    
    - name: Upload fixtures
      uses: actions/upload-artifact@v3
      with:
        name: fixtures-${{ matrix.vendor }}
        path: tests/fixtures/${{ matrix.vendor }}/
```

## Summary

This testing strategy ensures:

1. **Real-world validation**: Captures actual CLI outputs
2. **Schema discovery**: Automatically detects format changes
3. **Comprehensive coverage**: Tests all event types and edge cases
4. **Version compatibility**: Tracks changes across CLI versions
5. **Performance validation**: Ensures streaming efficiency
6. **Continuous validation**: CI/CD integration for ongoing verification