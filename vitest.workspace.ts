import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Include all packages with their own vitest.config.ts
  'packages/*/vitest.config.ts',
  // Include packages without vitest.config.ts
  {
    test: {
      include: ['packages/core/**/*.test.ts', 'packages/core/**/*.spec.ts'],
      name: 'core',
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/jsonl/**/*.test.ts', 'packages/jsonl/**/*.spec.ts'],
      name: 'jsonl',
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/stream/**/*.test.ts', 'packages/stream/**/*.spec.ts'],
      name: 'stream',
      environment: 'node',
    },
  },
  {
    test: {
      include: ['packages/invoke/**/*.test.ts', 'packages/invoke/**/*.spec.ts'],
      name: 'invoke',
      environment: 'node',
    },
  },
  // Integration tests
  {
    test: {
      include: ['tests/integration/**/*.test.ts', 'tests/integration/**/*.spec.ts'],
      name: 'integration',
      environment: 'node',
      testTimeout: 30000,
    },
  },
]);