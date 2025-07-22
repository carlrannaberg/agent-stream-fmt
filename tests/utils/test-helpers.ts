import { vi } from 'vitest';

/**
 * Shared test utilities for Agent-IO monorepo
 */

/**
 * Creates a mock for console methods
 */
export function mockConsole() {
  const mocks = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
  };

  return {
    mocks,
    restore: () => {
      Object.values(mocks).forEach(mock => mock.mockRestore());
    },
  };
}

/**
 * Creates a readable stream from string data
 */
export function createReadableStream(data: string): NodeJS.ReadableStream {
  // Dynamic import for Node.js built-in
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Readable } = require('stream');
  return Readable.from(data);
}

/**
 * Collects all data from a readable stream
 */
export async function collectStream(
  stream: NodeJS.ReadableStream,
): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Creates a test fixture loader
 */
export function createFixtureLoader(basePath: string) {
  // Dynamic imports for Node.js built-ins
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync, existsSync } = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { join } = require('path');

  return {
    load: (relativePath: string): string => {
      const fullPath = join(basePath, relativePath);
      if (!existsSync(fullPath)) {
        throw new Error(`Fixture not found: ${fullPath}`);
      }
      return readFileSync(fullPath, 'utf-8');
    },
    loadJSON: <T = unknown>(relativePath: string): T => {
      const content = this.load(relativePath);
      return JSON.parse(content);
    },
    exists: (relativePath: string): boolean => {
      const fullPath = join(basePath, relativePath);
      return existsSync(fullPath);
    },
  };
}

/**
 * Waits for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Creates a test spy for async iterators
 */
export function spyAsyncIterator<T>(iterator: AsyncIterator<T>) {
  const values: T[] = [];
  const errors: Error[] = [];
  let done = false;

  return {
    values,
    errors,
    isDone: () => done,
    async *iterate() {
      try {
        for await (const value of { [Symbol.asyncIterator]: () => iterator }) {
          values.push(value);
          yield value;
        }
        done = true;
      } catch (error) {
        errors.push(error as Error);
        throw error;
      }
    },
  };
}

/**
 * Test utilities for benchmarking
 */
export const benchmark = {
  /**
   * Measures execution time of a function
   */
  async measure<T>(
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },

  /**
   * Runs a function multiple times and returns statistics
   */
  async profile(
    fn: () => unknown | Promise<unknown>,
    iterations: number = 100,
  ): Promise<{
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  }> {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { duration } = await this.measure(fn);
      durations.push(duration);
    }

    durations.sort((a, b) => a - b);

    const min = durations[0];
    const max = durations[durations.length - 1];
    const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];

    const variance =
      durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
      durations.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, mean, median, stdDev };
  },
};

/**
 * Memory usage utilities
 */
export const memory = {
  /**
   * Gets current memory usage
   */
  usage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  },

  /**
   * Formats memory usage in MB
   */
  format(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  },

  /**
   * Measures memory usage of a function
   */
  async measure<T>(fn: () => T | Promise<T>): Promise<{
    result: T;
    memoryDelta: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  }> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const before = this.usage();
    const result = await fn();
    const after = this.usage();

    return {
      result,
      memoryDelta: {
        rss: after.rss - before.rss,
        heapTotal: after.heapTotal - before.heapTotal,
        heapUsed: after.heapUsed - before.heapUsed,
      },
    };
  },
};
