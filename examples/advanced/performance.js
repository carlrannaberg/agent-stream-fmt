#!/usr/bin/env node

/**
 * Performance Optimization Examples
 *
 * This example demonstrates performance optimization techniques for
 * high-throughput streaming applications. It shows how to:
 *
 * 1. Optimize memory usage for large streams
 * 2. Implement backpressure handling
 * 3. Use efficient parsing strategies
 * 4. Profile and benchmark performance
 * 5. Scale to handle high-volume data
 *
 * Run this example:
 *   node examples/advanced/performance.js
 *
 * For memory profiling:
 *   node --expose-gc examples/advanced/performance.js
 */

import { streamEvents, streamFormat } from 'agent-stream-fmt';
import { createReadStream, writeFileSync } from 'fs';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Example 1: Memory-efficient streaming for large datasets
 */
async function memoryEfficientStreaming() {
  console.log('=== Example 1: Memory-Efficient Streaming ===\n');

  // Generate a large synthetic dataset
  function* generateLargeDataset(eventCount = 10000) {
    for (let i = 0; i < eventCount; i++) {
      const eventType = ['msg', 'tool', 'cost'][i % 3];

      let event;
      switch (eventType) {
        case 'msg':
          event = {
            type: 'message',
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}: ${'Lorem ipsum '.repeat(Math.floor(Math.random() * 20) + 1)}`,
          };
          break;
        case 'tool':
          const phases = ['start', 'stdout', 'end'];
          event = {
            type: 'tool_use',
            name: `tool_${i % 5}`,
            phase: phases[i % 3],
            ...(phases[i % 3] === 'end' ? { exit_code: 0 } : {}),
            ...(phases[i % 3] === 'stdout' ? { text: `Output ${i}` } : {}),
          };
          break;
        case 'cost':
          event = {
            type: 'usage',
            delta_usd: Math.random() * 0.01,
          };
          break;
      }

      yield JSON.stringify(event) + '\n';
    }
  }

  const datasetSize = 50000;
  console.log(`Processing ${datasetSize} events for memory efficiency...\n`);

  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  let eventCount = 0;
  let totalTextLength = 0;
  const input = Readable.from(generateLargeDataset(datasetSize));

  try {
    for await (const event of streamEvents({
      vendor: 'auto',
      source: input,
    })) {
      eventCount++;

      // Track text processing for memory analysis
      if (event.text) {
        totalTextLength += event.text.length;
      }

      // Log progress periodically without storing data
      if (eventCount % 10000 === 0) {
        const currentMemory = process.memoryUsage();
        const memoryDelta = currentMemory.heapUsed - startMemory.heapUsed;
        console.log(
          `Processed ${eventCount} events, memory delta: ${(memoryDelta / 1024 / 1024).toFixed(2)} MB`,
        );
      }
    }

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    console.log('\n=== Memory Efficiency Results ===');
    console.log(`Events processed: ${eventCount}`);
    console.log(`Processing time: ${Number(endTime - startTime) / 1000000}ms`);
    console.log(
      `Events per second: ${(eventCount / (Number(endTime - startTime) / 1000000000)).toFixed(0)}`,
    );
    console.log(
      `Total text processed: ${(totalTextLength / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(`Memory usage:`);
    console.log(
      `  Start: ${(startMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(`  End: ${(endMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(
      `  Delta: ${((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
    );
    console.log(
      `  Memory per event: ${((endMemory.heapUsed - startMemory.heapUsed) / eventCount).toFixed(2)} bytes`,
    );
  } catch (error) {
    console.error('Error in memory efficiency test:', error.message);
  }
}

/**
 * Example 2: Backpressure handling for slow consumers
 */
async function backpressureHandling() {
  console.log('\n=== Example 2: Backpressure Handling ===\n');

  // Create a slow consumer transform stream
  class SlowConsumer extends Transform {
    constructor(delayMs = 10) {
      super({ objectMode: true });
      this.delayMs = delayMs;
      this.processed = 0;
    }

    async _transform(chunk, encoding, callback) {
      // Simulate slow processing
      await new Promise(resolve => setTimeout(resolve, this.delayMs));

      this.processed++;
      if (this.processed % 100 === 0) {
        console.log(`Slow consumer processed ${this.processed} events`);
      }

      callback(null, chunk);
    }
  }

  // Fast data producer
  function* generateFastData(count = 1000) {
    for (let i = 0; i < count; i++) {
      yield JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: `Fast message ${i}`,
      }) + '\n';
    }
  }

  console.log('Testing backpressure with fast producer and slow consumer...\n');

  const startTime = Date.now();
  const fastInput = Readable.from(generateFastData(2000));
  const slowConsumer = new SlowConsumer(5); // 5ms delay per event

  try {
    // Use pipeline for proper backpressure handling
    let eventCount = 0;

    await pipeline(
      fastInput,
      async function* (source) {
        for await (const event of streamEvents({
          vendor: 'auto',
          source,
        })) {
          eventCount++;
          yield event;
        }
      },
      slowConsumer,
    );

    const duration = Date.now() - startTime;
    console.log(`\nBackpressure test completed:`);
    console.log(`  Events processed: ${eventCount}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(
      `  Effective rate: ${(eventCount / (duration / 1000)).toFixed(0)} events/sec`,
    );
    console.log(`  Consumer processed: ${slowConsumer.processed}`);
  } catch (error) {
    console.error('Error in backpressure test:', error.message);
  }
}

/**
 * Example 3: Optimized parsing strategies
 */
async function optimizedParsing() {
  console.log('\n=== Example 3: Optimized Parsing Strategies ===\n');

  // Test different parsing approaches
  const testData = Array.from({ length: 10000 }, (_, i) =>
    JSON.stringify({
      type: 'message',
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Test message ${i} with some content to parse`,
    }),
  ).join('\n');

  console.log('Comparing parsing strategies...\n');

  // Strategy 1: Line-by-line streaming (current approach)
  console.log('1. Streaming line-by-line parsing:');
  const stream1Start = process.hrtime.bigint();
  const input1 = Readable.from([testData]);

  let count1 = 0;
  for await (const event of streamEvents({
    vendor: 'auto',
    source: input1,
  })) {
    count1++;
  }

  const stream1Time = Number(process.hrtime.bigint() - stream1Start) / 1000000;
  console.log(`   Processed ${count1} events in ${stream1Time.toFixed(2)}ms`);
  console.log(
    `   Rate: ${(count1 / (stream1Time / 1000)).toFixed(0)} events/sec`,
  );

  // Strategy 2: Batch processing simulation
  console.log('\n2. Batch processing simulation:');
  const batch2Start = process.hrtime.bigint();
  const lines = testData.split('\n').filter(line => line.trim());

  let count2 = 0;
  const batchSize = 100;

  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize);

    for (const line of batch) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type) count2++;
      } catch (e) {
        // Skip invalid lines
      }
    }
  }

  const batch2Time = Number(process.hrtime.bigint() - batch2Start) / 1000000;
  console.log(`   Processed ${count2} events in ${batch2Time.toFixed(2)}ms`);
  console.log(
    `   Rate: ${(count2 / (batch2Time / 1000)).toFixed(0)} events/sec`,
  );

  // Strategy 3: Pre-compiled regex for format detection
  console.log('\n3. Optimized format detection:');
  const regex3Start = process.hrtime.bigint();

  // Pre-compile regex patterns
  const claudePattern = /"type"\s*:\s*"(message|tool_use|usage)"/;
  const geminiPattern = /"event"\s*:\s*"(content|tool)"/;

  let count3 = 0;
  for (const line of lines) {
    if (claudePattern.test(line) || geminiPattern.test(line)) {
      try {
        const parsed = JSON.parse(line);
        count3++;
      } catch (e) {
        // Skip invalid
      }
    }
  }

  const regex3Time = Number(process.hrtime.bigint() - regex3Start) / 1000000;
  console.log(`   Processed ${count3} events in ${regex3Time.toFixed(2)}ms`);
  console.log(
    `   Rate: ${(count3 / (regex3Time / 1000)).toFixed(0)} events/sec`,
  );

  console.log('\n=== Parsing Performance Comparison ===');
  console.log(`Streaming approach: ${stream1Time.toFixed(2)}ms`);
  console.log(
    `Batch processing: ${batch2Time.toFixed(2)}ms (${(stream1Time / batch2Time).toFixed(1)}x)`,
  );
  console.log(
    `Optimized detection: ${regex3Time.toFixed(2)}ms (${(stream1Time / regex3Time).toFixed(1)}x)`,
  );
}

/**
 * Example 4: Garbage collection and memory profiling
 */
async function memoryProfiling() {
  console.log('\n=== Example 4: Memory Profiling ===\n');

  // Check if GC is available
  const gcAvailable = typeof global.gc === 'function';
  console.log(`Garbage collection available: ${gcAvailable}`);

  if (!gcAvailable) {
    console.log('Run with --expose-gc for detailed memory profiling\n');
  }

  function getMemoryStats() {
    const usage = process.memoryUsage();
    return {
      heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2),
      external: (usage.external / 1024 / 1024).toFixed(2),
      rss: (usage.rss / 1024 / 1024).toFixed(2),
    };
  }

  // Generate data in chunks to test memory patterns
  function* generateChunkedData(chunkSize = 1000, chunkCount = 20) {
    for (let chunk = 0; chunk < chunkCount; chunk++) {
      const events = [];
      for (let i = 0; i < chunkSize; i++) {
        events.push(
          JSON.stringify({
            type: 'message',
            role: 'assistant',
            content: `Chunk ${chunk}, message ${i}: ${'data '.repeat(50)}`,
          }),
        );
      }
      yield events.join('\n') + '\n';
    }
  }

  console.log('Profiling memory usage patterns...\n');

  const initialStats = getMemoryStats();
  console.log('Initial memory:', initialStats);

  let totalEvents = 0;
  const memorySnapshots = [];

  try {
    const chunkGenerator = generateChunkedData(2000, 10);

    for (const chunk of chunkGenerator) {
      const input = Readable.from([chunk]);

      // Process chunk
      for await (const event of streamEvents({
        vendor: 'auto',
        source: input,
      })) {
        totalEvents++;
      }

      // Force GC if available
      if (gcAvailable) {
        global.gc();
      }

      // Take memory snapshot
      const stats = getMemoryStats();
      memorySnapshots.push({
        events: totalEvents,
        ...stats,
      });

      console.log(
        `Processed ${totalEvents} events - Heap: ${stats.heapUsed}MB, RSS: ${stats.rss}MB`,
      );
    }

    console.log('\n=== Memory Usage Analysis ===');
    console.log(`Total events processed: ${totalEvents}`);

    const finalStats = getMemoryStats();
    console.log('Final memory:', finalStats);

    const heapGrowth =
      parseFloat(finalStats.heapUsed) - parseFloat(initialStats.heapUsed);
    console.log(`Heap growth: ${heapGrowth.toFixed(2)}MB`);
    console.log(
      `Memory per event: ${((heapGrowth * 1024 * 1024) / totalEvents).toFixed(2)} bytes`,
    );

    // Analyze memory stability
    const heapValues = memorySnapshots.map(s => parseFloat(s.heapUsed));
    const maxHeap = Math.max(...heapValues);
    const minHeap = Math.min(...heapValues);
    const avgHeap = heapValues.reduce((a, b) => a + b, 0) / heapValues.length;

    console.log('\nMemory stability:');
    console.log(`  Min heap: ${minHeap.toFixed(2)}MB`);
    console.log(`  Max heap: ${maxHeap.toFixed(2)}MB`);
    console.log(`  Avg heap: ${avgHeap.toFixed(2)}MB`);
    console.log(`  Variance: ${(maxHeap - minHeap).toFixed(2)}MB`);
  } catch (error) {
    console.error('Error in memory profiling:', error.message);
  }
}

/**
 * Example 5: High-throughput benchmarking
 */
async function throughputBenchmarking() {
  console.log('\n=== Example 5: High-Throughput Benchmarking ===\n');

  const benchmarkSizes = [1000, 5000, 10000, 25000];
  const results = [];

  for (const size of benchmarkSizes) {
    console.log(`Benchmarking ${size} events...`);

    // Generate test data
    const testData = Array.from({ length: size }, (_, i) => {
      const events = [
        { type: 'message', role: 'user', content: `User message ${i}` },
        {
          type: 'message',
          role: 'assistant',
          content: `Assistant response ${i}`,
        },
        { type: 'tool_use', name: 'test_tool', phase: 'start' },
        {
          type: 'tool_use',
          name: 'test_tool',
          phase: 'stdout',
          text: `Output ${i}`,
        },
        { type: 'tool_use', name: 'test_tool', phase: 'end', exit_code: 0 },
        { type: 'usage', delta_usd: 0.001 },
      ];
      return JSON.stringify(events[i % events.length]);
    }).join('\n');

    const input = Readable.from([testData]);

    // Benchmark processing
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;

    let eventCount = 0;
    let messageCount = 0;
    let toolCount = 0;
    let costCount = 0;

    try {
      for await (const event of streamEvents({
        vendor: 'auto',
        source: input,
      })) {
        eventCount++;

        switch (event.t) {
          case 'msg':
            messageCount++;
            break;
          case 'tool':
            toolCount++;
            break;
          case 'cost':
            costCount++;
            break;
        }
      }

      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage().heapUsed;

      const durationMs = Number(endTime - startTime) / 1000000;
      const throughput = eventCount / (durationMs / 1000);
      const memoryUsed = (endMemory - startMemory) / 1024 / 1024;

      const result = {
        size,
        eventCount,
        messageCount,
        toolCount,
        costCount,
        durationMs: durationMs.toFixed(2),
        throughput: throughput.toFixed(0),
        memoryMB: memoryUsed.toFixed(2),
      };

      results.push(result);

      console.log(
        `  Events: ${eventCount}, Duration: ${result.durationMs}ms, Throughput: ${result.throughput} events/sec, Memory: ${result.memoryMB}MB`,
      );
    } catch (error) {
      console.error(`Error benchmarking ${size} events:`, error.message);
    }
  }

  console.log('\n=== Throughput Benchmark Results ===');
  console.log('Size\t\tEvents\t\tDuration\tThroughput\tMemory');
  console.log('----\t\t------\t\t--------\t----------\t------');

  for (const result of results) {
    console.log(
      `${result.size}\t\t${result.eventCount}\t\t${result.durationMs}ms\t\t${result.throughput}/s\t\t${result.memoryMB}MB`,
    );
  }

  // Performance analysis
  const throughputs = results.map(r => parseFloat(r.throughput));
  const avgThroughput =
    throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
  const maxThroughput = Math.max(...throughputs);
  const minThroughput = Math.min(...throughputs);

  console.log('\nPerformance Summary:');
  console.log(`  Average throughput: ${avgThroughput.toFixed(0)} events/sec`);
  console.log(`  Peak throughput: ${maxThroughput.toFixed(0)} events/sec`);
  console.log(`  Minimum throughput: ${minThroughput.toFixed(0)} events/sec`);
  console.log(
    `  Throughput variance: ${(maxThroughput - minThroughput).toFixed(0)} events/sec`,
  );

  // Save detailed results
  const reportPath = join(__dirname, '../../temp/performance-benchmark.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        results,
        summary: {
          avgThroughput,
          maxThroughput,
          minThroughput,
          throughputVariance: maxThroughput - minThroughput,
        },
      },
      null,
      2,
    ),
  );

  console.log(`\nDetailed benchmark results saved to: ${reportPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Agent Stream Formatter - Performance Optimization Examples\n');
  console.log('This demonstrates performance optimization techniques.\n');

  try {
    await memoryEfficientStreaming();
    await backpressureHandling();
    await optimizedParsing();
    await memoryProfiling();
    await throughputBenchmarking();

    console.log('\n=== Performance Examples Complete ===');
    console.log('\nKey optimization techniques:');
    console.log('- Constant memory usage with streaming');
    console.log('- Proper backpressure handling');
    console.log('- Optimized parsing strategies');
    console.log('- Memory profiling and GC analysis');
    console.log('- Throughput benchmarking');

    console.log('\nPerformance tips:');
    console.log('- Use streaming for large datasets');
    console.log('- Handle backpressure with pipeline()');
    console.log('- Pre-compile regex patterns for format detection');
    console.log('- Monitor memory usage in production');
    console.log('- Benchmark with realistic data volumes');

    console.log('\nNext steps:');
    console.log(
      '- Try multi-vendor examples: node examples/advanced/multi-vendor.js',
    );
    console.log('- Explore integration examples: ls examples/integrations/');
    console.log('- Run dedicated benchmarks: npm run benchmark');
  } catch (error) {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
