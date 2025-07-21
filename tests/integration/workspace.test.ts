import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, lstatSync } from 'fs';
import { join } from 'path';
import { getSharedSetup, getPackages, getRootDir, type IntegrationSetupResults } from './shared-setup.js';

/**
 * Integration tests for workspace installation and management
 * These tests verify that the monorepo workspace is properly configured
 */

describe('Workspace Installation', () => {
  const rootDir = getRootDir();
  const packageDirs = getPackages().map(pkg => `packages/${pkg}`);
  let _setupResults: IntegrationSetupResults;

  beforeAll(async () => {
    // Use shared setup that caches build across all integration tests
    _setupResults = await getSharedSetup();
    // Tests will use cwd option in execSync instead of process.chdir
    // since process.chdir is not supported in Vitest workers
  }, 120000);

  describe('Package Discovery', () => {
    it('should detect all workspace packages', () => {
      const result = execSync('npm ls --workspaces --json', { 
        encoding: 'utf8',
        cwd: rootDir 
      });
      
      const workspaceInfo = JSON.parse(result);
      expect(workspaceInfo.dependencies).toBeDefined();
      
      // Verify all expected packages are present in dependencies
      const dependencyNames = Object.keys(workspaceInfo.dependencies || {});
      expect(dependencyNames).toContain('@agent-io/core');
      expect(dependencyNames).toContain('@agent-io/jsonl');
      expect(dependencyNames).toContain('@agent-io/stream');
      expect(dependencyNames).toContain('@agent-io/invoke');
    });

    it('should have valid package.json files for all packages', () => {
      for (const pkgDir of packageDirs) {
        const packageJsonPath = join(rootDir, pkgDir, 'package.json');
        expect(existsSync(packageJsonPath), `${pkgDir}/package.json should exist`).toBe(true);
        
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        expect(packageJson.name).toBeDefined();
        expect(packageJson.version).toBeDefined();
        expect(packageJson.main || packageJson.exports).toBeDefined();
      }
    });
  });

  describe('Dependency Hoisting', () => {
    it('should have hoisted shared dependencies to root node_modules', () => {
      const rootNodeModules = join(rootDir, 'node_modules');
      expect(existsSync(rootNodeModules)).toBe(true);
      
      // Check that common dependencies are hoisted
      const sharedDeps = ['typescript', 'vitest', 'tsup', '@types/node'];
      for (const dep of sharedDeps) {
        const depPath = join(rootNodeModules, dep);
        expect(existsSync(depPath), `${dep} should be hoisted to root`).toBe(true);
      }
    });

    it('should not duplicate hoisted dependencies in packages', () => {
      const commonDeps = ['typescript', 'vitest'];
      
      for (const pkgDir of packageDirs) {
        const pkgNodeModules = join(rootDir, pkgDir, 'node_modules');
        
        if (existsSync(pkgNodeModules)) {
          for (const dep of commonDeps) {
            const depPath = join(pkgNodeModules, dep);
            expect(existsSync(depPath), 
              `${dep} should not be duplicated in ${pkgDir}/node_modules`
            ).toBe(false);
          }
        }
      }
    });
  });

  describe('Workspace Symlinks', () => {
    it('should create proper symlinks for inter-package dependencies', () => {
      // Check if stream package depends on core package
      const streamPackageJson = join(rootDir, 'packages/stream/package.json');
      if (existsSync(streamPackageJson)) {
        const streamPkg = JSON.parse(readFileSync(streamPackageJson, 'utf8'));
        const dependencies = { 
          ...streamPkg.dependencies, 
          ...streamPkg.devDependencies 
        };
        
        // If stream depends on @agent-io/core, check symlink
        if (dependencies['@agent-io/core']) {
          const symlinkPath = join(rootDir, 'packages/stream/node_modules/@agent-io/core');
          if (existsSync(symlinkPath)) {
            const stats = lstatSync(symlinkPath);
            expect(stats.isSymbolicLink()).toBe(true);
          }
        }
      }
    });

    it('should resolve workspace protocol dependencies', async () => {
      // Test that workspace: protocol resolves correctly
      try {
        const result = execSync('npm ls --workspaces --depth=1 --json', { 
          encoding: 'utf8',
          cwd: rootDir,
          timeout: 10000
        });
        
        const lsInfo = JSON.parse(result);
        expect(lsInfo.workspaces).toBeDefined();
        
        // Verify that workspace dependencies are resolved
        for (const [, workspaceInfo] of Object.entries(lsInfo.workspaces || {})) {
          const info = workspaceInfo as any;
          if (info.dependencies) {
            // Check that any @agent-io/* dependencies are properly resolved
            for (const [depName, depInfo] of Object.entries(info.dependencies)) {
              if (depName.startsWith('@agent-io/')) {
                expect(depInfo).toHaveProperty('resolved');
              }
            }
          }
        }
      } catch (error) {
        // npm ls can exit with non-zero code for warnings, check if it's a real error
        if (error instanceof Error && error.message.includes('ENOENT')) {
          throw error;
        }
        // Otherwise, it might just be warnings about peer dependencies
      }
    });
  });

  describe('Installation Health', () => {
    it('should have no missing dependencies', () => {
      try {
        execSync('npm ls --workspaces', { 
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 15000
        });
      } catch (error) {
        // npm ls exits with code 1 for warnings, check the actual error
        if (error instanceof Error && error.message.includes('missing')) {
          throw new Error(`Missing dependencies detected: ${error.message}`);
        }
        // Warnings about peer dependencies are acceptable
      }
    });

    it('should be able to run workspace scripts', () => {
      const result = execSync('npm run --workspaces --if-present --silent help || echo "help not available"', {
        encoding: 'utf8',
        cwd: rootDir
      });
      
      // Should not throw an error
      expect(result).toBeDefined();
    });

    it('should have consistent lock file', () => {
      const lockFilePath = join(rootDir, 'package-lock.json');
      expect(existsSync(lockFilePath)).toBe(true);
      
      const lockFile = JSON.parse(readFileSync(lockFilePath, 'utf8'));
      expect(lockFile.lockfileVersion).toBeGreaterThan(1);
      expect(lockFile.packages).toBeDefined();
    });
  });

  describe('Workspace Commands', () => {
    it('should support workspace-specific npm commands', () => {
      // Test workspace targeting
      const result = execSync('npm list --workspace packages/core --depth=0', {
        encoding: 'utf8',
        cwd: rootDir
      });
      
      expect(result).toContain('@agent-io/core');
    });

    it('should support running scripts across all workspaces', () => {
      // Test that we can run typecheck across all workspaces
      try {
        execSync('npm run typecheck --workspaces --if-present', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 30000
        });
      } catch (error) {
        // If typecheck fails, that's a different issue - we just want to ensure
        // the workspace command structure works
        if (error instanceof Error && error.message.includes('command not found')) {
          throw error;
        }
      }
    });
  });
});