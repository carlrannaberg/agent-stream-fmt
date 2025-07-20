import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Performance benchmarking utilities
 */

export interface BenchmarkResult {
  name: string;
  iterations: number;
  duration: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
  memory?: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
}

export class Benchmark {
  private results: BenchmarkResult[] = [];

  /**
   * Run a benchmark
   */
  async run(
    name: string,
    fn: () => unknown | Promise<unknown>,
    options: {
      iterations?: number;
      warmup?: number;
      measureMemory?: boolean;
    } = {}
  ): Promise<BenchmarkResult> {
    const { iterations = 1000, warmup = 10, measureMemory = false } = options;

    // Warmup runs
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // Force GC if available and measuring memory
    if (measureMemory && global.gc) {
      global.gc();
    }

    const memoryBefore = measureMemory ? process.memoryUsage() : undefined;
    const times: number[] = [];

    // Benchmark runs
    const totalStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    const totalEnd = performance.now();

    const memoryAfter = measureMemory ? process.memoryUsage() : undefined;

    // Calculate statistics
    const duration = totalEnd - totalStart;
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const opsPerSecond = 1000 / avgTime;

    const result: BenchmarkResult = {
      name,
      iterations,
      duration,
      avgTime,
      minTime,
      maxTime,
      opsPerSecond,
    };

    if (measureMemory && memoryBefore && memoryAfter) {
      result.memory = {
        before: memoryBefore,
        after: memoryAfter,
        delta: {
          rss: memoryAfter.rss - memoryBefore.rss,
          heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
          heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        },
      };
    }

    this.results.push(result);
    return result;
  }

  /**
   * Compare two benchmarks
   */
  async compare(
    benchmarks: Array<{
      name: string;
      fn: () => unknown | Promise<unknown>;
    }>,
    options?: Parameters<typeof this.run>[2]
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const { name, fn } of benchmarks) {
      const result = await this.run(name, fn, options);
      results.push(result);
      // eslint-disable-next-line no-console
      console.log(`${name}: ${result.opsPerSecond.toFixed(2)} ops/sec`);
    }

    // Find fastest
    const fastest = results.reduce((a, b) => 
      a.opsPerSecond > b.opsPerSecond ? a : b
    );

    // eslint-disable-next-line no-console
    console.log(`\nFastest: ${fastest.name}`);

    // Show relative performance
    for (const result of results) {
      if (result !== fastest) {
        const ratio = fastest.opsPerSecond / result.opsPerSecond;
        // eslint-disable-next-line no-console
        console.log(`${result.name} is ${ratio.toFixed(2)}x slower`);
      }
    }

    return results;
  }

  /**
   * Get all results
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }

  /**
   * Save results to file
   */
  saveResults(filepath: string): void {
    const dir = join(process.cwd(), 'reports');
    mkdirSync(dir, { recursive: true });
    
    const fullPath = join(dir, filepath);
    const content = this.generateReport();
    writeFileSync(fullPath, content);
    // eslint-disable-next-line no-console
    console.log(`Results saved to: ${fullPath}`);
  }

  /**
   * Generate markdown report
   */
  private generateReport(): string {
    const date = new Date().toISOString().split('T')[0];
    let report = `# Benchmark Results - ${date}\n\n`;

    for (const result of this.results) {
      report += `## ${result.name}\n\n`;
      report += `- **Iterations**: ${result.iterations.toLocaleString()}\n`;
      report += `- **Total Duration**: ${result.duration.toFixed(2)}ms\n`;
      report += `- **Average Time**: ${result.avgTime.toFixed(3)}ms\n`;
      report += `- **Min Time**: ${result.minTime.toFixed(3)}ms\n`;
      report += `- **Max Time**: ${result.maxTime.toFixed(3)}ms\n`;
      report += `- **Operations/sec**: ${result.opsPerSecond.toFixed(2)}\n`;

      if (result.memory) {
        report += `\n### Memory Usage\n`;
        report += `- **RSS Delta**: ${this.formatBytes(result.memory.delta.rss)}\n`;
        report += `- **Heap Total Delta**: ${this.formatBytes(result.memory.delta.heapTotal)}\n`;
        report += `- **Heap Used Delta**: ${this.formatBytes(result.memory.delta.heapUsed)}\n`;
      }

      report += '\n';
    }

    return report;
  }

  private formatBytes(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  }
}

/**
 * Create a benchmark suite
 */
export function suite(name: string): {
  add: (testName: string, fn: () => unknown | Promise<unknown>) => void;
  run: (options?: Parameters<Benchmark['run']>[2]) => Promise<void>;
} {
  const benchmark = new Benchmark();
  const tests: Array<{ name: string; fn: () => unknown | Promise<unknown> }> = [];

  return {
    add(testName: string, fn: () => unknown | Promise<unknown>) {
      tests.push({ name: `${name} - ${testName}`, fn });
    },
    async run(options) {
      // eslint-disable-next-line no-console
      console.log(`\nRunning benchmark suite: ${name}\n`);
      await benchmark.compare(tests, options);
      benchmark.saveResults(`BENCHMARK_${name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.md`);
    },
  };
}