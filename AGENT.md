# AGENT.md
This file provides guidance to AI coding assistants working in this repository.

**Note:** CLAUDE.md, .clinerules, .cursorrules, .windsurfrules, .replit.md, GEMINI.md, and other AI config files are symlinks to AGENT.md in this project.

# Agent Stream Formatter

A universal JSONL formatter for AI agent CLIs that normalizes output from Claude Code, Gemini CLI, and Amp Code into unified event streams with beautiful ANSI terminal and HTML rendering.

## Project Status

**Current State**: Planning/Specification phase - no implementation yet  
**Next Step**: Begin Phase 0 (Project Setup & Fixture Collection)

## Build & Commands

### Current Commands (Pre-Implementation)
```bash
# Git operations
git status                    # Check current state
git add .                     # Stage changes
git commit -m "type: message" # Commit with conventional format

# Specification review
ls specs/                     # List all specification documents
```

### Planned Commands (After Implementation)
```bash
# Development
npm run build                 # Build TypeScript project with tsup
npm run dev                   # Development mode with watch
npm run typecheck             # TypeScript type checking

# Testing
npm test                      # Run all tests with vitest
npm run test:watch            # Run tests in watch mode
npm run test:unit             # Run unit tests only
npm run test:integration      # Run integration tests only
npm run test:performance      # Run performance benchmarks

# Test single file
npm test -- test/path/to/file.test.ts

# Code Quality
npm run lint                  # ESLint checking
npm run format                # Format code with Prettier
npm run fix                   # Auto-fix linting issues

# CLI Usage (after build)
agent-stream-fmt [options] [file]
```

## Code Style

### Git Commit Convention
- **Format**: Conventional Commits (https://www.conventionalcommits.org/)
- **Structure**: `type(scope): description`
- **Types**: feat, fix, docs, style, refactor, test, chore, perf
- **Examples**:
  ```
  feat(parser): add Claude JSONL parser
  fix(stream): handle partial lines correctly
  docs: update API documentation
  perf(render): optimize ANSI color handling
  test: add Gemini parser edge cases
  ```

### TypeScript Guidelines
- **Strict mode**: Always use strict TypeScript configuration
- **Module system**: ESM modules only
- **Target**: ES2022 or later
- **Imports**: Use explicit imports, prefer named imports
```typescript
// Good
import { streamEvents, AgentEvent } from './stream';
import type { Vendor } from './types';

// Avoid
import * as stream from './stream';
```

### Naming Conventions
- **Files**: kebab-case (`agent-parser.ts`)
- **Functions/Variables**: camelCase (`streamEvents`, `parseMessage`)
- **Types/Interfaces**: PascalCase (`AgentEvent`, `VendorParser`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_LINE_LENGTH`)
- **Enums**: PascalCase with descriptive names

### Code Organization
```typescript
// File structure order:
1. Type imports
2. Value imports
3. Type definitions
4. Constants
5. Main implementation
6. Default export (if any)

// Example file structure:
import type { AgentEvent } from './types';
import { kleur } from 'kleur';

interface RenderOptions {
  // ...
}

const DEFAULT_OPTIONS: RenderOptions = {
  // ...
};

export class AnsiRenderer {
  // ...
}
```

### Error Handling
- **Graceful degradation**: Never crash on malformed input
- **Explicit error types**: Use typed errors when possible
- **Logging**: Use structured logging for debugging
```typescript
// Good
try {
  const obj = JSON.parse(line);
  return parseEvent(obj);
} catch (error) {
  return { t: 'error', message: `Parse error: ${error.message}` };
}

// Avoid silent failures
try {
  const obj = JSON.parse(line);
  return parseEvent(obj);
} catch {
  return null; // Don't do this
}
```

## Testing

### Framework & Patterns
- **Framework**: Vitest (planned)
- **Test files**: `*.test.ts` in `tests/` directory
- **Fixtures**: Real CLI outputs in `tests/fixtures/`
- **Coverage**: Aim for >90% coverage

### Testing Philosophy
**When tests fail, fix the code, not the test.**

Key principles:
- **Tests should be meaningful** - Avoid tests that always pass regardless of behavior
- **Test actual functionality** - Call the functions being tested, don't just check side effects
- **Failing tests are valuable** - They reveal bugs or missing features
- **Fix the root cause** - When a test fails, fix the underlying issue, don't hide the test
- **Test edge cases** - Tests that reveal limitations help improve the code
- **Document test purpose** - Each test should include a comment explaining why it exists and what it validates

### Test Categories
1. **Parser tests**: Validate vendor-specific parsing logic
2. **Stream tests**: Test async iteration and backpressure
3. **Render tests**: Verify ANSI and HTML output formatting
4. **Integration tests**: End-to-end CLI functionality
5. **Performance tests**: Throughput and memory benchmarks

### Testing Examples
```typescript
// Good test - tests actual behavior
describe('Claude parser', () => {
  it('should parse message events correctly', () => {
    const line = '{"type":"message","role":"assistant","content":"Hello"}';
    const events = parseClaudeLine(line);
    
    expect(events).toEqual([
      { t: 'msg', role: 'assistant', text: 'Hello' }
    ]);
  });
});

// Performance test
it('should process 50k lines per second', async () => {
  const lines = generateTestLines(50000);
  const start = performance.now();
  
  for await (const event of streamEvents({ vendor: 'claude', source: lines })) {
    // Process events
  }
  
  const elapsed = performance.now() - start;
  const linesPerSecond = 50000 / (elapsed / 1000);
  expect(linesPerSecond).toBeGreaterThan(50000);
});
```

## Security

### Input Validation
- **JSON parsing**: Always use try-catch for JSON.parse()
- **Size limits**: Limit individual line size to prevent DoS
- **HTML escaping**: Escape all user content in HTML output
- **No code execution**: Never eval() or execute user content

### Data Protection
- **No secrets**: Ensure test fixtures contain no API keys or tokens
- **Sanitize output**: Remove sensitive information from logs
- **Minimal dependencies**: Only use essential packages (kleur for colors)

### Security Patterns
```typescript
// Safe HTML escaping
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Safe JSON parsing
function safeParse(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
```

## Performance Requirements

### Targets
- **Throughput**: >50,000 lines/second
- **Memory**: <20MB RSS for infinite streams
- **Latency**: <10ms for first output
- **Startup**: <100ms from CLI invocation

### Optimization Guidelines
- **Streaming**: Use async iterators, avoid buffering
- **Memory**: Constant memory usage regardless of input size
- **String operations**: Minimize concatenation, use arrays
- **RegExp**: Pre-compile patterns, avoid in hot paths

## Configuration

### Environment Variables
```bash
# Development
NODE_ENV=development          # Enable debug logging
DEBUG=agent-stream-fmt:*     # Debug namespace

# Testing
TEST_LIVE=true               # Enable live CLI testing
TEST_FIXTURES=/path/to/fixtures  # Custom fixture directory
```

### Dependencies
- **Runtime**: Node.js >=18.0.0
- **Core dependency**: kleur (ANSI colors)
- **Dev dependencies**: TypeScript, Vitest, ESLint, Prettier

## Architecture

### Core Types
```typescript
// Main event union type
export type AgentEvent =
  | { t: 'msg'; role: 'user' | 'assistant' | 'system'; text: string }
  | { t: 'tool'; name: string; phase: 'start' | 'stdout' | 'stderr' | 'end'; text?: string; exitCode?: number }
  | { t: 'cost'; deltaUsd: number }
  | { t: 'error'; message: string }
  | { t: 'debug'; raw: any };

// Vendor types
export type Vendor = 'auto' | 'claude' | 'gemini' | 'amp';
```

### Streaming API
```typescript
// Core streaming function
export async function* streamEvents(opts: StreamEventOptions): AsyncIterator<AgentEvent>

// Formatting with rendering
export async function* streamFormat(opts: StreamFormatOptions): AsyncIterator<string>
```

### Directory Structure
```
agent-stream-fmt/
├── src/                  # Source code
│   ├── types.ts         # Core type definitions
│   ├── parsers/         # Vendor-specific parsers
│   │   ├── index.ts     # Parser registry
│   │   ├── claude.ts    # Claude Code parser
│   │   ├── gemini.ts    # Gemini CLI parser
│   │   └── amp.ts       # Amp Code parser
│   ├── render/          # Output formatters
│   │   ├── ansi.ts      # Terminal ANSI rendering
│   │   └── html.ts      # HTML document rendering
│   ├── utils/           # Utility functions
│   │   ├── line-reader.ts   # Line-by-line stream reader
│   │   └── backpressure.ts  # Stream backpressure handling
│   ├── stream.ts        # Main streaming engine
│   ├── cli.ts           # Command-line interface
│   └── index.ts         # Public API exports
├── tests/                # Test files and fixtures
│   ├── fixtures/        # JSONL fixture files
│   │   ├── claude/      # Claude CLI outputs
│   │   ├── gemini/      # Gemini CLI outputs
│   │   └── amp/         # Amp Code outputs
│   └── *.test.ts        # Test files
├── scripts/              # Development scripts
│   ├── capture-fixtures.ts   # Capture CLI outputs
│   ├── analyze-schemas.ts    # Analyze fixture schemas
│   └── validate-fixtures.ts  # Validate fixture files
├── reports/              # Phase reports and documentation
│   └── PHASE_*_REPORT.md # Phase completion reports
├── specs/                # Specification documents
└── dist/                 # Built output
```

### Report Generation

**Important**: ALL reports should be saved to the `reports/` directory with descriptive names. This includes but is not limited to:

**Implementation Reports:**
- Phase validation: `PHASE_X_VALIDATION_REPORT.md`
- Implementation summaries: `IMPLEMENTATION_SUMMARY_[FEATURE].md`
- Feature completion: `FEATURE_[NAME]_REPORT.md`

**Testing & Analysis Reports:**
- Test results: `TEST_RESULTS_[DATE].md`
- Coverage reports: `COVERAGE_REPORT_[DATE].md`
- Schema analysis: `SCHEMA_ANALYSIS_[VENDOR].md`
- Fixture validation: `FIXTURE_VALIDATION_REPORT.md`

**Performance & Benchmarks:**
- Performance benchmarks: `PERFORMANCE_BENCHMARK_[DATE].md`
- Memory profiling: `MEMORY_PROFILE_[SCENARIO].md`
- Load testing: `LOAD_TEST_[VERSION].md`

**Quality & Validation:**
- Code quality: `CODE_QUALITY_REPORT.md`
- Security audit: `SECURITY_AUDIT_[DATE].md`
- Dependency analysis: `DEPENDENCY_REPORT.md`
- API compatibility: `API_COMPATIBILITY_REPORT.md`

**General Guidelines:**
- Use descriptive names that indicate report type and scope
- Include dates where relevant (format: YYYY-MM-DD)
- Group related reports with common prefixes
- Keep all reports in Markdown format for consistency

This keeps the project root clean and provides a central location for all project documentation and analysis.

## Temporary Files & Debugging

All temporary files, debugging scripts, and test artifacts should be organized in a `/temp` folder:

### Temporary File Organization
- **Debug scripts**: `temp/debug-*.js`, `temp/analyze-*.py`
- **Test artifacts**: `temp/test-results/`, `temp/coverage/`
- **Generated files**: `temp/generated/`, `temp/build-artifacts/`
- **Logs**: `temp/logs/debug.log`, `temp/logs/error.log`

### Guidelines
- Never commit files from `/temp` directory
- Use `/temp` for all debugging and analysis scripts created during development
- Clean up `/temp` directory regularly or use automated cleanup
- Include `/temp/` in `.gitignore` to prevent accidental commits

### Example `.gitignore` patterns
```
# Temporary files and debugging
/temp/
temp/
**/temp/
debug-*.js
test-*.py
analyze-*.sh
*-debug.*
*.debug
```

## Implementation Phases

### Phase 0: Project Setup & Fixture Collection
- Initialize TypeScript project with modern tooling
- Capture real JSONL outputs from Claude Code, Gemini CLI, Amp Code
- Set up testing infrastructure with fixtures

### Phase 1: Core Types & Parser Infrastructure
- Define TypeScript types for all event formats
- Implement extensible parser interface
- Create Claude parser with comprehensive tests

### Phase 2: Streaming Engine
- Build memory-efficient line reader
- Implement async iterator streaming pipeline
- Add error handling and recovery

### Phase 3: Rendering Engine
- Create ANSI terminal renderer with colors and formatting
- Implement HTML renderer with semantic structure
- Build enhanced CLI with filtering options

### Phase 4: Additional Vendors
- Add Gemini CLI parser
- Add Amp Code parser
- Improve auto-detection logic

### Phase 5: Package & Documentation
- Complete documentation and examples
- Set up publishing and CI/CD
- Performance optimization and benchmarking

## Key Files to Review

Before implementing, review these specification documents:
- `specs/feat-jsonl-stream-formatter.md` - Main feature specification
- `specs/implementation-roadmap.md` - Complete execution plan
- `specs/testing-strategy.md` - Testing approach and fixture management
- `specs/phase-*.md` - Detailed implementation phases

## Contributing Guidelines

1. **Follow specifications**: All implementation must match the detailed specs
2. **Fixture-first approach**: Capture real CLI outputs before implementing parsers
3. **Performance focus**: Maintain streaming efficiency and memory bounds
4. **Test-driven**: Write tests using real fixtures, not synthetic data
5. **TypeScript strict**: Use strict type checking throughout

## CLI Interface

### Basic Usage
```bash
# Auto-detect vendor and format for terminal
claude --json "explain recursion" | agent-stream-fmt

# Explicit vendor with options
gemini --jsonl -i task.md | agent-stream-fmt --vendor gemini --hide-tools

# HTML output for web display
amp-code run build.yml -j | agent-stream-fmt --html > build-log.html

# Filter specific event types
cat session.jsonl | agent-stream-fmt --only tool,error --collapse-tools
```

### Options
```bash
-v, --vendor <type>     # Vendor: auto|claude|gemini|amp (default: auto)
-f, --format <type>     # Format: ansi|html|json (default: ansi)
--collapse-tools        # Collapse tool output sections
--hide-tools           # Hide tool execution entirely
--hide-cost            # Hide cost information
--hide-debug           # Hide debug events
--only <types>         # Show only specific event types
-o, --output <file>    # Output file (default: stdout)
--html                 # Shorthand for --format html
--json                 # Shorthand for --format json
```

## Troubleshooting

### Common Issues
- **Memory usage**: Check for buffering in stream processing
- **Performance**: Profile with `--inspect` flag for bottlenecks
- **Parsing errors**: Validate fixtures match expected format
- **Test failures**: Ensure fixtures represent real CLI outputs

### Debug Commands
```bash
# Debug parsing issues
DEBUG=agent-stream-fmt:parser npm test

# Memory profiling
node --inspect --inspect-brk dist/cli.js < large-file.jsonl

# Performance profiling
node --prof dist/cli.js < test-data.jsonl
```