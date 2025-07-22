import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/performance*.test.ts', '**/*benchmark*.test.ts'],
    // Performance tests may take longer
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
