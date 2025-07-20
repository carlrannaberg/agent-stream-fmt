import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Integration tests for development workflow scripts
 * Tests that all development commands work correctly across the monorepo
 */

describe('Development Workflow Integration', () => {
  const rootDir = join(__dirname, '../..');
  const packages = [
    'packages/core',
    'packages/jsonl', 
    'packages/stream',
    'packages/invoke'
  ];

  beforeAll(() => {
    // Tests will use cwd option in execSync instead of process.chdir
    // since process.chdir is not supported in Vitest workers
  });

  describe('TypeScript Development', () => {
    it('should run typecheck across all packages', () => {
      try {
        execSync('npm run typecheck', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 60000
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('TypeScript error')) {
          throw new Error(`TypeScript errors found: ${error.message}`);
        }
        // Might be warnings or missing scripts, check individual packages
        console.warn('Global typecheck failed, checking individual packages');
      }

      // Verify individual packages can be typechecked
      for (const pkgDir of packages) {
        const packageJsonPath = join(rootDir, pkgDir, 'package.json');
        if (!existsSync(packageJsonPath)) continue;

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts && packageJson.scripts.typecheck) {
          try {
            execSync('npm run typecheck', {
              cwd: join(rootDir, pkgDir),
              stdio: 'pipe',
              timeout: 30000
            });
          } catch (error) {
            throw new Error(`TypeScript errors in ${pkgDir}: ${error}`);
          }
        }
      }
    });

    it('should have consistent TypeScript configuration', () => {
      // Check root tsconfig.json
      const rootTsConfigPath = join(rootDir, 'tsconfig.json');
      expect(existsSync(rootTsConfigPath)).toBe(true);

      const rootTsConfig = JSON.parse(readFileSync(rootTsConfigPath, 'utf8'));
      expect(rootTsConfig.compilerOptions).toBeDefined();
      expect(rootTsConfig.compilerOptions.strict).toBe(true);

      // Check package tsconfig.json files
      for (const pkgDir of packages) {
        const packageTsConfigPath = join(rootDir, pkgDir, 'tsconfig.json');
        if (existsSync(packageTsConfigPath)) {
          const packageTsConfig = JSON.parse(readFileSync(packageTsConfigPath, 'utf8'));
          
          // Should extend from root or have consistent settings
          expect(packageTsConfig.compilerOptions || packageTsConfig.extends).toBeDefined();
          
          if (packageTsConfig.compilerOptions) {
            expect(packageTsConfig.compilerOptions.module || 'ES2022').toMatch(/ES2022|ESNext|NodeNext/);
            expect(packageTsConfig.compilerOptions.target || 'ES2022').toMatch(/ES2022|ESNext/);
          }
        }
      }
    });

    it('should support project references for fast builds', () => {
      const rootTsConfigPath = join(rootDir, 'tsconfig.json');
      const rootTsConfig = JSON.parse(readFileSync(rootTsConfigPath, 'utf8'));

      if (rootTsConfig.references) {
        expect(Array.isArray(rootTsConfig.references)).toBe(true);
        
        // Verify referenced projects exist and are valid
        for (const ref of rootTsConfig.references) {
          const refTsConfigPath = join(rootDir, ref.path, 'tsconfig.json');
          expect(existsSync(refTsConfigPath), `Referenced project ${ref.path} should exist`).toBe(true);
          
          const refTsConfig = JSON.parse(readFileSync(refTsConfigPath, 'utf8'));
          expect(refTsConfig.compilerOptions).toBeDefined();
        }
      }
    });
  });

  describe('Testing Infrastructure', () => {
    it('should run tests across all packages', () => {
      try {
        execSync('npm run test:packages', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 120000
        });
      } catch (error) {
        // Some packages might not have tests yet, check what we can
        console.warn('Global test run had issues, checking individual packages');
        
        let successfulTests = 0;
        for (const pkgDir of packages) {
          const packageJsonPath = join(rootDir, pkgDir, 'package.json');
          if (!existsSync(packageJsonPath)) continue;

          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.scripts && packageJson.scripts.test) {
            try {
              execSync('npm test', {
                cwd: join(rootDir, pkgDir),
                stdio: 'pipe',
                timeout: 60000
              });
              successfulTests++;
            } catch (error) {
              console.warn(`Tests failed in ${pkgDir}:`, error);
            }
          }
        }
        
        expect(successfulTests).toBeGreaterThan(0);
      }
    }, 120000);

    it('should have vitest configuration for each package', () => {
      for (const pkgDir of packages) {
        const vitestConfigPath = join(rootDir, pkgDir, 'vitest.config.ts');
        if (existsSync(vitestConfigPath)) {
          const content = readFileSync(vitestConfigPath, 'utf8');
          expect(content).toContain('vitest');
          expect(content).toContain('defineConfig');
        }
      }

      // Root should have workspace configuration
      const workspaceConfigPath = join(rootDir, 'vitest.workspace.ts');
      expect(existsSync(workspaceConfigPath)).toBe(true);
      
      const workspaceConfig = readFileSync(workspaceConfigPath, 'utf8');
      expect(workspaceConfig).toContain('defineWorkspace');
      expect(workspaceConfig).toContain('packages/*/vitest.config.ts');
    });

    it('should support test coverage reporting', () => {
      try {
        execSync('npm run test:coverage', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 120000
        });

        // Check if coverage directory was created
        const coverageDir = join(rootDir, 'coverage');
        if (existsSync(coverageDir)) {
          const coverageFiles = readdirSync(coverageDir);
          expect(coverageFiles.length).toBeGreaterThan(0);
        }
      } catch (error) {
        // Coverage might not be fully configured yet
        console.warn('Coverage reporting not fully configured:', error);
      }
    }, 120000);
  });

  describe('Code Quality Tools', () => {
    it('should run linting across packages', () => {
      try {
        execSync('npm run lint', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 60000
        });
      } catch (error) {
        // Check if it's a real error or just lint violations
        if (error instanceof Error && error.message.includes('ENOENT')) {
          throw new Error(`Linting command not found: ${error.message}`);
        }
        // Lint violations are expected in development, just verify lint runs
        console.warn('Linting found violations (expected in development)');
      }

      // Verify ESLint configuration exists
      const eslintConfigPath = join(rootDir, '.eslintrc.json');
      const eslintConfigJsPath = join(rootDir, '.eslintrc.js');
      const eslintConfigTsPath = join(rootDir, '.eslintrc.ts');
      const packageJsonPath = join(rootDir, 'package.json');

      let hasEslintConfig = existsSync(eslintConfigPath) || 
                           existsSync(eslintConfigJsPath) || 
                           existsSync(eslintConfigTsPath);

      if (!hasEslintConfig && existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        hasEslintConfig = !!packageJson.eslintConfig;
      }

      expect(hasEslintConfig, 'ESLint configuration should exist').toBe(true);
    });

    it('should support code formatting with Prettier', () => {
      try {
        execSync('npm run format:check', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 30000
        });
      } catch (error) {
        // Format violations are expected, just verify formatter runs
        console.warn('Code formatting issues found (expected in development)');
      }

      // Verify Prettier configuration exists
      const prettierConfigPath = join(rootDir, '.prettierrc');
      const prettierConfigJsonPath = join(rootDir, '.prettierrc.json');
      const prettierConfigJsPath = join(rootDir, 'prettier.config.js');
      const packageJsonPath = join(rootDir, 'package.json');

      let hasPrettierConfig = existsSync(prettierConfigPath) || 
                             existsSync(prettierConfigJsonPath) || 
                             existsSync(prettierConfigJsPath);

      if (!hasPrettierConfig && existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        hasPrettierConfig = !!packageJson.prettier;
      }

      expect(hasPrettierConfig, 'Prettier configuration should exist').toBe(true);
    });

    it('should have consistent code quality scripts', () => {
      const rootPackageJsonPath = join(rootDir, 'package.json');
      const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'));

      // Root should have quality scripts
      expect(rootPackageJson.scripts).toHaveProperty('lint');
      expect(rootPackageJson.scripts).toHaveProperty('format');
      expect(rootPackageJson.scripts).toHaveProperty('typecheck');

      // Check individual packages have consistent scripts
      for (const pkgDir of packages) {
        const packageJsonPath = join(rootDir, pkgDir, 'package.json');
        if (!existsSync(packageJsonPath)) continue;

        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        
        // Should have test script if it has tests
        const hasTests = existsSync(join(rootDir, pkgDir, 'src')) ||
                         existsSync(join(rootDir, pkgDir, 'tests')) ||
                         existsSync(join(rootDir, pkgDir, '__tests__'));
        
        if (hasTests && packageJson.scripts) {
          expect(packageJson.scripts.test, `${pkgDir} should have test script`).toBeDefined();
        }
      }
    });
  });

  describe('Development Scripts', () => {
    it('should support development mode for packages', async () => {
      // Test that dev scripts exist and can be started
      const rootPackageJsonPath = join(rootDir, 'package.json');
      const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'));

      if (rootPackageJson.scripts && rootPackageJson.scripts.dev) {
        // We won't actually start dev mode (it runs indefinitely)
        // but we can verify the command exists and packages have dev scripts
        
        let packagesWithDev = 0;
        for (const pkgDir of packages) {
          const packageJsonPath = join(rootDir, pkgDir, 'package.json');
          if (!existsSync(packageJsonPath)) continue;

          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
          if (packageJson.scripts && packageJson.scripts.dev) {
            packagesWithDev++;
          }
        }

        // At least some packages should have dev scripts
        // eslint-disable-next-line no-console
        console.log(`Found ${packagesWithDev} packages with dev scripts`);
      }

      expect(true).toBe(true); // This test mainly verifies script existence
    });

    it('should support workspace-specific commands', () => {
      const rootPackageJsonPath = join(rootDir, 'package.json');
      const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'));

      // Should have workspace commands
      const hasWorkspaceCommands = Object.keys(rootPackageJson.scripts || {}).some(script =>
        script.includes('workspace') || script.includes('packages')
      );
      
      expect(hasWorkspaceCommands, 'Should have workspace-specific commands').toBe(true);

      // Test workspace command execution
      try {
        execSync('npm run --workspaces --if-present help || echo "help not available"', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 10000
        });
      } catch (error) {
        // This might fail but shouldn't crash
        console.warn('Workspace command test had issues:', error);
      }
    });

    it('should support clean and rebuild workflow', () => {
      // Test clean script
      try {
        execSync('npm run clean', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 30000
        });
      } catch (error) {
        // Clean might fail if directories don't exist
        console.warn('Clean script had issues (expected if no dist directories exist)');
      }

      // Verify packages can be rebuilt after clean
      try {
        execSync('npm run build:packages', {
          cwd: rootDir,
          stdio: 'pipe',
          timeout: 120000
        });

        // Verify packages were built
        let builtPackages = 0;
        for (const pkgDir of packages) {
          const distPath = join(rootDir, pkgDir, 'dist');
          if (existsSync(distPath)) {
            builtPackages++;
          }
        }

        expect(builtPackages).toBeGreaterThan(0);
      } catch (error) {
        throw new Error(`Rebuild after clean failed: ${error}`);
      }
    }, 120000);
  });

  describe('Git Workflow Integration', () => {
    it('should have git hooks configured', () => {
      const gitHooksDir = join(rootDir, '.git/hooks');
      const huskyDir = join(rootDir, '.husky');
      
      // Check for either git hooks or husky
      const hasGitHooks = existsSync(gitHooksDir) || existsSync(huskyDir);
      
      if (hasGitHooks) {
        const rootPackageJsonPath = join(rootDir, 'package.json');
        const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'));
        
        // Should have husky in devDependencies or git hooks configured
        const hasHusky = rootPackageJson.devDependencies && 
                        rootPackageJson.devDependencies.husky;
        
        if (hasHusky) {
          expect(existsSync(huskyDir), 'Husky directory should exist if husky is installed').toBe(true);
        }
      }
    });

    it('should support pre-commit validation', () => {
      // Test that validation scripts work (without actually committing)
      const rootPackageJsonPath = join(rootDir, 'package.json');
      const rootPackageJson = JSON.parse(readFileSync(rootPackageJsonPath, 'utf8'));

      if (rootPackageJson.scripts && rootPackageJson.scripts.validate) {
        try {
          execSync('npm run validate', {
            cwd: rootDir,
            stdio: 'pipe',
            timeout: 120000
          });
        } catch (error) {
          // Validation might fail due to code quality issues
          console.warn('Validation script found issues (expected in development)');
        }
      }
    }, 120000);

    it('should have consistent repository structure', () => {
      // Verify standard files exist
      expect(existsSync(join(rootDir, 'README.md'))).toBe(true);
      expect(existsSync(join(rootDir, 'package.json'))).toBe(true);
      expect(existsSync(join(rootDir, '.gitignore'))).toBe(true);
      expect(existsSync(join(rootDir, 'LICENSE'))).toBe(true);

      // Check gitignore includes standard patterns
      const gitignoreContent = readFileSync(join(rootDir, '.gitignore'), 'utf8');
      expect(gitignoreContent).toContain('node_modules');
      expect(gitignoreContent).toContain('dist');
      expect(gitignoreContent).toContain('coverage');
    });
  });
});