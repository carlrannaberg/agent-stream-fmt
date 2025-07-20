# @agent-io/stream-formatter

## 1.0.0

### Major Changes

- Monorepo migration and package restructuring

  This is a major release that transitions agent-stream-fmt into the @agent-io monorepo structure:
  - **BREAKING**: Package renamed from `agent-stream-fmt` to `@agent-io/stream-formatter`
  - **BREAKING**: Minimum Node.js version is now 18.0.0
  - Migrated to npm workspaces monorepo structure
  - Added changesets for independent versioning
  - Improved build and development tooling
  - No changes to the core API or functionality

  To migrate:

  ```bash
  npm uninstall agent-stream-fmt
  npm install @agent-io/stream-formatter
  ```

  Then update imports:

  ```typescript
  // Before
  import { streamFormat } from 'agent-stream-fmt';

  // After
  import { streamFormat } from '@agent-io/stream-formatter';
  ```
