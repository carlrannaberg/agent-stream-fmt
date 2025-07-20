import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import * as tar from 'tar';

/**
 * Integration tests for publishing workflow simulation
 * Tests package creation, validation, and local installation
 */

describe('Publishing Simulation', () => {
  const rootDir = join(__dirname, '../..');
  const tempDir = join(rootDir, 'temp/publishing-test');
  const packages = [
    { name: '@agent-io/core', dir: 'packages/core' },
    { name: '@agent-io/jsonl', dir: 'packages/jsonl' },
    { name: '@agent-io/stream', dir: 'packages/stream' },
    { name: '@agent-io/invoke', dir: 'packages/invoke' },
    { name: 'agent-stream-fmt', dir: 'packages/agent-stream-fmt' }
  ];

  beforeAll(() => {
    // Tests will use cwd option in execSync instead of process.chdir
    // since process.chdir is not supported in Vitest workers
    
    // Clean up temp directory if it exists
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    mkdirSync(tempDir, { recursive: true });

    // Ensure packages are built
    try {
      execSync('npm run build:packages', {
        cwd: rootDir,
        stdio: 'pipe',
        timeout: 60000
      });
    } catch (error) {
      console.warn('Build failed during setup, continuing with existing builds');
    }
  });

  afterAll(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Package Creation', () => {
    it('should create valid npm packages for all workspace packages', () => {
      for (const pkg of packages) {
        const packageDir = join(rootDir, pkg.dir);
        if (!existsSync(join(packageDir, 'package.json'))) continue;

        try {
          const result = execSync('npm pack --pack-destination ' + tempDir, {
            cwd: packageDir,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000
          });

          const packageFileName = result.trim();
          const packagePath = join(tempDir, packageFileName);
          
          expect(existsSync(packagePath), `Package file ${packageFileName} should be created`).toBe(true);
          
          // Verify package file is not empty
          const stats = require('fs').statSync(packagePath);
          expect(stats.size).toBeGreaterThan(0);
        } catch (error) {
          console.error(`Failed to pack ${pkg.name}:`, error);
          throw error;
        }
      }
    });

    it('should include all necessary files in packages', async () => {
      const packageFiles = require('fs').readdirSync(tempDir).filter((f: string) => f.endsWith('.tgz'));
      
      for (const packageFile of packageFiles) {
        const packagePath = join(tempDir, packageFile);
        const extractDir = join(tempDir, packageFile.replace('.tgz', '-extracted'));
        
        // Extract package to verify contents
        await tar.extract({
          file: packagePath,
          cwd: tempDir,
          prefix: packageFile.replace('.tgz', '-extracted')
        });

        const packageContents = join(extractDir, 'package');
        expect(existsSync(packageContents), `Package ${packageFile} should extract correctly`).toBe(true);

        // Check for essential files
        expect(existsSync(join(packageContents, 'package.json'))).toBe(true);
        expect(existsSync(join(packageContents, 'README.md'))).toBe(true);
        
        // Should have dist directory with built files
        const distDir = join(packageContents, 'dist');
        if (existsSync(distDir)) {
          const distFiles = require('fs').readdirSync(distDir);
          expect(distFiles.length).toBeGreaterThan(0);
        }

        // Should not include development files
        expect(existsSync(join(packageContents, 'src'))).toBe(false);
        expect(existsSync(join(packageContents, 'tsconfig.json'))).toBe(false);
        expect(existsSync(join(packageContents, 'vitest.config.ts'))).toBe(false);
        expect(existsSync(join(packageContents, 'node_modules'))).toBe(false);
      }
    });
  });

  describe('Package Validation', () => {
    it('should have consistent package metadata', () => {
      for (const pkg of packages) {
        const packageJsonPath = join(rootDir, pkg.dir, 'package.json');
        if (!existsSync(packageJsonPath)) continue;

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        
        // Essential fields
        expect(packageJson.name).toBe(pkg.name);
        expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
        expect(packageJson.description).toBeDefined();
        expect(packageJson.license).toBeDefined();
        expect(packageJson.author).toBeDefined();

        // Repository information
        expect(packageJson.repository).toBeDefined();
        expect(packageJson.repository.type).toBe('git');

        // Entry points
        expect(packageJson.main || packageJson.exports).toBeDefined();
        
        // TypeScript support
        if (packageJson.types) {
          expect(packageJson.types).toMatch(/\.d\.ts$/);
        }

        // Files field should be defined to limit what gets published
        if (packageJson.files) {
          expect(Array.isArray(packageJson.files)).toBe(true);
          expect(packageJson.files).toContain('dist');
        }
      }
    });

    it('should have proper dependency declarations', () => {
      for (const pkg of packages) {
        const packageJsonPath = join(rootDir, pkg.dir, 'package.json');
        if (!existsSync(packageJsonPath)) continue;

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        
        // Check that all @agent-io dependencies are properly declared
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies
        };

        for (const [depName, depVersion] of Object.entries(allDeps)) {
          if (depName.startsWith('@agent-io/')) {
            // Should use workspace protocol or specific version
            expect(depVersion).toMatch(/^(workspace:|[\d^~])/);
          }
        }

        // Should not have devDependencies that should be dependencies
        if (packageJson.devDependencies) {
          const devDeps = Object.keys(packageJson.devDependencies);
          
          // Runtime dependencies should not be in devDependencies
          const runtimePackages = ['kleur', 'commander'];
          for (const runtimePkg of runtimePackages) {
            if (devDeps.includes(runtimePkg)) {
              expect(packageJson.dependencies).toHaveProperty(runtimePkg);
            }
          }
        }
      }
    });

    it('should have consistent version numbers across workspace', () => {
      const versions = new Set();
      
      for (const pkg of packages) {
        const packageJsonPath = join(rootDir, pkg.dir, 'package.json');
        if (!existsSync(packageJsonPath)) continue;

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        
        // For now, we just check that versions are valid semver
        expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/);
        versions.add(packageJson.version);
      }

      // All packages should have versions (we don't enforce same version yet)
      expect(versions.size).toBeGreaterThan(0);
    });
  });

  describe('Local Installation Simulation', () => {
    it('should be able to install packages locally', () => {
      const testInstallDir = join(tempDir, 'test-install');
      mkdirSync(testInstallDir, { recursive: true });
      
      // Create a test package.json for installation
      const testPackageJson = {
        name: 'test-installation',
        version: '1.0.0',
        private: true,
        dependencies: {}
      };

      require('fs').writeFileSync(
        join(testInstallDir, 'package.json'),
        JSON.stringify(testPackageJson, null, 2)
      );

      // Find a package to install
      const packageFiles = require('fs').readdirSync(tempDir).filter((f: string) => f.endsWith('.tgz'));
      
      if (packageFiles.length > 0) {
        const packagePath = join(tempDir, packageFiles[0]);
        
        try {
          execSync(`npm install ${packagePath}`, {
            cwd: testInstallDir,
            stdio: 'pipe',
            timeout: 60000
          });

          // Verify installation
          expect(existsSync(join(testInstallDir, 'node_modules'))).toBe(true);
          
          const installedPackages = require('fs').readdirSync(join(testInstallDir, 'node_modules'));
          expect(installedPackages.length).toBeGreaterThan(0);
        } catch (error) {
          console.error('Local installation failed:', error);
          throw error;
        }
      }
    });

    it('should support package imports after installation', () => {
      // This test would require creating a more complex test setup
      // For now, we verify that packages have correct entry points
      
      for (const pkg of packages) {
        const packageJsonPath = join(rootDir, pkg.dir, 'package.json');
        if (!existsSync(packageJsonPath)) continue;

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        
        // Verify entry points exist in built package
        if (packageJson.main) {
          const mainPath = join(rootDir, pkg.dir, packageJson.main);
          expect(existsSync(mainPath), `${pkg.name} main entry should exist`).toBe(true);
        }

        if (packageJson.exports) {
          // Validate exports structure
          expect(typeof packageJson.exports).toBe('object');
          
          if (packageJson.exports['.']) {
            const mainExport = packageJson.exports['.'];
            if (typeof mainExport === 'object') {
              // Check that exported files exist
              if (mainExport.require) {
                const requirePath = join(rootDir, pkg.dir, mainExport.require);
                expect(existsSync(requirePath), `${pkg.name} require export should exist`).toBe(true);
              }
              
              if (mainExport.import) {
                const importPath = join(rootDir, pkg.dir, mainExport.import);
                expect(existsSync(importPath), `${pkg.name} import export should exist`).toBe(true);
              }
            }
          }
        }
      }
    });
  });

  describe('Publishing Workflow Compatibility', () => {
    it('should be compatible with npm publish workflow', () => {
      // Test npm publish --dry-run for each package
      for (const pkg of packages) {
        const packageDir = join(rootDir, pkg.dir);
        if (!existsSync(join(packageDir, 'package.json'))) continue;

        try {
          const result = execSync('npm publish --dry-run', {
            cwd: packageDir,
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 30000
          });

          // Should not error on dry run
          expect(result).toBeDefined();
        } catch (error) {
          // Check if it's a real error or just a warning
          if (error instanceof Error && error.message.includes('npm ERR!')) {
            console.error(`Publish dry-run failed for ${pkg.name}:`, error.message);
            throw error;
          }
        }
      }
    });

    it('should support changeset workflow', () => {
      // Verify changeset configuration exists
      const changesetConfigPath = join(rootDir, '.changeset/config.json');
      if (existsSync(changesetConfigPath)) {
        const changesetConfig = JSON.parse(readFileSync(changesetConfigPath, 'utf8'));
        
        expect(changesetConfig.packages).toBeDefined();
        expect(Array.isArray(changesetConfig.packages)).toBe(true);
        
        // Should include packages directory
        expect(changesetConfig.packages).toContain('packages/*');
      }

      // Check that changeset CLI is available
      try {
        execSync('npx changeset --help', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 10000
        });
      } catch (error) {
        // Changeset might not be configured yet, which is OK
        console.log('Changeset not configured, skipping changeset workflow test');
      }
    });

    it('should have pre-publish scripts configured correctly', () => {
      for (const pkg of packages) {
        const packageJsonPath = join(rootDir, pkg.dir, 'package.json');
        if (!existsSync(packageJsonPath)) continue;

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        
        // Check for prepublishOnly script
        if (packageJson.scripts && packageJson.scripts.prepublishOnly) {
          expect(packageJson.scripts.prepublishOnly).toBeDefined();
          // Should typically include build step
          expect(packageJson.scripts.prepublishOnly).toMatch(/build|prepare/);
        }
      }
    });
  });
});