#!/usr/bin/env node

/**
 * Throughput Benchmark Test
 *
 * This benchmark measures the processing throughput of agent-stream-fmt
 * under various conditions and load scenarios. It provides comprehensive
 * performance metrics for optimization and capacity planning.
 *
 * Features:
 * 1. Variable load testing (1K to 100K events)
 * 2. Different event type distributions
 * 3. Memory usage monitoring
 * 4. Vendor-specific performance comparison
 * 5. Streaming vs batch processing comparison
 *
 * Run this benchmark:
 *   node examples/benchmarks/throughput-test.js [options]
 *
 * Options:
 *   --sizes <list>     Event counts to test (default: 1000,5000,10000,25000)
 *   --vendors <list>   Vendors to test (default: claude,gemini,amp)
 *   --iterations <n>   Iterations per test (default: 3)
 *   --output <path>    Results output file
 *   --format <type>    Results format: json, csv, console (default: console)
 */

import { streamEvents, streamFormat } from 'agent-stream-fmt';
import { Readable } from 'stream';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Throughput Benchmark Class
 */
class ThroughputBenchmark {
  constructor(options = {}) {
    this.options = {
      sizes: options.sizes || [1000, 5000, 10000, 25000],
      vendors: options.vendors || ['claude', 'gemini', 'amp'],
      iterations: options.iterations || 3,
      output: options.output,
      format: options.format || 'console',
      warmupIterations: 1,
      ...options,
    };

    this.results = [];
    this.eventGenerators = new Map();
    this.setupEventGenerators();
  }

  /**
   * Setup event generators for different vendors
   */
  setupEventGenerators() {
    // Claude event generator
    this.eventGenerators.set('claude', count => {
      const events = [];
      for (let i = 0; i < count; i++) {
        const eventTypes = [
          {
            type: 'message',
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}: ${'Lorem ipsum '.repeat(Math.floor(Math.random() * 20) + 1)}`,
          },
          {
            type: 'tool_use',
            name: `tool_${i % 10}`,
            phase: ['start', 'stdout', 'end'][i % 3],
            ...(i % 3 === 1 ? { text: `Output for tool execution ${i}` } : {}),
            ...(i % 3 === 2 ? { exit_code: Math.random() > 0.1 ? 0 : 1 } : {}),
          },
          {
            type: 'usage',
            delta_usd: Math.random() * 0.01,
          },
        ];

        events.push(JSON.stringify(eventTypes[i % 3]));
      }
      return events.join('\n');
    });

    // Gemini event generator
    this.eventGenerators.set('gemini', count => {
      const events = [];
      for (let i = 0; i < count; i++) {
        const eventTypes = [
          {
            event: 'content',
            role: i % 2 === 0 ? 'user' : 'model',
            content: `Gemini content ${i}: ${'Sample text '.repeat(Math.floor(Math.random() * 15) + 1)}`,
          },
          {
            event: 'tool',
            name: `gemini_tool_${i % 8}`,
            phase: ['start', 'output', 'end'][i % 3],
            ...(i % 3 === 1 ? { output: `Tool output ${i}` } : {}),
            ...(i % 3 === 2
              ? { status: Math.random() > 0.1 ? 'success' : 'error' }
              : {}),
          },
        ];

        events.push(JSON.stringify(eventTypes[i % 2]));
      }
      return events.join('\n');
    });

    // Amp event generator
    this.eventGenerators.set('amp', count => {
      const events = [];
      for (let i = 0; i < count; i++) {
        const eventTypes = [
          {
            event: 'message',
            role: i % 2 === 0 ? 'user' : 'assistant',
            text: `Amp message ${i}: ${'Content text '.repeat(Math.floor(Math.random() * 12) + 1)}`,
          },
          {
            event: 'tool',
            name: `amp_tool_${i % 6}`,
            status: ['running', 'completed', 'failed'][i % 3],
            ...(i % 3 === 1 ? { output: `Tool result ${i}` } : {}),
          },
        ];

        events.push(JSON.stringify(eventTypes[i % 2]));
      }
      return events.join('\n');
    });
  }

  /**
   * Run comprehensive throughput benchmark
   */
  async runBenchmark() {
    console.log('🚀 Starting Throughput Benchmark');
    console.log(`📊 Event Sizes: ${this.options.sizes.join(', ')}`);
    console.log(`🎯 Vendors: ${this.options.vendors.join(', ')}`);
    console.log(`🔄 Iterations: ${this.options.iterations}`);
    console.log(`⚡ Warmup Iterations: ${this.options.warmupIterations}\n`);

    // Run warmup
    await this.runWarmup();

    // Run main benchmarks
    for (const size of this.options.sizes) {
      console.log(`\n📈 Testing ${size.toLocaleString()} events:`);
      console.log('━'.repeat(50));

      for (const vendor of this.options.vendors) {
        await this.benchmarkVendor(vendor, size);
      }
    }

    // Generate results
    await this.generateResults();

    console.log('\n✅ Benchmark Complete!');
    console.log(`📊 Total Tests: ${this.results.length}`);
    console.log(`⏱️  Total Time: ${this.getTotalBenchmarkTime()}ms`);
  }

  /**
   * Run warmup iterations to stabilize performance
   */
  async runWarmup() {
    console.log('🔥 Running warmup iterations...');

    for (let i = 0; i < this.options.warmupIterations; i++) {
      for (const vendor of this.options.vendors) {
        const data = this.eventGenerators.get(vendor)(1000);
        const input = Readable.from([data]);

        let eventCount = 0;
        for await (const event of streamEvents({ vendor, source: input })) {
          eventCount++;
        }
      }
    }

    console.log('✅ Warmup complete');
  }

  /**
   * Benchmark a specific vendor with given event count
   */
  async benchmarkVendor(vendor, eventCount) {
    const measurements = [];

    console.log(`  📋 ${vendor.toUpperCase()}:`);

    for (let iteration = 0; iteration < this.options.iterations; iteration++) {
      const result = await this.runSingleTest(
        vendor,
        eventCount,
        iteration + 1,
      );
      measurements.push(result);

      console.log(
        `    Iteration ${iteration + 1}: ${result.throughput.toFixed(0)} events/sec, ${result.durationMs.toFixed(2)}ms, ${result.memoryMB.toFixed(2)}MB`,
      );
    }

    // Calculate statistics
    const stats = this.calculateStatistics(measurements);

    console.log(`    📊 Average: ${stats.avgThroughput.toFixed(0)} events/sec`);
    console.log(`    📊 Best: ${stats.maxThroughput.toFixed(0)} events/sec`);
    console.log(
      `    📊 Memory: ${stats.avgMemory.toFixed(2)}MB ± ${stats.memoryStdDev.toFixed(2)}MB`,
    );

    // Store aggregated result
    this.results.push({
      vendor,
      eventCount,
      iterations: this.options.iterations,
      measurements,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Run a single benchmark test
   */
  async runSingleTest(vendor, eventCount, iteration) {
    // Generate test data
    const testData = this.eventGenerators.get(vendor)(eventCount);
    const input = Readable.from([testData]);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Measure memory before
    const memoryBefore = process.memoryUsage();
    const startTime = process.hrtime.bigint();

    // Process events
    let processedEvents = 0;
    let messageCount = 0;
    let toolCount = 0;
    let costCount = 0;
    let errorCount = 0;

    try {
      for await (const event of streamEvents({
        vendor,
        source: input,
      })) {
        processedEvents++;

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
          case 'error':
            errorCount++;
            break;
        }
      }
    } catch (error) {
      console.error(`    ❌ Error in iteration ${iteration}:`, error.message);
      errorCount++;
    }

    // Measure completion
    const endTime = process.hrtime.bigint();
    const memoryAfter = process.memoryUsage();

    const durationMs = Number(endTime - startTime) / 1000000;
    const throughput = processedEvents / (durationMs / 1000);
    const memoryUsed =
      (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;

    return {
      vendor,
      eventCount,
      iteration,
      processedEvents,
      messageCount,
      toolCount,
      costCount,
      errorCount,
      durationMs,
      throughput,
      memoryMB: memoryUsed,
      memoryBefore: memoryBefore.heapUsed / 1024 / 1024,
      memoryAfter: memoryAfter.heapUsed / 1024 / 1024,
    };
  }

  /**
   * Calculate statistics from multiple measurements
   */
  calculateStatistics(measurements) {
    const throughputs = measurements.map(m => m.throughput);
    const durations = measurements.map(m => m.durationMs);
    const memories = measurements.map(m => m.memoryMB);

    return {
      avgThroughput: this.average(throughputs),
      maxThroughput: Math.max(...throughputs),
      minThroughput: Math.min(...throughputs),
      throughputStdDev: this.standardDeviation(throughputs),

      avgDuration: this.average(durations),
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),

      avgMemory: this.average(memories),
      maxMemory: Math.max(...memories),
      minMemory: Math.min(...memories),
      memoryStdDev: this.standardDeviation(memories),

      totalEvents: measurements.reduce((sum, m) => sum + m.processedEvents, 0),
      totalErrors: measurements.reduce((sum, m) => sum + m.errorCount, 0),

      reliability:
        1 -
        measurements.reduce((sum, m) => sum + m.errorCount, 0) /
          measurements.reduce((sum, m) => sum + m.processedEvents, 0),
    };
  }

  /**
   * Calculate average of array
   */
  average(arr) {
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  /**
   * Calculate standard deviation
   */
  standardDeviation(arr) {
    const avg = this.average(arr);
    const squaredDiffs = arr.map(val => Math.pow(val - avg, 2));
    return Math.sqrt(this.average(squaredDiffs));
  }

  /**
   * Get total benchmark time
   */
  getTotalBenchmarkTime() {
    return this.results.reduce((total, result) => {
      return (
        total + result.measurements.reduce((sum, m) => sum + m.durationMs, 0)
      );
    }, 0);
  }

  /**
   * Generate and output results
   */
  async generateResults() {
    console.log('\n📊 Generating Results...');

    const summary = this.generateSummary();

    switch (this.options.format) {
      case 'json':
        await this.generateJSONResults(summary);
        break;
      case 'csv':
        await this.generateCSVResults(summary);
        break;
      case 'console':
      default:
        this.displayConsoleResults(summary);
        break;
    }
  }

  /**
   * Generate benchmark summary
   */
  generateSummary() {
    const summary = {
      metadata: {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        options: this.options,
      },
      overall: {
        totalTests: this.results.length,
        totalTime: this.getTotalBenchmarkTime(),
        vendors: this.options.vendors,
        eventSizes: this.options.sizes,
      },
      byVendor: {},
      bySize: {},
      recommendations: [],
    };

    // Aggregate by vendor
    for (const vendor of this.options.vendors) {
      const vendorResults = this.results.filter(r => r.vendor === vendor);
      summary.byVendor[vendor] = {
        avgThroughput: this.average(
          vendorResults.map(r => r.statistics.avgThroughput),
        ),
        maxThroughput: Math.max(
          ...vendorResults.map(r => r.statistics.maxThroughput),
        ),
        avgMemory: this.average(vendorResults.map(r => r.statistics.avgMemory)),
        reliability: this.average(
          vendorResults.map(r => r.statistics.reliability),
        ),
      };
    }

    // Aggregate by size
    for (const size of this.options.sizes) {
      const sizeResults = this.results.filter(r => r.eventCount === size);
      summary.bySize[size] = {
        avgThroughput: this.average(
          sizeResults.map(r => r.statistics.avgThroughput),
        ),
        maxThroughput: Math.max(
          ...sizeResults.map(r => r.statistics.maxThroughput),
        ),
        avgMemory: this.average(sizeResults.map(r => r.statistics.avgMemory)),
        scalingEfficiency:
          size > 1000
            ? this.average(sizeResults.map(r => r.statistics.avgThroughput)) /
              (size / 1000)
            : 1,
      };
    }

    // Generate recommendations
    summary.recommendations = this.generateRecommendations(summary);

    return summary;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(summary) {
    const recommendations = [];

    // Find best performing vendor
    const bestVendor = Object.entries(summary.byVendor).sort(
      ([, a], [, b]) => b.avgThroughput - a.avgThroughput,
    )[0];

    if (bestVendor) {
      recommendations.push(
        `🏆 Best overall performance: ${bestVendor[0]} (${bestVendor[1].avgThroughput.toFixed(0)} events/sec)`,
      );
    }

    // Memory efficiency
    const mostMemoryEfficient = Object.entries(summary.byVendor).sort(
      ([, a], [, b]) => a.avgMemory - b.avgMemory,
    )[0];

    if (mostMemoryEfficient) {
      recommendations.push(
        `💾 Most memory efficient: ${mostMemoryEfficient[0]} (${mostMemoryEfficient[1].avgMemory.toFixed(2)}MB avg)`,
      );
    }

    // Reliability
    const mostReliable = Object.entries(summary.byVendor).sort(
      ([, a], [, b]) => b.reliability - a.reliability,
    )[0];

    if (mostReliable && mostReliable[1].reliability < 1.0) {
      recommendations.push(
        `🛡️ Most reliable: ${mostReliable[0]} (${(mostReliable[1].reliability * 100).toFixed(1)}% success rate)`,
      );
    }

    // Scaling analysis
    const scalingEfficiencies = Object.values(summary.bySize)
      .map(s => s.scalingEfficiency)
      .filter(s => s !== 1);

    if (scalingEfficiencies.length > 0) {
      const avgScaling = this.average(scalingEfficiencies);
      if (avgScaling > 0.8) {
        recommendations.push('📈 Good scaling efficiency across event sizes');
      } else {
        recommendations.push(
          '⚠️ Performance degrades with larger event counts - consider batching',
        );
      }
    }

    // Performance targets
    const overallAvgThroughput = this.average(
      Object.values(summary.byVendor).map(v => v.avgThroughput),
    );

    if (overallAvgThroughput > 50000) {
      recommendations.push(
        '✅ Excellent throughput - exceeds 50k events/sec target',
      );
    } else if (overallAvgThroughput > 20000) {
      recommendations.push(
        '👍 Good throughput - meets production requirements',
      );
    } else {
      recommendations.push(
        '⚠️ Consider performance optimization - below 20k events/sec',
      );
    }

    return recommendations;
  }

  /**
   * Display results in console
   */
  displayConsoleResults(summary) {
    console.log('\n📊 THROUGHPUT BENCHMARK RESULTS');
    console.log('═'.repeat(60));

    console.log('\n🎯 Overall Performance:');
    console.log(`   Total Tests: ${summary.overall.totalTests}`);
    console.log(`   Total Time: ${summary.overall.totalTime.toFixed(2)}ms`);
    console.log(`   Node.js: ${summary.metadata.nodeVersion}`);
    console.log(
      `   Platform: ${summary.metadata.platform} ${summary.metadata.arch}`,
    );

    console.log('\n📈 By Vendor:');
    for (const [vendor, stats] of Object.entries(summary.byVendor)) {
      console.log(`   ${vendor.toUpperCase()}:`);
      console.log(
        `     Avg Throughput: ${stats.avgThroughput.toFixed(0)} events/sec`,
      );
      console.log(
        `     Peak Throughput: ${stats.maxThroughput.toFixed(0)} events/sec`,
      );
      console.log(`     Avg Memory: ${stats.avgMemory.toFixed(2)}MB`);
      console.log(`     Reliability: ${(stats.reliability * 100).toFixed(1)}%`);
    }

    console.log('\n📏 By Event Count:');
    for (const [size, stats] of Object.entries(summary.bySize)) {
      console.log(`   ${parseInt(size).toLocaleString()} events:`);
      console.log(
        `     Avg Throughput: ${stats.avgThroughput.toFixed(0)} events/sec`,
      );
      console.log(
        `     Peak Throughput: ${stats.maxThroughput.toFixed(0)} events/sec`,
      );
      console.log(`     Avg Memory: ${stats.avgMemory.toFixed(2)}MB`);
      if (stats.scalingEfficiency !== 1) {
        console.log(
          `     Scaling Efficiency: ${(stats.scalingEfficiency * 100).toFixed(1)}%`,
        );
      }
    }

    console.log('\n💡 Recommendations:');
    for (const rec of summary.recommendations) {
      console.log(`   ${rec}`);
    }
  }

  /**
   * Generate JSON results file
   */
  async generateJSONResults(summary) {
    const fullResults = {
      summary,
      detailedResults: this.results,
    };

    const outputFile =
      this.options.output ||
      join(__dirname, `../../temp/throughput-benchmark-${Date.now()}.json`);

    writeFileSync(outputFile, JSON.stringify(fullResults, null, 2));
    console.log(`📄 JSON results saved to: ${outputFile}`);
  }

  /**
   * Generate CSV results file
   */
  async generateCSVResults(summary) {
    const csv = [
      'Vendor,EventCount,Iteration,ProcessedEvents,DurationMs,ThroughputEventsPerSec,MemoryMB,ErrorCount',
      ...this.results.flatMap(result =>
        result.measurements.map(
          m =>
            `${m.vendor},${m.eventCount},${m.iteration},${m.processedEvents},${m.durationMs.toFixed(2)},${m.throughput.toFixed(0)},${m.memoryMB.toFixed(2)},${m.errorCount}`,
        ),
      ),
    ].join('\n');

    const outputFile =
      this.options.output ||
      join(__dirname, `../../temp/throughput-benchmark-${Date.now()}.csv`);

    writeFileSync(outputFile, csv);
    console.log(`📄 CSV results saved to: ${outputFile}`);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--sizes':
        options.sizes = args[++i].split(',').map(s => parseInt(s.trim()));
        break;
      case '--vendors':
        options.vendors = args[++i].split(',').map(s => s.trim());
        break;
      case '--iterations':
        options.iterations = parseInt(args[++i]);
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--format':
        options.format = args[++i];
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
🚀 Throughput Benchmark for Agent Stream Formatter

USAGE:
  node throughput-test.js [options]

OPTIONS:
  --sizes <list>     Event counts to test (default: 1000,5000,10000,25000)
  --vendors <list>   Vendors to test (default: claude,gemini,amp)
  --iterations <n>   Iterations per test (default: 3)
  --output <path>    Results output file
  --format <type>    Results format: json, csv, console (default: console)
  --help             Show this help message

EXAMPLES:
  node throughput-test.js
  node throughput-test.js --sizes 5000,10000 --vendors claude,gemini
  node throughput-test.js --iterations 5 --format json --output results.json
  node throughput-test.js --sizes 50000,100000 --format csv

PERFORMANCE TARGETS:
  • Excellent: >50,000 events/sec
  • Good: >20,000 events/sec
  • Acceptable: >10,000 events/sec
  • Memory: <50MB for 100k events
  • Reliability: >99% success rate
  `);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Agent Stream Formatter - Throughput Benchmark\n');

  const options = parseArgs();
  const benchmark = new ThroughputBenchmark(options);

  try {
    await benchmark.runBenchmark();
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export default ThroughputBenchmark;
