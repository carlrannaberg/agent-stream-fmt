#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

function runCommand(command: string, args: string[] = []): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const proc = spawn(command, args, { stdio: 'pipe' });
    
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        name: `${command} ${args.join(' ')}`,
        passed: code === 0,
        duration,
        output,
        error: error || undefined
      });
    });
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printTestResult(result: TestResult): void {
  const status = result.passed 
    ? `${colors.green}✓ PASSED${colors.reset}`
    : `${colors.red}✗ FAILED${colors.reset}`;
  
  console.log(`${status} ${result.name} (${formatDuration(result.duration)})`);
  
  if (!result.passed && result.error) {
    console.log(`${colors.red}Error:${colors.reset}`);
    console.log(result.error.split('\n').map(line => `  ${line}`).join('\n'));
  }
}

function printSummary(results: TestResult[]): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\n${colors.bold}${colors.cyan}Test Suite Summary${colors.reset}`);
  console.log(`${colors.bold}════════════════════════════════════════${colors.reset}`);
  console.log(`Total tests: ${total}`);
  console.log(`Passed: ${colors.green}${passed}${colors.reset}`);
  console.log(`Failed: ${colors.red}${failed}${colors.reset}`);
  console.log(`Duration: ${formatDuration(totalDuration)}`);
  
  if (failed > 0) {
    console.log(`\n${colors.red}${colors.bold}Failed Tests:${colors.reset}`);
    results.filter(r => !r.passed).forEach(result => {
      console.log(`  ${colors.red}✗${colors.reset} ${result.name}`);
    });
  }
  
  const successRate = (passed / total) * 100;
  const status = failed === 0 
    ? `${colors.green}${colors.bold}ALL TESTS PASSED!${colors.reset}`
    : `${colors.red}${colors.bold}${failed} TEST${failed > 1 ? 'S' : ''} FAILED${colors.reset}`;
  
  console.log(`\n${status}`);
  console.log(`Success rate: ${successRate.toFixed(1)}%`);
}

async function main(): Promise<void> {
  console.log(`${colors.bold}${colors.cyan}🧪 Running Comprehensive Test Suite${colors.reset}`);
  console.log(`${colors.dim}Testing Phase 1 components against all fixtures${colors.reset}\n`);
  
  const testSuites = [
    {
      name: 'Unit Tests',
      command: 'npm',
      args: ['test', '--', '--run', 'src/']
    },
    {
      name: 'Fixture Validation',
      command: 'npm',
      args: ['run', 'fixtures:validate']
    },
    {
      name: 'Integration Tests',
      command: 'npm',
      args: ['run', 'test:integration']
    },
    {
      name: 'Error Handling Tests',
      command: 'npm',
      args: ['run', 'test:errors']
    },
    {
      name: 'Performance Benchmarks',
      command: 'npm',
      args: ['run', 'test:performance']
    },
    {
      name: 'Comprehensive Validation',
      command: 'npm',
      args: ['run', 'validate:comprehensive']
    }
  ];
  
  const results: TestResult[] = [];
  
  for (const suite of testSuites) {
    console.log(`${colors.dim}Running ${suite.name}...${colors.reset}`);
    
    const result = await runCommand(suite.command, suite.args);
    result.name = suite.name;
    
    printTestResult(result);
    results.push(result);
    
    console.log(''); // Empty line between tests
  }
  
  printSummary(results);
  
  // Exit with appropriate code
  const failed = results.filter(r => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

// Check if this is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(`${colors.red}Error running test suite:${colors.reset}`, error);
    process.exit(1);
  });
}
