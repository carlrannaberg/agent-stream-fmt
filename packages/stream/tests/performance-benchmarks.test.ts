/* eslint-disable no-console */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { detectVendor, selectParser } from '../src/parsers/index.js';
// import { ClaudeParser } from '../src/parsers/claude.js';

/**
 * Performance benchmark tests targeting >1000 lines/sec
 * Tests parser efficiency and memory usage
 */
describe('Performance Benchmark Tests', () => {
  const fixturesDir = join(process.cwd(), 'tests/fixtures');
  const PERFORMANCE_TARGET = 1000; // lines per second
  const MEMORY_LIMIT = 100 * 1024 * 1024; // 100MB

  // Sample test data for benchmarks
  const sampleDataByVendor = {
    claude: [
      JSON.stringify({ type: 'message', role: 'user', content: 'Hello world' }),
      JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      }),
      JSON.stringify({
        type: 'tool_use',
        id: 'tool_123',
        name: 'bash',
        input: { command: 'ls -la' },
      }),
      JSON.stringify({
        type: 'tool_result',
        tool_use_id: 'tool_123',
        content: 'stdout',
        output: 'total 0\ndrwxr-xr-x 1 user user 0 Jan 1 12:00 .',
      }),
      JSON.stringify({
        type: 'usage',
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      }),
      JSON.stringify({ type: 'error', message: 'Something went wrong' }),
    ],
    gemini: [
      JSON.stringify({ type: 'user', content: 'Hello world' }),
      JSON.stringify({
        type: 'assistant',
        content: 'Hello! How can I help you today?',
      }),
      JSON.stringify({
        type: 'metadata',
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      }),
    ],
    amp: [
      JSON.stringify({
        phase: 'start',
        task: 'test',
        timestamp: '2024-01-01T10:00:00Z',
      }),
      JSON.stringify({
        phase: 'output',
        task: 'test',
        type: 'stdout',
        content: 'Running test...',
      }),
      JSON.stringify({
        phase: 'output',
        task: 'test',
        type: 'stderr',
        content: 'Warning: test',
      }),
      JSON.stringify({
        phase: 'end',
        task: 'test',
        timestamp: '2024-01-01T10:00:30Z',
        exitCode: 0,
      }),
    ],
  };

  function generateTestData(
    lineCount: number,
    vendor: 'claude' | 'gemini' | 'amp' = 'claude',
  ): string[] {
    const lines: string[] = [];
    const sampleMessages = sampleDataByVendor[vendor];
    for (let i = 0; i < lineCount; i++) {
      lines.push(sampleMessages[i % sampleMessages.length]);
    }
    return lines;
  }

  // Unused function - commenting out to fix linting
  /*
  function measurePerformance(operation: () => void, _description: string): {
    duration: number;
    operationsPerSecond: number;
    memoryUsage: NodeJS.MemoryUsage;
  } {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const initialMemory = process.memoryUsage();
    const startTime = performance.now();
    
    operation();
    
    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    
    const duration = endTime - startTime;
    const operationsPerSecond = (1000 / duration) * 1000; // Assuming 1000 operations
    
    return {
      duration,
      operationsPerSecond,
      memoryUsage: {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
        external: finalMemory.external - initialMemory.external,
        arrayBuffers: finalMemory.arrayBuffers - initialMemory.arrayBuffers,
      }
    };
  }
  */

  describe('Parser Performance Benchmarks', () => {
    it('parses 1000 lines within performance target for all vendors', () => {
      const vendors = ['claude', 'gemini', 'amp'] as const;

      for (const vendor of vendors) {
        const testData = generateTestData(1000, vendor);
        const parser = selectParser(vendor);

        const startTime = performance.now();

        for (const line of testData) {
          parser.parse(line);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const linesPerSecond = (testData.length / duration) * 1000;

        console.log(
          `${vendor} parser performance: ${linesPerSecond.toFixed(2)} lines/sec`,
        );

        expect(
          linesPerSecond,
          `${vendor} parser should process at least ${PERFORMANCE_TARGET} lines/sec, got ${linesPerSecond.toFixed(2)}`,
        ).toBeGreaterThan(PERFORMANCE_TARGET);
      }
    });

    it('parses 10000 lines efficiently for all vendors', () => {
      const vendors = ['claude', 'gemini', 'amp'] as const;

      for (const vendor of vendors) {
        const testData = generateTestData(10000, vendor);
        const parser = selectParser(vendor);

        const startTime = performance.now();
        let totalEvents = 0;

        for (const line of testData) {
          const events = parser.parse(line);
          totalEvents += events.length;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const linesPerSecond = (testData.length / duration) * 1000;

        console.log(
          `${vendor} large dataset performance: ${linesPerSecond.toFixed(2)} lines/sec`,
        );
        console.log(`${vendor} total events generated: ${totalEvents}`);

        expect(
          linesPerSecond,
          `${vendor} parser should maintain performance with large datasets`,
        ).toBeGreaterThan(PERFORMANCE_TARGET);

        expect(
          totalEvents,
          `${vendor} should generate events for all lines`,
        ).toBeGreaterThan(0);
      }
    });

    it('handles mixed event types efficiently for all vendors', () => {
      const vendors = ['claude', 'gemini', 'amp'] as const;

      for (const vendor of vendors) {
        const mixedData = generateTestData(1000, vendor);

        const parser = selectParser(vendor);
        const startTime = performance.now();

        for (const line of mixedData) {
          parser.parse(line);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const linesPerSecond = (mixedData.length / duration) * 1000;

        console.log(
          `${vendor} mixed event types performance: ${linesPerSecond.toFixed(2)} lines/sec`,
        );

        expect(
          linesPerSecond,
          `${vendor} parser should handle mixed event types efficiently`,
        ).toBeGreaterThan(PERFORMANCE_TARGET);
      }
    });

    it('scales linearly with input size for all vendors', () => {
      const vendors = ['claude', 'gemini', 'amp'] as const;
      const testSizes = [100, 500, 1000, 5000];

      for (const vendor of vendors) {
        const parser = selectParser(vendor);
        const results: { size: number; linesPerSecond: number }[] = [];

        for (const size of testSizes) {
          const testData = generateTestData(size, vendor);
          const startTime = performance.now();

          for (const line of testData) {
            parser.parse(line);
          }

          const endTime = performance.now();
          const duration = endTime - startTime;
          const linesPerSecond = (size / duration) * 1000;

          results.push({ size, linesPerSecond });
        }

        console.log(`${vendor} scaling results:`);
        results.forEach(({ size, linesPerSecond }) => {
          console.log(
            `  ${size} lines: ${linesPerSecond.toFixed(2)} lines/sec`,
          );
        });

        // All sizes should meet performance target
        for (const { size, linesPerSecond } of results) {
          expect(
            linesPerSecond,
            `${vendor} ${size} lines should meet performance target`,
          ).toBeGreaterThan(PERFORMANCE_TARGET);
        }

        // Performance should not degrade significantly with size
        const maxPerformance = Math.max(...results.map(r => r.linesPerSecond));
        const minPerformance = Math.min(...results.map(r => r.linesPerSecond));
        const performanceRatio = maxPerformance / minPerformance;

        expect(
          performanceRatio,
          `${vendor} performance should not degrade significantly with size (ratio: ${performanceRatio.toFixed(2)})`,
        ).toBeLessThan(3); // Allow up to 3x variation
      }
    });
  });

  describe('Detection Performance Benchmarks', () => {
    it('detects vendor efficiently for large datasets', () => {
      const testData = generateTestData(5000);

      const startTime = performance.now();
      let detectedCount = 0;

      for (const line of testData) {
        const detected = detectVendor(line);
        if (detected) {
          detectedCount++;
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const detectionsPerSecond = (testData.length / duration) * 1000;

      console.log(
        `Detection performance: ${detectionsPerSecond.toFixed(2)} detections/sec`,
      );
      console.log(
        `Detection success rate: ${((detectedCount / testData.length) * 100).toFixed(1)}%`,
      );

      expect(detectionsPerSecond, `Detection should be fast`).toBeGreaterThan(
        PERFORMANCE_TARGET * 2,
      ); // Detection should be faster than parsing

      expect(detectedCount, 'Should detect all Claude format lines').toBe(
        testData.length,
      );
    });

    it('handles detection failures efficiently', () => {
      const invalidFormats = [
        '{"event":"data"}',
        '{"unknown":"format"}',
        'not json',
        '{"malformed":}',
        '{"empty":""}',
      ];

      const testData = Array(1000)
        .fill(null)
        .map((_, i) => invalidFormats[i % invalidFormats.length]);

      const startTime = performance.now();
      let nullResults = 0;

      for (const line of testData) {
        const detected = detectVendor(line);
        if (detected === null) {
          nullResults++;
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const detectionsPerSecond = (testData.length / duration) * 1000;

      console.log(
        `Failed detection performance: ${detectionsPerSecond.toFixed(2)} detections/sec`,
      );

      expect(
        detectionsPerSecond,
        `Detection failures should be handled efficiently`,
      ).toBeGreaterThan(PERFORMANCE_TARGET * 5); // Should be very fast for failures

      expect(nullResults, 'Should fail to detect all invalid formats').toBe(
        testData.length,
      );
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('maintains reasonable memory usage during parsing', () => {
      const testData = generateTestData(10000);
      const parser = selectParser('claude');

      const initialMemory = process.memoryUsage();
      const events: any[] = [];

      for (const line of testData) {
        events.push(...parser.parse(line));
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(
        `Memory usage: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(`Events generated: ${events.length}`);
      console.log(
        `Memory per event: ${(memoryIncrease / events.length).toFixed(2)} bytes`,
      );

      expect(
        memoryIncrease,
        `Memory usage should be reasonable (${(memoryIncrease / 1024 / 1024).toFixed(2)} MB)`,
      ).toBeLessThan(MEMORY_LIMIT);
    });

    it('does not leak memory during repeated parsing', () => {
      const testLine = JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: 'test',
      });
      const parser = selectParser('claude');

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Parse the same line many times
      for (let i = 0; i < 10000; i++) {
        parser.parse(testLine);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(
        `Memory leak test: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB increase`,
      );

      // Should not significantly increase memory
      expect(
        memoryIncrease,
        `Should not leak memory (${(memoryIncrease / 1024 / 1024).toFixed(2)} MB increase)`,
      ).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
    });
  });

  describe('Real Fixture Performance', () => {
    it('processes Claude fixtures efficiently', () => {
      const claudeDir = join(fixturesDir, 'claude');
      if (!existsSync(claudeDir)) {
        console.warn('Claude fixtures not found, skipping performance test');
        return;
      }

      const fixtureFiles = [
        'basic-message.jsonl',
        'tool-use.jsonl',
        'complex-session.jsonl',
      ].filter(file => existsSync(join(claudeDir, file)));

      if (fixtureFiles.length === 0) {
        console.warn(
          'No Claude fixture files found, skipping performance test',
        );
        return;
      }

      const parser = selectParser('claude');
      let totalLines = 0;
      let totalEvents = 0;

      const startTime = performance.now();

      for (const filename of fixtureFiles) {
        const filepath = join(claudeDir, filename);
        const content = readFileSync(filepath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const events = parser.parse(line);
            totalEvents += events.length;
            totalLines++;
          } catch (error) {
            // Skip malformed lines (expected in error fixtures)
            continue;
          }
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const linesPerSecond = (totalLines / duration) * 1000;

      console.log(`Real fixture performance:`);
      console.log(`  Files processed: ${fixtureFiles.length}`);
      console.log(`  Lines processed: ${totalLines}`);
      console.log(`  Events generated: ${totalEvents}`);
      console.log(`  Performance: ${linesPerSecond.toFixed(2)} lines/sec`);
      console.log(`  Duration: ${duration.toFixed(2)}ms`);

      expect(
        linesPerSecond,
        `Real fixture processing should meet performance target`,
      ).toBeGreaterThan(PERFORMANCE_TARGET);
    });
  });

  describe('Concurrent Processing', () => {
    it('handles concurrent parsing efficiently', async () => {
      const testData = generateTestData(100);
      const parser = selectParser('claude');

      const startTime = performance.now();

      // Create concurrent parsing tasks
      const tasks = Array(10)
        .fill(null)
        .map(async () => {
          const results = [];
          for (const line of testData) {
            results.push(parser.parse(line));
          }
          return results;
        });

      const results = await Promise.all(tasks);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const totalLines = testData.length * tasks.length;
      const linesPerSecond = (totalLines / duration) * 1000;

      console.log(
        `Concurrent processing performance: ${linesPerSecond.toFixed(2)} lines/sec`,
      );
      console.log(`Concurrent tasks: ${tasks.length}`);
      console.log(`Total lines: ${totalLines}`);

      expect(
        linesPerSecond,
        `Concurrent processing should be efficient`,
      ).toBeGreaterThan(PERFORMANCE_TARGET);

      // Verify all tasks completed successfully
      expect(results.length).toBe(tasks.length);
      results.forEach((taskResults, index) => {
        expect(
          taskResults.length,
          `Task ${index} should process all lines`,
        ).toBe(testData.length);
      });
    });
  });

  describe('Performance Regression Tests', () => {
    it('maintains performance across different input patterns', () => {
      const patterns = [
        // Short messages
        () => JSON.stringify({ type: 'message', role: 'user', content: 'Hi' }),
        // Long messages
        () =>
          JSON.stringify({
            type: 'message',
            role: 'assistant',
            content: 'x'.repeat(1000),
          }),
        // Tool use
        () =>
          JSON.stringify({
            type: 'tool_use',
            id: 'tool_123',
            name: 'bash',
            input: { command: 'echo test' },
          }),
        // Complex tool results
        () =>
          JSON.stringify({
            type: 'tool_result',
            tool_use_id: 'tool_123',
            content: 'stdout',
            output: 'line1\nline2\nline3',
          }),
        // Usage events
        () =>
          JSON.stringify({
            type: 'usage',
            input_tokens: 100,
            output_tokens: 200,
          }),
        // Unicode content
        () =>
          JSON.stringify({
            type: 'message',
            role: 'assistant',
            content: 'Hello 👋 世界',
          }),
      ];

      const parser = selectParser('claude');
      const results: { pattern: string; linesPerSecond: number }[] = [];

      for (const [index, pattern] of patterns.entries()) {
        const testData = Array(1000)
          .fill(null)
          .map(() => pattern());

        const startTime = performance.now();

        for (const line of testData) {
          parser.parse(line);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const linesPerSecond = (testData.length / duration) * 1000;

        results.push({ pattern: `Pattern ${index + 1}`, linesPerSecond });
      }

      console.log('Pattern performance results:');
      results.forEach(({ pattern, linesPerSecond }) => {
        console.log(`  ${pattern}: ${linesPerSecond.toFixed(2)} lines/sec`);
      });

      // All patterns should meet performance target
      for (const { pattern, linesPerSecond } of results) {
        expect(
          linesPerSecond,
          `${pattern} should meet performance target`,
        ).toBeGreaterThan(PERFORMANCE_TARGET);
      }
    });
  });
});
