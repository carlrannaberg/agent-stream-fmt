# Development Workflow

This document describes the development tools and workflow for the Agent-IO monorepo.

## Tools Overview

The project uses the following development tools:

- **ESLint** (v8+): TypeScript linting with `@typescript-eslint` plugin
- **Prettier** (v3+): Code formatting with consistent style
- **npm-run-all2** (v6+): Parallel script execution for improved performance
- **TypeScript** (v5+): Type checking across all packages

## Configuration Files

### ESLint Configuration (`.eslintrc.json`)

- Uses `@typescript-eslint/parser` for TypeScript support
- Extends recommended ESLint and TypeScript rules
- Custom rules for code quality and consistency
- Separate rules for test files
- Ignores build outputs and generated files

### Prettier Configuration (`.prettierrc.json`)

- Enforces consistent code style:
  - Semicolons: always
  - Single quotes for strings
  - 80-character line width (100 for Markdown)
  - Trailing commas in multi-line structures
  - Unix line endings (LF)
- Special formatting for Markdown, JSON, and YAML files

### Ignore Files

- `.eslintignore`: Excludes build outputs, dependencies, and non-source files
- `.prettierignore`: Similar exclusions plus preserves fixture formatting

## Available Scripts

### Root-Level Scripts

#### Building

```bash
npm run build          # Build all packages sequentially
npm run build:all      # Clean and build all packages
npm run build:core     # Build specific package
npm run clean          # Clean all build outputs
```

#### Development

```bash
npm run dev            # Run all package dev scripts in parallel
npm run dev:packages   # Run dev scripts in all workspaces
```

#### Code Quality

```bash
npm run lint           # Lint all TypeScript files
npm run lint:fix       # Auto-fix linting issues
npm run lint:packages  # Lint all packages
npm run format         # Format all files with Prettier
npm run format:check   # Check formatting without changes
```

#### Testing

```bash
npm run test           # Run all tests
npm run test:watch     # Run tests in watch mode
npm run typecheck      # Type check all packages
```

#### Validation

```bash
npm run validate       # Run lint, typecheck, and tests in parallel
npm run bootstrap      # Install deps and build everything
```

### Package-Level Scripts

Each package includes:

```bash
npm run build          # Build the package
npm run typecheck      # Type check the package
npm run clean          # Clean build outputs
npm run lint           # Lint package source
npm run lint:fix       # Fix linting issues
npm run format         # Format package files
npm run format:check   # Check package formatting
```

## Workflow Examples

### Starting Development

```bash
# Initial setup
npm run bootstrap

# Start development (builds and watches)
npm run dev
```

### Before Committing

```bash
# Run full validation
npm run validate

# Or run individually
npm run format
npm run lint:fix
npm run test
```

### Working on Specific Package

```bash
# Build specific package
npm run build:core

# Run scripts in specific workspace
npm run workspace:run packages/core lint
npm run workspace:run packages/jsonl test
```

### Adding Dependencies

```bash
# Add to specific package
npm run workspace:add packages/core lodash

# Add dev dependency to root
npm install --save-dev some-package
```

## Parallel Execution

The project uses `npm-run-all2` for efficient parallel execution:

- `validate` runs lint, typecheck, and tests in parallel
- `dev` runs all development servers in parallel
- Sequential operations (like `build:all`) ensure proper dependency order

## Best Practices

1. **Always run `npm run validate` before committing**
2. **Use workspace commands for package-specific operations**
3. **Keep configurations in sync across packages**
4. **Run `npm run format` to maintain consistent style**
5. **Fix linting errors immediately - don't disable rules**

## Troubleshooting

### ESLint Errors

- If you see TypeScript parsing errors, ensure the file is included in a `tsconfig.json`
- Use `npm run lint:fix` to auto-fix many issues

### Prettier Conflicts

- Run `npm run format` to fix formatting issues
- Check `.prettierignore` if files aren't being formatted

### Build Issues

- Run `npm run clean` to clear old build artifacts
- Ensure dependencies are built before dependent packages

### Script Failures

- Check that all packages have the required scripts
- Use `--if-present` flag for optional scripts
- Review npm-run-all2 output for parallel execution issues
