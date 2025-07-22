#!/usr/bin/env tsx
/* eslint-disable no-console */
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';

interface TestCase {
  vendor: 'claude' | 'gemini' | 'amp';
  command: string[];
  output: string;
  description: string;
}

const TEST_CASES: TestCase[] = [
  // Claude Code test cases
  {
    vendor: 'claude',
    command: ['claude', '--json', 'write a hello world function'],
    output: 'basic-message.jsonl',
    description: 'Basic assistant message',
  },
  {
    vendor: 'claude',
    command: ['claude', '--json', 'run npm test and show results'],
    output: 'tool-use.jsonl',
    description: 'Tool execution with output',
  },
  {
    vendor: 'claude',
    command: [
      'claude',
      '--json',
      'create a React component with TypeScript and tests',
    ],
    output: 'complex-session.jsonl',
    description: 'Complex multi-step task',
  },
  {
    vendor: 'claude',
    command: [
      'claude',
      '--json',
      "explain this error: TypeError: Cannot read property 'x' of undefined",
    ],
    output: 'error-handling.jsonl',
    description: 'Error explanation',
  },

  // Gemini CLI test cases
  {
    vendor: 'gemini',
    command: ['gemini', '--jsonl', 'explain how recursion works'],
    output: 'basic-content.jsonl',
    description: 'Basic content generation',
  },
  {
    vendor: 'gemini',
    command: ['gemini', '--jsonl', 'write a sorting algorithm'],
    output: 'code-generation.jsonl',
    description: 'Code generation',
  },

  // Amp Code test cases
  {
    vendor: 'amp',
    command: ['amp-code', 'run', 'hello-world.yml', '-j'],
    output: 'simple-task.jsonl',
    description: 'Simple task execution',
  },
  {
    vendor: 'amp',
    command: ['amp-code', 'run', 'build-app.yml', '--output', 'jsonl'],
    output: 'build-process.jsonl',
    description: 'Build process',
  },
  {
    vendor: 'amp',
    command: ['amp-code', 'run', 'test-suite.yml', '-j'],
    output: 'test-execution.jsonl',
    description: 'Test execution',
  },
];

async function captureFixture(testCase: TestCase) {
  const outputPath = join('tests/fixtures', testCase.vendor, testCase.output);
  console.log(`Capturing ${testCase.vendor}: ${testCase.description}...`);

  try {
    const output = createWriteStream(outputPath);
    const proc = spawn(testCase.command[0], testCase.command.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.pipe(output);

    // Collect stderr for error reporting
    let errorOutput = '';
    proc.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    return new Promise((resolve, reject) => {
      proc.on('error', error => {
        // Handle missing CLI gracefully
        if (error.code === 'ENOENT') {
          console.warn(
            `⚠ ${testCase.vendor} CLI not found (${testCase.command[0]})`,
          );
          resolve(void 0);
        } else {
          reject(error);
        }
      });

      proc.on('exit', code => {
        if (code === 0) {
          console.log(`✓ Captured ${outputPath}`);
          resolve(void 0);
        } else {
          console.error(`✗ ${testCase.vendor} exited with code ${code}`);
          if (errorOutput) {
            console.error(`  Error output: ${errorOutput.trim()}`);
          }
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  } catch (error) {
    console.error(
      `✗ Failed to spawn process for ${testCase.vendor}: ${error.message}`,
    );
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting fixture capture...\n');

  // Ensure directories exist
  for (const vendor of ['claude', 'gemini', 'amp']) {
    mkdirSync(join('tests/fixtures', vendor), { recursive: true });
  }

  // Track results
  const results = {
    captured: 0,
    failed: 0,
    skipped: 0,
  };

  // Capture fixtures sequentially to avoid rate limits
  for (const testCase of TEST_CASES) {
    try {
      await captureFixture(testCase);
      results.captured++;
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      if (error.message.includes('CLI not found')) {
        results.skipped++;
      } else {
        results.failed++;
        console.error(`Failed to capture ${testCase.output}:`, error.message);
      }
    }
  }

  // Summary
  console.log('\n📊 Capture Summary:');
  console.log(`   ✓ Captured: ${results.captured}`);
  console.log(`   ✗ Failed: ${results.failed}`);
  console.log(`   ⚠ Skipped (CLI not found): ${results.skipped}`);
  console.log(`   Total: ${TEST_CASES.length}`);

  if (results.captured === 0) {
    console.log(
      '\n⚠️  No fixtures were captured. Please install at least one CLI:',
    );
    console.log('   - Claude: https://claude.ai/code');
    console.log('   - Gemini: npm install -g @google/generative-ai-cli');
    console.log('   - Amp: https://amp.dev/code');
  }
}

main().catch(console.error);
