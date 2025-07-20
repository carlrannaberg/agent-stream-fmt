# Migration Guide: agent-stream-fmt to @agent-io/stream

This guide will help you migrate from the original `agent-stream-fmt` package to the new monorepo-based `@agent-io/stream` package. The migration is straightforward with no breaking changes - only the package name and import paths have changed.

## Table of Contents

- [Overview](#overview)
- [Step-by-Step Migration](#step-by-step-migration)
- [Import Path Changes](#import-path-changes)
- [CLI Command Changes](#cli-command-changes)
- [Package.json Updates](#packagejson-updates)
- [TypeScript Configuration](#typescript-configuration)
- [Common Migration Scenarios](#common-migration-scenarios)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)

## Overview

The `agent-stream-fmt` package has been migrated to a monorepo structure and is now published as `@agent-io/stream`. This change brings several benefits:

- Better organization and modularity
- Easier maintenance and updates
- Consistent versioning across related packages
- Improved development workflow

**Good news:** There are no breaking API changes! All your existing code will work with simple import path updates.

## Step-by-Step Migration

### 1. Uninstall the Old Package

First, remove the old package from your project:

```bash
npm uninstall agent-stream-fmt
# or
yarn remove agent-stream-fmt
# or
pnpm remove agent-stream-fmt
```

### 2. Install the New Package

Install the new scoped package:

```bash
npm install @agent-io/stream
# or
yarn add @agent-io/stream
# or
pnpm add @agent-io/stream
```

### 3. Update Your Imports

Update all import statements in your codebase:

```diff
# TypeScript/JavaScript imports
- import { streamEvents, streamFormat } from 'agent-stream-fmt';
+ import { streamEvents, streamFormat } from '@agent-io/stream';

- import type { AgentEvent, Vendor } from 'agent-stream-fmt';
+ import type { AgentEvent, Vendor } from '@agent-io/stream';

# Require statements (CommonJS)
- const { streamEvents } = require('agent-stream-fmt');
+ const { streamEvents } = require('@agent-io/stream');
```

### 4. Verify the Migration

Run your tests and build process to ensure everything works correctly:

```bash
npm test
npm run build
```

## Import Path Changes

### Core Exports

All main exports remain the same, only the package name changes:

```typescript
// Before
import {
  streamEvents,
  streamFormat,
  parseClaudeLine,
  parseGeminiLine,
  parseAmpLine,
  AnsiRenderer,
  HtmlRenderer,
  JsonRenderer
} from 'agent-stream-fmt';

// After
import {
  streamEvents,
  streamFormat,
  parseClaudeLine,
  parseGeminiLine,
  parseAmpLine,
  AnsiRenderer,
  HtmlRenderer,
  JsonRenderer
} from '@agent-io/stream';
```

### Type Imports

```typescript
// Before
import type {
  AgentEvent,
  MessageEvent,
  ToolEvent,
  CostEvent,
  ErrorEvent,
  DebugEvent,
  Vendor,
  VendorParser,
  StreamEventOptions,
  StreamFormatOptions,
  RenderOptions,
  Renderer
} from 'agent-stream-fmt';

// After
import type {
  AgentEvent,
  MessageEvent,
  ToolEvent,
  CostEvent,
  ErrorEvent,
  DebugEvent,
  Vendor,
  VendorParser,
  StreamEventOptions,
  StreamFormatOptions,
  RenderOptions,
  Renderer
} from '@agent-io/stream';
```

## CLI Command Changes

The CLI command remains the same - `agent-stream-fmt`:

```bash
# No change needed!
claude --json "explain recursion" | agent-stream-fmt
gemini --jsonl -i task.md | agent-stream-fmt --vendor gemini
amp-code run build.yml -j | agent-stream-fmt --html > output.html
```

The binary name is kept for backward compatibility, ensuring your scripts and workflows continue to work without modification.

## Package.json Updates

### Dependencies Section

Update your `package.json` dependencies:

```diff
{
  "dependencies": {
-   "agent-stream-fmt": "^1.0.0",
+   "@agent-io/stream": "^0.1.0",
    // ... other dependencies
  }
}
```

### Scripts Section

If you have npm scripts that reference the package, update them:

```diff
{
  "scripts": {
-   "format-logs": "cat logs.jsonl | npx agent-stream-fmt",
+   "format-logs": "cat logs.jsonl | npx @agent-io/stream",
    // ... other scripts
  }
}
```

Note: Using the CLI binary name (`agent-stream-fmt`) in scripts will continue to work without changes.

## TypeScript Configuration

If you're using TypeScript with path mappings, update your `tsconfig.json`:

```diff
{
  "compilerOptions": {
    "paths": {
-     "agent-stream-fmt": ["node_modules/agent-stream-fmt"],
+     "@agent-io/stream": ["node_modules/@agent-io/stream"],
      // ... other paths
    }
  }
}
```

## Common Migration Scenarios

### Basic Stream Processing

```typescript
// Before
import { streamEvents } from 'agent-stream-fmt';
import { createReadStream } from 'fs';

const stream = createReadStream('session.jsonl');
for await (const event of streamEvents({ source: stream, vendor: 'claude' })) {
  console.log(event);
}

// After (only import changes)
import { streamEvents } from '@agent-io/stream';
import { createReadStream } from 'fs';

const stream = createReadStream('session.jsonl');
for await (const event of streamEvents({ source: stream, vendor: 'claude' })) {
  console.log(event);
}
```

### Custom Renderer Integration

```typescript
// Before
import { Renderer, RenderContext } from 'agent-stream-fmt';

class CustomRenderer implements Renderer {
  render(ctx: RenderContext): string {
    // ... implementation
  }
}

// After (only import changes)
import { Renderer, RenderContext } from '@agent-io/stream';

class CustomRenderer implements Renderer {
  render(ctx: RenderContext): string {
    // ... implementation
  }
}
```

### Express Server Integration

```typescript
// Before
import { streamFormat } from 'agent-stream-fmt';
import express from 'express';

const app = express();
app.post('/format', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  for await (const chunk of streamFormat({
    source: req.body.jsonl.split('\n'),
    vendor: 'auto',
    format: 'html'
  })) {
    res.write(chunk);
  }
  res.end();
});

// After (only import changes)
import { streamFormat } from '@agent-io/stream';
// ... rest remains the same
```

## FAQ

### Why the migration to a monorepo?

The migration to a monorepo structure under the `@agent-io` scope provides several benefits:

1. **Better Organization**: Related packages can be developed and maintained together
2. **Consistent Versioning**: All packages in the monorepo can be versioned together
3. **Improved Development**: Easier to test cross-package changes and maintain consistency
4. **Future Expansion**: Makes it easier to add new agent-related packages in the future

### What's the performance impact?

There is no performance impact. The code is identical - only the package structure has changed. The same optimized streaming engine delivers 50,000+ lines/second throughput with constant memory usage.

### How long will backward compatibility be maintained?

The CLI binary name (`agent-stream-fmt`) will be maintained indefinitely to ensure existing scripts and workflows continue to function. However, we recommend updating import statements to use the new package name for better long-term support.

### Can I use both packages simultaneously during migration?

While technically possible, it's not recommended. The packages contain the same code, so having both installed may lead to confusion and increased bundle size. Complete the migration in one step if possible.

### How do I report migration issues?

If you encounter any issues during migration:

1. Check this guide's troubleshooting section
2. Search existing issues at https://github.com/yourusername/agent-io/issues
3. Create a new issue with the `migration` label if your problem isn't already reported

## Troubleshooting

### Module Resolution Errors

If you see errors like "Cannot find module '@agent-io/stream'":

1. Ensure you've installed the new package:
   ```bash
   npm list @agent-io/stream
   ```

2. Clear your node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. If using TypeScript, restart the TypeScript language server in your IDE

### Type Definition Issues

If TypeScript can't find type definitions:

1. Ensure you're using TypeScript 5.0 or later
2. Check that `@agent-io/stream` appears in your `node_modules`
3. Try explicitly importing types:
   ```typescript
   import type { AgentEvent } from '@agent-io/stream';
   ```

### Build Tool Configuration

If using build tools like Webpack, Rollup, or Vite, you may need to update alias configurations:

```javascript
// Webpack example
module.exports = {
  resolve: {
    alias: {
      'agent-stream-fmt': '@agent-io/stream'
    }
  }
};

// Vite example
export default {
  resolve: {
    alias: {
      'agent-stream-fmt': '@agent-io/stream'
    }
  }
};
```

### ESM/CommonJS Issues

The package supports both ESM and CommonJS. If you encounter module format issues:

1. For ESM projects, ensure your package.json has `"type": "module"`
2. For CommonJS, use `require('@agent-io/stream')`
3. The package provides both `.js` (ESM) and `.cjs` (CommonJS) builds

### CLI Not Found

If the `agent-stream-fmt` command is not found after installation:

1. Install globally:
   ```bash
   npm install -g @agent-io/stream
   ```

2. Or use npx:
   ```bash
   npx @agent-io/stream --help
   ```

3. Check your PATH includes npm's global bin directory:
   ```bash
   npm bin -g
   ```

## Summary

Migrating from `agent-stream-fmt` to `@agent-io/stream` is a simple process:

1. Replace the package in your dependencies
2. Update import statements to use the new package name
3. Everything else remains the same - no API changes!

The migration maintains full backward compatibility while providing a better foundation for future development. Your existing code, scripts, and workflows will continue to work with minimal changes.

For additional help or to report issues, please visit our [GitHub repository](https://github.com/yourusername/agent-io).