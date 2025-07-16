# Phase 0: Project Setup & Fixture Collection

**Status**: Draft  
**Authors**: Claude Assistant  
**Date**: 2025-07-16  
**Version**: 1.0.0  

## Overview

Phase 0 establishes the foundation for the agent-stream-fmt package by initializing the project structure and capturing real JSONL output from various AI agent CLIs. This phase is critical as all subsequent development depends on understanding the actual output formats from Claude Code, Gemini CLI, and Amp Code.

## Background/Problem Statement

Before implementing parsers and formatters, we need:
1. A properly configured TypeScript project with the necessary tooling
2. Real JSONL output samples from each supported agent CLI
3. Understanding of the actual data structures and event types each agent produces

Without real fixtures, we risk:
- Building parsers based on assumptions rather than reality
- Missing edge cases and undocumented event types
- Creating brittle code that breaks with minor format changes
- Wasting time on unnecessary abstractions

## Goals

- **Initialize** a modern TypeScript project with build and test tooling
- **Capture** comprehensive JSONL fixtures from all available agent CLIs
- **Analyze** captured data to understand all event types and variations
- **Document** the discovered schemas for each vendor
- **Create** a fixture organization system for ongoing testing
- **Establish** scripts for fixture generation and validation

## Non-Goals

- **Not implementing** any parsing logic yet
- **Not building** the streaming engine or renderers
- **Not creating** the CLI interface beyond basic testing needs
- **Not optimizing** for performance or production use
- **Not publishing** to npm or setting up CI/CD

## Technical Dependencies

### Build Tools
- **Node.js**: >= 18.0.0 (for native stream support)
- **TypeScript**: 5.x (latest stable)
- **tsup**: Zero-config TypeScript bundler
- **vitest**: Fast unit test framework

### Runtime Dependencies
- **kleur**: ^4.1.5 (ANSI color library, needed from start)

### Development Dependencies
- **@types/node**: TypeScript definitions for Node.js

### Agent CLIs (for fixture generation)
- **Claude Code**: Latest version with `--json` flag support
- **Gemini CLI**: >= 0.11 with `--jsonl` flag
- **Amp Code**: Latest version with `-j` or `--output jsonl` flag

## Detailed Design

### 1. Project Structure

```
agent-stream-fmt/
├── package.json              # Project manifest
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Test configuration
├── .gitignore              # Git ignore rules
├── README.md               # Basic project info
├── scripts/                # Utility scripts
│   ├── capture-fixtures.ts # Automated fixture capture
│   ├── analyze-schemas.ts  # Schema discovery
│   └── validate-fixtures.ts # Fixture validation
├── specs/                  # Specification documents
│   ├── feat-jsonl-stream-formatter.md
│   ├── testing-strategy.md
│   ├── implementation-roadmap.md
│   └── phase-0-project-setup-fixtures.md
├── tests/
│   └── fixtures/           # JSONL samples
│       ├── claude/
│       │   ├── basic-message.jsonl
│       │   ├── tool-use.jsonl
│       │   ├── complex-session.jsonl
│       │   ├── streaming.jsonl
│       │   ├── error-handling.jsonl
│       │   └── README.md   # Claude-specific notes
│       ├── gemini/
│       │   ├── basic-content.jsonl
│       │   ├── code-generation.jsonl
│       │   ├── multi-turn.jsonl
│       │   └── README.md   # Gemini-specific notes
│       └── amp/
│           ├── simple-task.jsonl
│           ├── build-process.jsonl
│           ├── test-execution.jsonl
│           └── README.md   # Amp-specific notes
└── src/                    # Source code (empty for now)
```

### 2. Package Configuration

**package.json**:
```json
{
  "name": "agent-stream-fmt",
  "version": "0.0.1",
  "description": "Universal JSONL formatter for AI agent CLIs",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "agent-stream-fmt": "dist/cli.js"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "fixtures:capture": "tsx scripts/capture-fixtures.ts",
    "fixtures:analyze": "tsx scripts/analyze-schemas.ts",
    "fixtures:validate": "tsx scripts/validate-fixtures.ts"
  },
  "keywords": ["cli", "jsonl", "streaming", "claude", "gemini", "amp"],
  "author": "",
  "license": "MIT",
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "kleur": "^4.1.5"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 3. Fixture Capture Strategy

**Manual Capture Commands**:
```bash
# Claude Code - Various scenarios
claude --json "write a hello world function in Python" > tests/fixtures/claude/basic-message.jsonl
claude --json "run the tests and fix any failures" > tests/fixtures/claude/tool-use.jsonl
claude --json "create a React component with TypeScript and tests" > tests/fixtures/claude/complex-session.jsonl
claude --json "explain this error: TypeError: Cannot read property 'x' of undefined" > tests/fixtures/claude/error-handling.jsonl

# Gemini CLI - If available
gemini --jsonl "explain how recursion works" > tests/fixtures/gemini/basic-content.jsonl
gemini --jsonl "write a sorting algorithm" > tests/fixtures/gemini/code-generation.jsonl
gemini --stream-json -i conversation.txt > tests/fixtures/gemini/multi-turn.jsonl

# Amp Code - If available
amp-code run hello-world.yml -j > tests/fixtures/amp/simple-task.jsonl
amp-code run build-app.yml --output jsonl > tests/fixtures/amp/build-process.jsonl
amp-code run test-suite.yml -j > tests/fixtures/amp/test-execution.jsonl
```

**Automated Capture Script** (`scripts/capture-fixtures.ts`):
```typescript
#!/usr/bin/env tsx
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

interface TestCase {
  vendor: 'claude' | 'gemini' | 'amp';
  command: string[];
  output: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  // Claude Code test cases
  {
    vendor: 'claude',
    command: ['claude', '--json', 'write a hello world function'],
    output: 'basic-message.jsonl',
    description: 'Basic assistant message'
  },
  {
    vendor: 'claude',
    command: ['claude', '--json', 'run npm test and show results'],
    output: 'tool-use.jsonl',
    description: 'Tool execution with output'
  },
  // Add more test cases...
];

async function captureFixture(testCase: TestCase) {
  const outputPath = join('tests/fixtures', testCase.vendor, testCase.output);
  console.log(`Capturing ${testCase.vendor}: ${testCase.description}...`);
  
  const output = createWriteStream(outputPath);
  const proc = spawn(testCase.command[0], testCase.command.slice(1));
  
  proc.stdout.pipe(output);
  proc.stderr.on('data', (data) => {
    console.error(`Error capturing ${testCase.vendor}: ${data}`);
  });
  
  return new Promise((resolve, reject) => {
    proc.on('exit', (code) => {
      if (code === 0) {
        console.log(`✓ Captured ${outputPath}`);
        resolve(void 0);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

async function main() {
  // Ensure directories exist
  for (const vendor of ['claude', 'gemini', 'amp']) {
    mkdirSync(join('tests/fixtures', vendor), { recursive: true });
  }
  
  // Capture fixtures sequentially to avoid rate limits
  for (const testCase of TEST_CASES) {
    try {
      await captureFixture(testCase);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to capture ${testCase.output}:`, error);
    }
  }
}

main().catch(console.error);
```

### 4. Schema Analysis

**Schema Discovery Script** (`scripts/analyze-schemas.ts`):
```typescript
#!/usr/bin/env tsx
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface SchemaAnalysis {
  vendor: string;
  file: string;
  lineCount: number;
  eventTypes: Map<string, number>;
  uniqueKeys: Set<string>;
  samples: Map<string, any>;
  errors: string[];
}

function analyzeFile(vendor: string, filename: string): SchemaAnalysis {
  const filepath = join('tests/fixtures', vendor, filename);
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const analysis: SchemaAnalysis = {
    vendor,
    file: filename,
    lineCount: lines.length,
    eventTypes: new Map(),
    uniqueKeys: new Set(),
    samples: new Map(),
    errors: []
  };
  
  for (const [index, line] of lines.entries()) {
    try {
      const obj = JSON.parse(line);
      
      // Determine event type
      const eventType = obj.type || obj.kind || obj.phase || 'unknown';
      analysis.eventTypes.set(eventType, (analysis.eventTypes.get(eventType) || 0) + 1);
      
      // Collect all keys
      const collectKeys = (obj: any, prefix = '') => {
        for (const key of Object.keys(obj)) {
          analysis.uniqueKeys.add(prefix + key);
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            collectKeys(obj[key], `${prefix}${key}.`);
          }
        }
      };
      collectKeys(obj);
      
      // Save first sample of each type
      if (!analysis.samples.has(eventType)) {
        analysis.samples.set(eventType, obj);
      }
    } catch (error) {
      analysis.errors.push(`Line ${index + 1}: ${error.message}`);
    }
  }
  
  return analysis;
}

function generateReport() {
  const vendors = ['claude', 'gemini', 'amp'];
  const report: string[] = ['# JSONL Schema Analysis Report\n'];
  
  for (const vendor of vendors) {
    report.push(`## ${vendor.toUpperCase()}\n`);
    
    try {
      const files = readdirSync(join('tests/fixtures', vendor))
        .filter(f => f.endsWith('.jsonl'));
      
      for (const file of files) {
        const analysis = analyzeFile(vendor, file);
        
        report.push(`### ${file}`);
        report.push(`- Lines: ${analysis.lineCount}`);
        report.push(`- Parse errors: ${analysis.errors.length}`);
        report.push(`\n**Event Types:**`);
        
        for (const [type, count] of analysis.eventTypes) {
          report.push(`- \`${type}\`: ${count} occurrences`);
        }
        
        report.push(`\n**Unique Keys:** ${Array.from(analysis.uniqueKeys).join(', ')}`);
        
        report.push(`\n**Sample Events:**`);
        for (const [type, sample] of analysis.samples) {
          report.push(`\n*${type}:*`);
          report.push('```json');
          report.push(JSON.stringify(sample, null, 2));
          report.push('```');
        }
        
        if (analysis.errors.length > 0) {
          report.push(`\n**Errors:**`);
          analysis.errors.slice(0, 5).forEach(err => report.push(`- ${err}`));
        }
        
        report.push('');
      }
    } catch (error) {
      report.push(`Error reading ${vendor} fixtures: ${error.message}\n`);
    }
  }
  
  return report.join('\n');
}

// Generate and save report
const report = generateReport();
console.log(report);

// Save to file
import { writeFileSync } from 'fs';
writeFileSync('tests/fixtures/SCHEMA_ANALYSIS.md', report);
console.log('\nReport saved to tests/fixtures/SCHEMA_ANALYSIS.md');
```

## User Experience

During Phase 0, the primary users are developers working on the project:

1. **Initial setup**: Run `npm install` to get dependencies
2. **Capture fixtures**: Use `npm run fixtures:capture` or manual commands
3. **Analyze schemas**: Run `npm run fixtures:analyze` to understand formats
4. **Validate fixtures**: Run `npm run fixtures:validate` to ensure integrity

The fixture collection process should be:
- **Documented**: Clear instructions for capturing new fixtures
- **Reproducible**: Anyone can regenerate fixtures if needed
- **Versioned**: Git-tracked fixtures show format evolution

## Testing Strategy

### Fixture Validation Tests

Create basic tests to ensure fixtures are valid:

```typescript
// tests/fixtures.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Fixture validation', () => {
  const vendors = ['claude', 'gemini', 'amp'];
  
  for (const vendor of vendors) {
    describe(vendor, () => {
      const fixtureDir = join('tests/fixtures', vendor);
      
      it('has fixture directory', () => {
        expect(() => readdirSync(fixtureDir)).not.toThrow();
      });
      
      it('has at least one .jsonl file', () => {
        const files = readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl'));
        expect(files.length).toBeGreaterThan(0);
      });
      
      it('all JSONL files are valid', () => {
        const files = readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl'));
        
        for (const file of files) {
          const content = readFileSync(join(fixtureDir, file), 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          for (const [index, line] of lines.entries()) {
            expect(() => JSON.parse(line), 
              `${file} line ${index + 1} should be valid JSON`
            ).not.toThrow();
          }
        }
      });
    });
  }
});
```

## Performance Considerations

Phase 0 performance concerns are minimal, but we should:
- Avoid capturing extremely large fixtures (> 10MB) initially
- Ensure fixture capture scripts don't consume excessive memory
- Keep fixture files in Git LFS if they grow large

## Security Considerations

- **No secrets**: Ensure captured fixtures contain no API keys or tokens
- **Sanitization**: Review fixtures before committing to remove any PII
- **Safe prompts**: Use benign prompts that won't generate sensitive content
- **Local only**: All fixture data stays local, no external transmission

## Documentation

### Created in Phase 0:
1. **README.md**: Basic project description and setup instructions
2. **tests/fixtures/README.md**: How to capture and use fixtures
3. **tests/fixtures/{vendor}/README.md**: Vendor-specific notes
4. **SCHEMA_ANALYSIS.md**: Auto-generated schema documentation

### README.md Template:
```markdown
# agent-stream-fmt

Universal JSONL formatter for AI agent CLIs (Claude Code, Gemini CLI, Amp Code).

## Status: Phase 0 - Setting Up

Currently capturing fixtures and analyzing output formats.

## Setup

```bash
npm install
```

## Capturing Fixtures

See `tests/fixtures/README.md` for detailed instructions.

Quick start:
```bash
npm run fixtures:capture
npm run fixtures:analyze
```

## Development

This project is being built in phases. See `specs/implementation-roadmap.md`.
```

## Implementation Phases

Since this IS Phase 0, the implementation is:

1. **Project initialization** (30 min)
   - Run npm init and install dependencies
   - Create directory structure
   - Set up TypeScript and build configs

2. **Fixture capture** (2-3 hours)
   - Manually run commands for each vendor
   - Capture diverse scenarios
   - Organize in proper directories

3. **Schema analysis** (1 hour)
   - Run analysis scripts
   - Document findings
   - Update specs if needed

4. **Validation setup** (30 min)
   - Create basic tests
   - Ensure fixtures are valid
   - Set up test infrastructure

## Open Questions

1. **Vendor availability**: Which agent CLIs are actually accessible?
2. **Version specifics**: Should we capture version info with fixtures?
3. **Streaming formats**: Do any vendors use different formats for streaming vs batch?
4. **Error formats**: How do agents report errors in JSONL mode?
5. **Binary content**: How do agents handle non-text output (images, etc.)?
6. **Rate limits**: Are there API limits we need to consider when capturing?

## References

- [Node.js Streams documentation](https://nodejs.org/api/stream.html)
- [NDJSON specification](http://ndjson.org/)
- [tsup documentation](https://tsup.egoist.dev/)
- [Vitest documentation](https://vitest.dev/)

## Next Steps

After Phase 0 completion:
1. Review captured fixtures and schema analysis
2. Update main spec if new event types discovered
3. Proceed to Phase 1: Core Types & Parser Infrastructure