import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Readable } from 'stream';

/**
 * Stream package fixtures for testing
 */

const FIXTURES_ROOT = __dirname;

/**
 * Common fixture data for testing
 */
export const fixtures = {
  // Claude JSONL fixtures
  claude: {
    basicMessage: () => loadFixture('claude/basic-message.jsonl'),
    complexSession: () => loadFixture('claude/complex-session.jsonl'),
    errorHandling: () => loadFixture('claude/error-handling.jsonl'),
    toolUse: () => loadFixture('claude/tool-use.jsonl'),
  },

  // Gemini TXT fixtures
  gemini: {
    basicContent: () => loadFixture('gemini/basic-content.txt'),
    codeGeneration: () => loadFixture('gemini/code-generation.txt'),
  },

  // Amp JSONL fixtures
  amp: {
    buildProcess: () => loadFixture('amp/build-process.jsonl'),
    simpleTask: () => loadFixture('amp/simple-task.jsonl'),
    testExecution: () => loadFixture('amp/test-execution.jsonl'),
  },

  // Sample data for unit testing
  samples: {
    // Simple agent events
    events: {
      message: { t: 'msg', role: 'assistant', text: 'Hello, world!' },
      tool: { t: 'tool', name: 'bash', phase: 'start' },
      cost: { t: 'cost', deltaUsd: 0.0025 },
      error: { t: 'error', message: 'Something went wrong' },
    },

    // JSONL lines
    jsonl: {
      valid: '{"type":"message","content":"Hello"}',
      invalid: '{invalid json}',
      empty: '',
      partial: '{"type":"message"',
    },

    // Stream data
    streams: {
      simple: 'line1\nline2\nline3\n',
      mixed: 'line1\r\nline2\rline3\n',
      large: Array(1000).fill('x').join('').repeat(100),
    },
  },
};

/**
 * Loads a fixture file
 */
function loadFixture(relativePath: string): string {
  const fullPath = join(FIXTURES_ROOT, relativePath);
  return readFileSync(fullPath, 'utf-8');
}

/**
 * Lists all fixture files
 */
export function listFixtures(subdir?: string): string[] {
  const baseDir = subdir ? join(FIXTURES_ROOT, subdir) : FIXTURES_ROOT;
  const files: string[] = [];

  function walk(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory() && entry !== 'node_modules') {
        walk(fullPath);
      } else if (stat.isFile() && entry.endsWith('.jsonl')) {
        files.push(relative(FIXTURES_ROOT, fullPath));
      }
    }
  }

  walk(baseDir);
  return files;
}

/**
 * Creates a fixture from a string
 */
export function createFixture(content: string): {
  asStream: () => NodeJS.ReadableStream;
  asLines: () => string[];
  asBuffer: () => Buffer;
} {
  return {
    asStream: () => {
      return Readable.from(content);
    },
    asLines: () => content.split('\n').filter(line => line.length > 0),
    asBuffer: () => Buffer.from(content, 'utf-8'),
  };
}

/**
 * Generates synthetic test data
 */
export const generate = {
  /**
   * Generates JSONL lines
   */
  jsonlLines(count: number, template?: Record<string, unknown>): string[] {
    const lines: string[] = [];
    for (let i = 0; i < count; i++) {
      const data = template
        ? { ...template, index: i }
        : { index: i, message: `Line ${i}` };
      lines.push(JSON.stringify(data));
    }
    return lines;
  },

  /**
   * Generates agent events
   */
  agentEvents(count: number): unknown[] {
    const events: unknown[] = [];
    const types = ['msg', 'tool', 'cost', 'error'];

    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      switch (type) {
        case 'msg':
          events.push({ t: 'msg', role: 'assistant', text: `Message ${i}` });
          break;
        case 'tool':
          events.push({ t: 'tool', name: `tool${i}`, phase: 'start' });
          break;
        case 'cost':
          events.push({ t: 'cost', deltaUsd: 0.001 * i });
          break;
        case 'error':
          events.push({ t: 'error', message: `Error ${i}` });
          break;
      }
    }

    return events;
  },

  /**
   * Generates a large JSONL file content
   */
  largeJsonl(mb: number): string {
    const targetBytes = mb * 1024 * 1024;
    const lines: string[] = [];
    let totalSize = 0;
    let index = 0;

    while (totalSize < targetBytes) {
      const line = JSON.stringify({
        index,
        timestamp: new Date().toISOString(),
        message: `Test message ${index}`,
        data: Array(100).fill('x').join(''),
      });
      lines.push(line);
      totalSize += line.length + 1; // +1 for newline
      index++;
    }

    return lines.join('\n');
  },
};
