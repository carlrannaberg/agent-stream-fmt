import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Exclude common patterns across all packages
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/fixtures/**',
        '**/scripts/**',
        '**/benchmarks/**',
        '**/examples/**',
        '**/temp/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.config.js',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/test-utils.ts',
        '**/test-helpers.ts',
        '**/coverage/**',
      ],
      // Include all source files from packages
      include: ['packages/*/src/**/*.ts'],
      // Enable coverage reporting for all files
      all: true,
      // Aggregate coverage from all workspaces
      reportsDirectory: './coverage',
      // Merge coverage from all packages
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Shared test configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    // Exclude performance tests from main test run
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/performance*.test.ts',
      '**/*benchmark*.test.ts',
    ],
    // Watch mode configuration
    watchExclude: ['**/node_modules/**', '**/dist/**', '.git/**'],
  },
});
