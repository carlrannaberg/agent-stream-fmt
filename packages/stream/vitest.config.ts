import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/performance*.test.ts',
      '**/*benchmark*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/fixtures/',
        'scripts/',
        'benchmarks/',
        'examples/',
        'temp/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.config.js',
        '**/*.test.ts',
        '**/test-utils.ts',
        'tests/parsers/performance-benchmarks.test.ts',
        'tests/render/performance.test.ts',
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
      // Only include source files in coverage
      include: ['src/**/*.ts'],
      // Enable coverage reporting for all files, even uncovered ones
      all: true,
    },
  },
});
