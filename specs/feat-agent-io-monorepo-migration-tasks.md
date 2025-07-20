# Task Breakdown: Agent-IO Monorepo Migration

Generated: 2025-07-20
Source: specs/feat-agent-io-monorepo-migration.md

## Overview

Transform the current agent-stream-fmt single package into a modular monorepo structure called "Agent-IO" - a universal I/O toolkit for AI agent CLIs. The initial release establishes the monorepo infrastructure with @agent-io/stream as the primary package containing all current functionality.

## Phase 1: Foundation - Monorepo Infrastructure

### Task 1.1: Initialize npm workspace structure

**Description**: Set up the base monorepo structure with npm workspaces configuration
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None

**Technical Requirements**:

- Create root directory structure with packages/, scripts/, docs/ folders
- Initialize root package.json with workspace configuration
- Set up npm workspaces with correct hoisting configuration
- Configure npm scripts for workspace management

**Implementation Steps**:

1. Create directory structure:
   ```
   agent-io/
   ├── packages/
   ├── scripts/
   ├── docs/
   ├── examples/
   ├── fixtures/
   └── tests/integration/
   ```
2. Initialize root package.json with workspaces field:
   ```json
   {
     "name": "@agent-io/monorepo",
     "private": true,
     "workspaces": ["packages/*"]
   }
   ```
3. Set up .npmrc for workspace configuration
4. Configure git repository settings

**Acceptance Criteria**:

- [ ] Directory structure created according to spec
- [ ] Root package.json configured with workspaces
- [ ] npm install successfully installs workspace dependencies
- [ ] Basic npm workspace commands work (npm ls, npm run)

### Task 1.2: Configure TypeScript project references

**Description**: Set up TypeScript configuration for monorepo with project references
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.3, 1.4

**Technical Requirements**:

- Root tsconfig.json with base compiler options
- Composite project configuration for incremental builds
- Path mappings for @agent-io/\* packages
- Package-specific tsconfig.json files with references

**Implementation Steps**:

1. Create root tsconfig.json with configuration from spec:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "strict": true,
       "composite": true,
       "paths": {
         "@agent-io/core": ["./packages/core/src"],
         "@agent-io/jsonl": ["./packages/jsonl/src"],
         "@agent-io/stream": ["./packages/stream/src"],
         "@agent-io/invoke": ["./packages/invoke/src"]
       }
     }
   }
   ```
2. Create package-specific tsconfig.json files
3. Set up TypeScript build scripts
4. Test incremental compilation

**Acceptance Criteria**:

- [ ] Root tsconfig.json configured with project references
- [ ] Package tsconfig files extend root configuration
- [ ] TypeScript compilation works with `tsc -b`
- [ ] Incremental builds function correctly
- [ ] Path mappings resolve correctly in IDE

### Task 1.3: Set up build tooling with tsup

**Description**: Configure tsup for building all packages in the monorepo
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, 1.4

**Technical Requirements**:

- Shared tsup configuration for consistent builds
- Support for ESM and CJS output formats
- Source map generation
- Tree shaking enabled
- Build scripts for individual and all packages

**Implementation Steps**:

1. Install tsup as dev dependency
2. Create shared tsup.config.ts in root:
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
3. Configure package.json build scripts
4. Test build output for all formats

**Acceptance Criteria**:

- [ ] tsup installed and configured
- [ ] Build scripts work for individual packages
- [ ] Build:all script builds all packages
- [ ] Output includes ESM, CJS, and TypeScript definitions
- [ ] Source maps generated correctly

### Task 1.4: Configure changesets for versioning

**Description**: Set up changesets for independent package versioning and releases
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2, 1.3

**Technical Requirements**:

- @changesets/cli v2.27+ installed
- Changeset configuration for independent versioning
- Release scripts configured
- GitHub Actions integration prepared

**Implementation Steps**:

1. Install @changesets/cli as dev dependency
2. Initialize changesets with `npx changeset init`
3. Configure .changeset/config.json:
   ```json
   {
     "changelog": "@changesets/cli/changelog",
     "commit": false,
     "fixed": [],
     "linked": [],
     "access": "public",
     "baseBranch": "main",
     "updateInternalDependencies": "patch",
     "ignore": []
   }
   ```
4. Add changeset scripts to root package.json
5. Create initial changeset for migration

**Acceptance Criteria**:

- [ ] Changesets initialized and configured
- [ ] Version script updates package versions correctly
- [ ] Release script prepared for publishing
- [ ] Documentation for changeset workflow created
- [ ] Initial changeset created for migration

### Task 1.5: Set up development tooling

**Description**: Configure ESLint, Prettier, and npm-run-all for development workflow
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.6

**Technical Requirements**:

- ESLint v8+ with TypeScript plugin
- Prettier v3+ with consistent formatting
- npm-run-all2 v6+ for parallel script execution
- Shared configurations for all packages
- Pre-commit hooks with lint-staged

**Implementation Steps**:

1. Install development dependencies:
   - @typescript-eslint/eslint-plugin
   - @typescript-eslint/parser
   - eslint
   - prettier
   - npm-run-all2
2. Create shared .eslintrc.json configuration
3. Create .prettierrc configuration
4. Set up npm scripts using npm-run-all:
   ```json
   {
     "dev": "npm-run-all --parallel dev:*",
     "build": "npm-run-all build:*",
     "test": "vitest",
     "lint": "eslint packages/*/src/**/*.ts",
     "format": "prettier --write ."
   }
   ```
5. Configure git hooks for pre-commit linting

**Acceptance Criteria**:

- [ ] ESLint configured and working across all packages
- [ ] Prettier formatting consistent across codebase
- [ ] npm-run-all scripts execute in parallel
- [ ] Pre-commit hooks validate code quality
- [ ] Development workflow documented

### Task 1.6: Configure testing infrastructure

**Description**: Set up Vitest for monorepo testing with coverage
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.5

**Technical Requirements**:

- Vitest v1+ with workspace support
- Coverage reporting with v8
- Shared test utilities and fixtures
- Integration test directory structure
- Performance benchmarking setup

**Implementation Steps**:

1. Install Vitest and coverage dependencies
2. Create vitest.config.ts with workspace configuration:
   ```typescript
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: {
       coverage: {
         reporter: ['text', 'json', 'html'],
         exclude: ['**/node_modules/**', '**/dist/**'],
       },
     },
   });
   ```
3. Set up shared fixtures directory
4. Create integration test structure
5. Configure test scripts in package.json

**Acceptance Criteria**:

- [ ] Vitest installed and configured for workspaces
- [ ] Test scripts work at root and package level
- [ ] Coverage reporting aggregates all packages
- [ ] Integration test directory created
- [ ] Fixture sharing mechanism established

## Phase 2: Core Migration

### Task 2.1: Create package directory structure

**Description**: Create all package directories with initial configurations
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1, 1.2
**Can run parallel with**: None

**Technical Requirements**:

- Create directories for core, jsonl, stream, invoke packages
- Initialize package.json for each package
- Set up basic TypeScript configurations
- Create src directories and index.ts files

**Implementation Steps**:

1. Create package directories:
   ```
   packages/
   ├── core/
   ├── jsonl/
   ├── stream/
   └── invoke/
   ```
2. Initialize each package with npm init
3. Create src/index.ts placeholder files
4. Set up package-specific tsconfig.json files
5. Add package.json configurations per spec

**Acceptance Criteria**:

- [ ] All four package directories created
- [ ] Each package has valid package.json
- [ ] TypeScript configurations reference root config
- [ ] Basic exports from index.ts files
- [ ] Packages listed in workspace

### Task 2.2: Migrate agent-stream-fmt to @agent-io/stream

**Description**: Move entire agent-stream-fmt codebase to @agent-io/stream package
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: Task 2.3

**Technical Requirements**:

- Copy all source files to packages/stream/src
- Update import paths for new structure
- Maintain all existing functionality
- Update package.json with correct dependencies
- Preserve all type definitions

**Implementation Steps**:

1. Copy source files from agent-stream-fmt to packages/stream/src:
   - types.ts → packages/stream/src/types.ts
   - stream.ts → packages/stream/src/stream.ts
   - cli.ts → packages/stream/src/cli.ts
   - parsers/_ → packages/stream/src/parsers/_
   - render/_ → packages/stream/src/render/_
   - utils/_ → packages/stream/src/utils/_
2. Update import statements for new structure
3. Configure package.json with dependencies:
   ```json
   {
     "dependencies": {
       "commander": "^14.0.0",
       "kleur": "^4.1.5"
     }
   }
   ```
4. Set up CLI binary configuration
5. Test that all functionality works

**Acceptance Criteria**:

- [ ] All source files migrated to @agent-io/stream
- [ ] Import paths updated correctly
- [ ] Package builds successfully
- [ ] CLI binary works when installed
- [ ] All existing functionality preserved

### Task 2.3: Create placeholder packages

**Description**: Create stub implementations for core, jsonl, and invoke packages
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.1
**Can run parallel with**: Task 2.2

**Technical Requirements**:

- @agent-io/core: Export basic type definitions
- @agent-io/jsonl: Export parser interface stubs
- @agent-io/invoke: Export CLI interface stubs
- Proper package.json configurations
- Minimal but valid implementations

**Implementation Steps**:

1. Create @agent-io/core/src/index.ts:
   ```typescript
   // Placeholder types - will be extracted from stream later
   export interface AgentEvent {
     t: string;
   }
   export type Vendor = 'claude' | 'gemini' | 'amp' | 'auto';
   ```
2. Create @agent-io/jsonl/src/index.ts:
   ```typescript
   // Placeholder parser interface
   export interface VendorParser {
     parse(line: string): unknown[];
   }
   ```
3. Create @agent-io/invoke/src/index.ts:
   ```typescript
   // Placeholder CLI exports
   export function createCLI(): void {
     console.log('CLI placeholder');
   }
   ```
4. Configure package.json files with proper exports
5. Ensure packages can be imported

**Acceptance Criteria**:

- [ ] All placeholder packages have valid exports
- [ ] Packages can be built successfully
- [ ] Import statements work correctly
- [ ] Package.json files configured per spec
- [ ] TypeScript types resolve correctly

### Task 2.4: Update @agent-io/stream imports

**Description**: Ensure @agent-io/stream works as standalone package
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.2, 2.3
**Can run parallel with**: None

**Technical Requirements**:

- Remove any circular dependencies
- Ensure all imports are self-contained
- Update package.json exports configuration
- Test standalone installation
- Verify tree shaking works

**Implementation Steps**:

1. Audit all imports in @agent-io/stream
2. Ensure no imports from other @agent-io packages yet
3. Update package.json exports:
   ```json
   {
     "exports": {
       ".": {
         "types": "./dist/index.d.ts",
         "import": "./dist/index.js",
         "require": "./dist/index.cjs"
       }
     }
   }
   ```
4. Build package and test imports
5. Verify package works when installed alone

**Acceptance Criteria**:

- [ ] No external @agent-io dependencies
- [ ] Package builds successfully standalone
- [ ] All exports accessible when installed
- [ ] Tree shaking removes unused code
- [ ] Package size reasonable for npm publish

## Phase 3: Testing & Validation

### Task 3.1: Migrate all tests to @agent-io/stream

**Description**: Move all existing tests to the stream package
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: Task 3.2

**Technical Requirements**:

- Move all test files to packages/stream/tests
- Update import paths in tests
- Ensure fixtures are accessible
- Maintain test coverage >90%
- Set up package-specific test scripts

**Implementation Steps**:

1. Copy test files to packages/stream/tests:
   - Unit tests for parsers
   - Stream functionality tests
   - Render tests
   - CLI tests
2. Update all import statements in tests
3. Configure vitest for package testing
4. Set up fixture access from shared directory
5. Run tests and fix any issues

**Acceptance Criteria**:

- [ ] All tests migrated successfully
- [ ] Tests pass with >90% coverage
- [ ] Fixture loading works correctly
- [ ] Test scripts work at package level
- [ ] No broken imports or missing dependencies

### Task 3.2: Create monorepo integration tests

**Description**: Build integration tests for monorepo functionality
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: Task 3.1

**Technical Requirements**:

- Test workspace installation process
- Verify inter-package dependencies (future)
- Test build process for all packages
- Verify publishing workflow
- Test development workflow

**Implementation Steps**:

1. Create tests/integration directory
2. Write workspace installation tests:
   ```typescript
   // Test npm workspace commands work
   // Test package resolution
   // Test hoisting behavior
   ```
3. Create build process tests
4. Add publishing simulation tests
5. Test development workflow scripts

**Acceptance Criteria**:

- [ ] Integration test suite created
- [ ] Workspace functionality verified
- [ ] Build process tested end-to-end
- [ ] Publishing workflow validated
- [ ] Development scripts tested

### Task 3.3: Validate package publishing

**Description**: Test npm publishing workflow for all packages
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1, 3.2
**Can run parallel with**: Task 3.4

**Technical Requirements**:

- Test pack command for each package
- Verify package contents are correct
- Check package size and dependencies
- Test local installation
- Validate publish configuration

**Implementation Steps**:

1. Run `npm pack` for each package
2. Inspect packed .tgz contents
3. Test local installation:
   ```bash
   npm install ./agent-io-stream-0.1.0.tgz
   ```
4. Verify all files included/excluded correctly
5. Check package metadata

**Acceptance Criteria**:

- [ ] All packages pack successfully
- [ ] Package contents match expectations
- [ ] No unnecessary files included
- [ ] Package sizes reasonable
- [ ] Local installation works correctly

### Task 3.4: Performance benchmarking

**Description**: Ensure monorepo migration maintains performance targets
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.4
**Can run parallel with**: Task 3.3

**Technical Requirements**:

- Throughput >50,000 lines/second maintained
- Memory usage <20MB RSS for streams
- Startup time <100ms
- Build time <10 seconds
- Benchmark comparison with original

**Implementation Steps**:

1. Run existing benchmarks on original code
2. Run benchmarks on @agent-io/stream
3. Compare results for:
   - Throughput performance
   - Memory usage
   - Startup time
   - Build performance
4. Document results in benchmark report
5. Optimize if needed

**Acceptance Criteria**:

- [ ] Performance benchmarks pass
- [ ] No regression from original
- [ ] Build time under 10 seconds
- [ ] Memory usage remains constant
- [ ] Benchmark report generated

### Task 3.5: Validate TypeScript project references

**Description**: Ensure TypeScript incremental builds work correctly
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.6

**Technical Requirements**:

- Test incremental compilation
- Verify reference paths work
- Check IDE integration
- Validate declaration maps
- Test watch mode

**Implementation Steps**:

1. Make change in one package
2. Run `tsc -b` and verify only affected packages rebuild
3. Test IDE go-to-definition across packages
4. Verify declaration maps generated
5. Test watch mode compilation

**Acceptance Criteria**:

- [ ] Incremental builds work correctly
- [ ] Only changed packages recompile
- [ ] IDE navigation works across packages
- [ ] Declaration maps generated
- [ ] Watch mode functions properly

### Task 3.6: End-to-end CLI testing

**Description**: Test the CLI functionality after migration
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.5

**Technical Requirements**:

- Test all CLI commands
- Verify options work correctly
- Test with real AI agent outputs
- Check error handling
- Validate help documentation

**Implementation Steps**:

1. Install @agent-io/stream globally
2. Test with Claude output:
   ```bash
   claude --json "test" | agent-stream-fmt
   ```
3. Test all format options (ansi, html, json)
4. Test filtering options
5. Verify error cases handled

**Acceptance Criteria**:

- [ ] CLI installs and runs correctly
- [ ] All options work as expected
- [ ] Real AI output processed correctly
- [ ] Error handling works properly
- [ ] Help text accurate and complete

## Phase 4: Documentation & Release

### Task 4.1: Create root README.md

**Description**: Write comprehensive monorepo documentation
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 3 completion
**Can run parallel with**: Task 4.2, 4.3

**Technical Requirements**:

- Overview of Agent-IO project
- Monorepo structure explanation
- Development setup instructions
- Contributing guidelines
- Package overview

**Implementation Steps**:

1. Write project overview section
2. Document monorepo structure
3. Create development setup guide:
   - Clone and install
   - Development commands
   - Testing instructions
4. Add contributing guidelines
5. List all packages with descriptions

**Acceptance Criteria**:

- [ ] Clear project overview provided
- [ ] Monorepo structure documented
- [ ] Setup instructions complete
- [ ] Contributing guide included
- [ ] All packages listed and described

### Task 4.2: Create package-specific documentation

**Description**: Write README for each package in the monorepo
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 3 completion
**Can run parallel with**: Task 4.1, 4.3

**Technical Requirements**:

- @agent-io/stream: Full API documentation
- @agent-io/core: Type definitions
- @agent-io/jsonl: Parser interface docs
- @agent-io/invoke: CLI documentation
- Installation and usage examples

**Implementation Steps**:

1. Create packages/stream/README.md:
   - Installation instructions
   - API documentation
   - Usage examples
   - CLI options
2. Create placeholder READMEs for other packages
3. Add code examples
4. Document configuration options
5. Include troubleshooting section

**Acceptance Criteria**:

- [ ] Each package has README.md
- [ ] API documentation complete
- [ ] Usage examples provided
- [ ] Installation instructions clear
- [ ] Troubleshooting guidance included

### Task 4.3: Create migration guide

**Description**: Document migration from agent-stream-fmt to @agent-io/stream
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 3 completion
**Can run parallel with**: Task 4.1, 4.2

**Technical Requirements**:

- Step-by-step migration instructions
- Import path changes
- CLI command changes
- Breaking changes (none expected)
- FAQ section

**Implementation Steps**:

1. Create docs/migration-guide.md
2. Document package name change:
   ```diff
   - npm install agent-stream-fmt
   + npm install @agent-io/stream
   ```
3. Show import changes:
   ```diff
   - import { streamEvents } from 'agent-stream-fmt';
   + import { streamEvents } from '@agent-io/stream';
   ```
4. List any CLI changes
5. Add common questions

**Acceptance Criteria**:

- [ ] Migration steps clearly documented
- [ ] Code examples show changes
- [ ] No breaking changes confirmed
- [ ] FAQ addresses common concerns
- [ ] Guide tested by following steps

### Task 4.4: Set up CI/CD pipeline

**Description**: Configure GitHub Actions for monorepo CI/CD
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.2
**Can run parallel with**: Task 4.5

**Technical Requirements**:

- Build and test all packages
- Run on pull requests
- Publish workflow with changesets
- Matrix testing for Node versions
- Coverage reporting

**Implementation Steps**:

1. Create .github/workflows/ci.yml:
   ```yaml
   name: CI
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       strategy:
         matrix:
           node: [18, 20]
   ```
2. Set up build and test steps
3. Create publish workflow
4. Configure changeset action
5. Set up coverage uploads

**Acceptance Criteria**:

- [ ] CI runs on all PRs
- [ ] All packages built and tested
- [ ] Multiple Node versions tested
- [ ] Publishing workflow ready
- [ ] Coverage reports generated

### Task 4.5: Update project metadata

**Description**: Update all project metadata for new structure
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 4.1
**Can run parallel with**: Task 4.4

**Technical Requirements**:

- Update repository URL
- Add keywords for npm
- Update author information
- Set up funding.yml
- Configure npm organization

**Implementation Steps**:

1. Update package.json metadata:
   - Repository URL
   - Keywords
   - Author information
   - License
2. Create .github/FUNDING.yml
3. Update LICENSE file
4. Set up npm organization settings
5. Configure package access levels

**Acceptance Criteria**:

- [ ] All metadata updated
- [ ] Repository URLs correct
- [ ] Keywords help discoverability
- [ ] Funding information added
- [ ] npm organization configured

### Task 4.6: Prepare initial release

**Description**: Create and publish first monorepo release
**Size**: Medium
**Priority**: High
**Dependencies**: All previous tasks
**Can run parallel with**: None

**Technical Requirements**:

- Create initial changesets
- Version packages appropriately
- Test publishing process
- Create GitHub release
- Announce migration

**Implementation Steps**:

1. Create changeset for migration:
   ```bash
   npx changeset
   ```
2. Version packages:
   ```bash
   npm run version
   ```
3. Build all packages
4. Publish to npm:
   ```bash
   npm run release
   ```
5. Create GitHub release with notes

**Acceptance Criteria**:

- [ ] Changesets created for all packages
- [ ] Versions set appropriately
- [ ] Packages published to npm
- [ ] GitHub release created
- [ ] Migration announced

## Summary

Total tasks: 24

- Phase 1 (Foundation): 6 tasks
- Phase 2 (Core Migration): 4 tasks
- Phase 3 (Testing & Validation): 6 tasks
- Phase 4 (Documentation & Release): 6 tasks

### Execution Strategy

1. **Phase 1**: Can parallelize tasks 1.2-1.6 after 1.1 completes
2. **Phase 2**: Task 2.1 first, then 2.2 and 2.3 in parallel
3. **Phase 3**: Many tasks can run in parallel after Phase 2
4. **Phase 4**: Documentation tasks can run in parallel

### Critical Path

1. Task 1.1 → Task 2.1 → Task 2.2 → Task 2.4 → Task 3.1 → Task 4.6

### Risk Mitigation

- Keep original agent-stream-fmt as backup
- Test each phase thoroughly before proceeding
- Document all decisions and changes
- Maintain backward compatibility
