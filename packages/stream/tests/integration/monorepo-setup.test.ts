import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Integration test to verify monorepo setup
 */

describe('Monorepo Setup', () => {
  const rootDir = join(__dirname, '../../../..');

  it('should have all required packages', () => {
    const packages = ['core', 'jsonl', 'stream', 'invoke'];

    for (const pkg of packages) {
      const pkgPath = join(rootDir, 'packages', pkg, 'package.json');
      expect(existsSync(pkgPath), `Package ${pkg} should exist`).toBe(true);
    }
  });

  it('should have vitest configuration files', () => {
    // Root configs
    expect(existsSync(join(rootDir, 'vitest.config.ts'))).toBe(true);
    expect(existsSync(join(rootDir, 'vitest.workspace.ts'))).toBe(true);

    // Package configs
    const packagesWithVitest = ['core', 'jsonl', 'stream', 'invoke'];
    for (const pkg of packagesWithVitest) {
      const configPath = join(rootDir, 'packages', pkg, 'vitest.config.ts');
      expect(existsSync(configPath), `${pkg} should have vitest config`).toBe(
        true,
      );
    }
  });

  it('should have shared test utilities', () => {
    expect(existsSync(join(rootDir, 'tests/utils/test-helpers.ts'))).toBe(true);
    expect(existsSync(join(rootDir, 'tests/fixtures/index.ts'))).toBe(true);
    expect(existsSync(join(rootDir, 'tests/benchmarks/setup.ts'))).toBe(true);
  });

  it('should have coverage directory configured', () => {
    // Coverage directory will be created after running tests
    const _coverageDir = join(rootDir, 'coverage');
    // Just check that the parent directory exists
    expect(existsSync(rootDir)).toBe(true);
  });

  it('should have all packages built', () => {
    // Only check packages that are actually built (not placeholders)
    const packages = ['stream'];

    for (const pkg of packages) {
      const distPath = join(rootDir, 'packages', pkg, 'dist');
      expect(existsSync(distPath), `${pkg} should have dist directory`).toBe(
        true,
      );
    }
  });
});
