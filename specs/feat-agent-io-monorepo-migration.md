# Feature Specification: Agent-IO Monorepo Migration

**Status**: Draft  
**Authors**: Claude Assistant  
**Date**: 2025-07-20  
**Version**: 1.0.0

## Overview

Transform the current agent-stream-fmt single package into a modular monorepo structure called
"Agent-IO" - a universal I/O toolkit for AI agent CLIs.

**Implementation Approach**: The initial release will establish the monorepo infrastructure with
@agent-io/stream as the primary package containing all current functionality. Future releases will
progressively extract functionality into the specialized packages (@agent-io/core, @agent-io/jsonl,
@agent-io/invoke) as described in this specification.

## Background/Problem Statement

The current agent-stream-fmt package bundles all functionality (parsing, streaming, rendering, CLI)
into a single package. This monolithic approach has several limitations:

1. **Installation overhead**: Users who only need parsing capabilities must install rendering
   dependencies
2. **Limited extensibility**: Adding new AI agents or formatters requires modifying the core package
3. **Version coupling**: All features must be versioned together, even when only one component
   changes
4. **Testing complexity**: Tests for different concerns are intermingled
5. **Future growth**: As more AI agents emerge, the single package will become unwieldy

The content-generator project demonstrates that a simple npm workspaces monorepo can effectively
manage multiple related packages with minimal tooling overhead.

## Implementation Scope

**Initial Migration Focus**: This specification describes the complete target architecture, but the
initial implementation will focus on:

1. **Monorepo Infrastructure**: Set up npm workspaces, build tooling, and development workflow
2. **@agent-io/stream Package**: Migrate the current agent-stream-fmt functionality as the primary
   package
3. **Package Stubs**: Create placeholder packages (@agent-io/core, @agent-io/jsonl,
   @agent-io/invoke) with minimal structure for future implementation

The full modularization into separate packages will be implemented in subsequent phases after
validating the monorepo structure and workflow.

## Goals

- **Modularize** the codebase into focused, single-responsibility packages
- **Enable** independent versioning and releases of packages
- **Improve** developer experience with clear API boundaries
- **Reduce** installation size for users who need specific functionality
- **Establish** foundation for future packages (@agent-io/claude-api, @agent-io/gemini-api, etc.)
- **Preserve** the excellent performance characteristics of the current implementation
- **Create** clean namespace under @agent-io organization

## Non-Goals

- **Not** switching to complex monorepo tools (Nx, Rush) - keep it simple with npm workspaces
- **Not** rewriting existing functionality - this is a restructuring, not a rewrite
- **Not** changing the public API - users should see no breaking changes
- **Not** adding new features in this migration - focus on structure only
- **Not** implementing agent invocation features yet - that's for future packages

## Technical Dependencies

### Build Tools

- **npm**: v8+ (native workspace management)
- **npm-run-all2**: v6+ (task orchestration)
- **tsup**: v8+ (current build tool, works well in monorepos)
- **changesets**: v2.27+ (versioning and publishing)

### Runtime Dependencies

- **kleur**: v4+ (ANSI colors - only for @agent-io/stream)
- **commander**: v14+ (CLI framework - only for @agent-io/invoke)

### Development Dependencies

- **TypeScript**: v5+ (with project references)
- **Vitest**: v1+ (supports workspaces natively)
- **ESLint**: v8+ (shared config)
- **Prettier**: v3+ (shared config)

## Detailed Design

### 1. Monorepo Structure

```
agent-io/
├── packages/
│   ├── core/                    # @agent-io/core
│   │   ├── src/
│   │   │   ├── index.ts        # Main exports
│   │   │   ├── types.ts        # AgentEvent, Vendor types
│   │   │   └── guards.ts       # Type guard functions
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── jsonl/                   # @agent-io/jsonl
│   │   ├── src/
│   │   │   ├── index.ts        # Parser registry & auto-detect
│   │   │   ├── types.ts        # VendorParser interface
│   │   │   ├── parsers/
│   │   │   │   ├── claude.ts
│   │   │   │   ├── gemini.ts
│   │   │   │   └── amp.ts
│   │   │   └── errors.ts       # ParseError class
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── stream/                  # @agent-io/stream
│   │   ├── src/
│   │   │   ├── index.ts        # streamEvents, streamFormat
│   │   │   ├── stream.ts       # Core streaming logic
│   │   │   ├── utils/
│   │   │   │   └── line-reader.ts
│   │   │   └── render/
│   │   │       ├── index.ts
│   │   │       ├── ansi.ts
│   │   │       ├── html.ts
│   │   │       ├── json.ts
│   │   │       └── factory.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── invoke/                  # @agent-io/invoke (CLI)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── cli.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│
├── examples/                    # Shared examples
├── fixtures/                    # Test fixtures (shared)
├── scripts/                     # Build & release scripts
├── docs/                        # Documentation
│
├── package.json                 # Root workspace config with workspaces field
├── tsconfig.json               # Base TypeScript config
├── .changeset/                 # Changeset config
└── README.md                   # Monorepo documentation
```

### 2. Package Configurations

#### Root package.json

```json
{
  "name": "@agent-io/monorepo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm-run-all --parallel dev:*",
    "dev:core": "npm run dev --workspace=@agent-io/core",
    "dev:jsonl": "npm run dev --workspace=@agent-io/jsonl",
    "dev:stream": "npm run dev --workspace=@agent-io/stream",
    "dev:invoke": "npm run dev --workspace=@agent-io/invoke",
    "build": "npm-run-all build:*",
    "build:core": "npm run build --workspace=@agent-io/core",
    "build:jsonl": "npm run build --workspace=@agent-io/jsonl",
    "build:stream": "npm run build --workspace=@agent-io/stream",
    "build:invoke": "npm run build --workspace=@agent-io/invoke",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "typecheck": "tsc -b",
    "lint": "eslint packages/*/src/**/*.ts",
    "format": "prettier --write .",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "npm run build && npm test && changeset publish",
    "clean": "npm run clean --workspaces --if-present && rm -rf node_modules"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "eslint": "^8.0.0",
    "npm-run-all2": "^6.0.0",
    "prettier": "^3.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

#### @agent-io/stream package.json (Initial Primary Package)

```json
{
  "name": "@agent-io/stream",
  "version": "0.1.0",
  "description": "Universal JSONL formatter for AI agent CLIs",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "bin": {
    "agent-stream-fmt": "./dist/cli.js"
  },
  "files": ["dist", "src"],
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "kleur": "^4.1.5"
  },
  "devDependencies": {
    "tsup": "workspace:*"
  },
  "keywords": ["agent-io", "ai", "jsonl", "stream", "cli"],
  "publishConfig": {
    "access": "public"
  }
}
```

### 3. TypeScript Configuration

#### Root tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "paths": {
      "@agent-io/core": ["./packages/core/src"],
      "@agent-io/jsonl": ["./packages/jsonl/src"],
      "@agent-io/stream": ["./packages/stream/src"],
      "@agent-io/invoke": ["./packages/invoke/src"]
    }
  },
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/jsonl" },
    { "path": "./packages/stream" },
    { "path": "./packages/invoke" }
  ]
}
```

#### Package-specific tsconfig.json (example for @agent-io/jsonl)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../core" }]
}
```

### 4. Build Configuration (tsup)

#### Shared tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'node18',
});
```

### 5. API Mapping

#### Migration Path

```typescript
// Current (before migration)
import { streamEvents, streamFormat, AgentEvent, Vendor } from 'agent-stream-fmt';

// After migration (initial release)
// All functionality moves to @agent-io/stream
import { streamEvents, streamFormat, AgentEvent, Vendor } from '@agent-io/stream';

// Future (when fully modularized into separate packages)
import { AgentEvent, Vendor } from '@agent-io/core';
import { streamEvents, streamFormat } from '@agent-io/stream';
```

Note: The initial migration simply relocates the entire agent-stream-fmt codebase to
@agent-io/stream within the monorepo structure. No separate agent-stream-fmt package will be
maintained.

### 6. Dependency Graph

```mermaid
graph TB
    subgraph "External Dependencies"
        K[kleur]
        C[commander]
    end

    subgraph "@agent-io packages"
        CORE[@agent-io/core<br/>0 deps]
        JSONL[@agent-io/jsonl<br/>depends: core]
        STREAM[@agent-io/stream<br/>depends: core, jsonl, kleur]
        INVOKE[@agent-io/invoke<br/>depends: core, stream, commander]
    end

    CORE --> JSONL
    CORE --> STREAM
    JSONL --> STREAM
    K --> STREAM
    STREAM --> INVOKE
    C --> INVOKE
```

## User Experience

### For Initial Release Users

The initial monorepo release will provide the @agent-io/stream package:

```bash
# Install the stream formatter package
npm install @agent-io/stream
```

```typescript
// Import from the new package
import { streamEvents } from '@agent-io/stream';
```

Note: The original `agent-stream-fmt` package is not being maintained separately.

### Future Package Availability

Once the full modularization is complete, users will be able to choose granular packages:

```bash
# Just need types? (future)
npm install @agent-io/core

# Just need parsing? (future)
npm install @agent-io/jsonl

# Need streaming with formatting? (available in initial release)
npm install @agent-io/stream

# Need the CLI? (future)
npm install -g @agent-io/invoke
```

### Developer Experience

```bash
# Clone and setup
git clone https://github.com/anthropics/agent-io
cd agent-io
npm install

# Development
npm run dev           # Watch all packages
npm test              # Test everything
npm run build         # Build all packages

# Work on specific package
npm run dev:stream    # Watch just stream package
# Or
cd packages/stream
npm run dev
```

## Testing Strategy

### 1. Unit Tests

- Each package has isolated unit tests in `packages/*/tests/`
- Existing tests are redistributed to appropriate packages
- Mock inter-package dependencies where needed

### 2. Integration Tests

- New `tests/integration/` directory at root
- Test package interactions
- Ensure compatibility package works correctly

### 3. E2E Tests

- Test CLI functionality end-to-end
- Test real AI agent output parsing
- Performance benchmarks remain at root level

### 4. Test Organization

```typescript
// packages/jsonl/tests/parsers/claude.test.ts
import { describe, it, expect } from 'vitest';
import { ClaudeParser } from '../../src/parsers/claude';

describe('ClaudeParser', () => {
  it('should parse message events correctly', () => {
    // Test implementation
  });
});

// tests/integration/stream-pipeline.test.ts
import { describe, it, expect } from 'vitest';
import { AgentEvent } from '@agent-io/core';
import { streamEvents } from '@agent-io/stream';

describe('Stream Pipeline Integration', () => {
  it('should parse and format Claude output end-to-end', async () => {
    // Test cross-package functionality
  });
});
```

### 5. Coverage Requirements

- Maintain current >90% coverage
- Each package reports individual coverage
- Root aggregates all coverage reports

## Performance Considerations

### Build Performance

- TypeScript project references enable incremental compilation
- Only rebuild changed packages
- Parallel builds with npm-run-all

### Runtime Performance

- No performance degradation - same code, different structure
- Potential for better tree-shaking in bundled applications
- Smaller install sizes for specific use cases

### Development Performance

- Faster iteration on individual packages
- Parallel test execution
- npm workspace hoisting reduces duplication

## Security Considerations

1. **Supply Chain**: Each package has minimal dependencies
2. **Publishing**: Scoped packages under @agent-io organization
3. **Permissions**: CLI package requires appropriate file system access
4. **Input Validation**: Remains in parser packages as before

## Documentation

### Required Documentation Updates

1. **Root README.md**: Overview of monorepo structure
2. **Package READMEs**: Specific documentation for each package
3. **Migration Guide**: For users moving from agent-stream-fmt to @agent-io/\*
4. **API Documentation**: Update TypeDoc configuration for monorepo
5. **Examples**: Update all examples to show both old and new import styles

### Documentation Structure

```
docs/
├── getting-started.md
├── migration-guide.md
├── packages/
│   ├── core.md
│   ├── jsonl.md
│   ├── stream.md
│   └── invoke.md
└── api/
    └── (generated TypeDoc)
```

## Implementation Phases

### Phase 1: Monorepo Setup (Week 1)

- [ ] Initialize npm workspace structure
- [ ] Setup root package.json with workspaces field
- [ ] Configure TypeScript project references
- [ ] Setup changesets for versioning
- [ ] Create package directories

### Phase 2: Core Migration (Week 2)

- [ ] Migrate entire agent-stream-fmt to @agent-io/stream package
- [ ] Create placeholder @agent-io/core with basic types export
- [ ] Create placeholder @agent-io/jsonl with stub exports
- [ ] Create placeholder @agent-io/invoke with stub exports
- [ ] Ensure @agent-io/stream works standalone

### Phase 3: Testing & Validation (Week 3)

- [ ] Migrate all tests to @agent-io/stream package
- [ ] Verify monorepo build process
- [ ] Test npm workspace commands
- [ ] Validate package publishing workflow
- [ ] Performance benchmarks

### Phase 4: Documentation & Release (Week 4)

- [ ] Update all documentation
- [ ] Create migration guide
- [ ] Setup CI/CD for monorepo
- [ ] Publish initial versions
- [ ] Announce migration

## Open Questions

1. **Package Manager**: Confirmed using npm workspaces for simplicity
   - Following content-generator pattern: npm + npm-run-all

2. **Versioning Strategy**: Independent versions or synchronized?
   - Recommendation: Independent with changesets managing dependencies

3. **Breaking Changes**: Should we make any API improvements during migration?
   - Recommendation: No, keep this as pure restructuring

4. **Organization Name**: Confirm @agent-io is available on npm
   - Action: Check npm registry before proceeding

5. **Future Packages**: Plan for @agent-io/claude-api, @agent-io/gemini-api?
   - Recommendation: Design with this extensibility in mind

## References

### Internal References

- Current agent-stream-fmt implementation
- content-generator monorepo patterns
- Existing test suites and fixtures

### External References

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Changesets Documentation](https://github.com/changesets/changesets)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [npm-run-all Documentation](https://github.com/mysticatea/npm-run-all)

### Design Patterns

- Monorepo structure inspired by: Babel, Jest, Parcel
- API design inspired by: Unified.js ecosystem
- Streaming patterns from: Node.js streams best practices

## Success Metrics

### Phase 1 (Initial Release with @agent-io/stream)

1. **Successful Migration**: All functionality available in @agent-io/stream package
2. **Monorepo Infrastructure**: npm workspaces functioning correctly
3. **Build Performance**: <10 second full build time
4. **Test Coverage**: Maintained >90% coverage
5. **Publishing**: Successful npm publish of @agent-io/stream

### Future Phases (Full Modularization)

1. **Package Granularity**: 50% reduction in install size for single-package users
2. **Build Performance**: <5 second incremental build times
3. **Developer Adoption**: Positive feedback on modular structure
4. **Future Extensibility**: Easy addition of new agent packages
