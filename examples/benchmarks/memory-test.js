#!/usr/bin/env node

/**
 * Memory Usage Benchmark Test
 *
 * This benchmark monitors memory usage patterns of agent-stream-fmt
 * to ensure constant memory consumption for streaming applications.
 * It tests memory efficiency under various scenarios.
 *
 * Features:
 * 1. Long-running stream memory stability
 * 2. Memory leak detection
 * 3. Peak memory usage measurement
 * 4. Garbage collection effectiveness
 * 5. Memory pressure testing
 *
 * Run this benchmark:
 *   node --expose-gc examples/benchmarks/memory-test.js [options]
 *
 * Options:
 *   --duration <seconds>  Test duration (default: 60)
 *   --rate <events/sec>   Event generation rate (default: 1000)
 *   --vendors <list>      Vendors to test (default: claude,gemini,amp)
 *   --gc-interval <ms>    GC interval (default: 5000)
 *   --output <path>       Results output file
 *   --format <type>       Results format: json, csv, console (default: console)
 */

import { streamEvents } from 'agent-stream-fmt';
import { Readable } from 'stream';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Memory Benchmark Class
 */
class MemoryBenchmark {
  constructor(options = {}) {
    this.options = {
      duration: options.duration || 60, // seconds
      rate: options.rate || 1000, // events per second
      vendors: options.vendors || ['claude', 'gemini', 'amp'],
      gcInterval: options.gcInterval || 5000, // ms
      output: options.output,
      format: options.format || 'console',
      samplingInterval: 100, // ms
      ...options,
    };

    this.results = [];
    this.isRunning = false;
    this.eventGenerators = new Map();
    this.setupEventGenerators();
  }

  /**
   * Setup lightweight event generators for memory testing
   */
  setupEventGenerators() {
    // Claude lightweight generator
    this.eventGenerators.set('claude', index => {
      const templates = [
        { type: 'message', role: 'user', content: `User message ${index}` },
        {
          type: 'message',
          role: 'assistant',
          content: `Assistant response ${index}`,
        },
        { type: 'tool_use', name: 'test_tool', phase: 'start' },
        { type: 'tool_use', name: 'test_tool', phase: 'end', exit_code: 0 },
        { type: 'usage', delta_usd: 0.001 },
      ];
      return JSON.stringify(templates[index % templates.length]);
    });

    // Gemini lightweight generator
    this.eventGenerators.set('gemini', index => {
      const templates = [
        { event: 'content', role: 'user', content: `User content ${index}` },
        { event: 'content', role: 'model', content: `Model response ${index}` },
        { event: 'tool', name: 'gemini_tool', phase: 'start' },
        { event: 'tool', name: 'gemini_tool', phase: 'end', status: 'success' },
      ];
      return JSON.stringify(templates[index % templates.length]);
    });

    // Amp lightweight generator
    this.eventGenerators.set('amp', index => {
      const templates = [
        { event: 'message', role: 'user', text: `User text ${index}` },
        {
          event: 'message',
          role: 'assistant',
          text: `Assistant text ${index}`,
        },
        { event: 'tool', name: 'amp_tool', status: 'running' },
        { event: 'tool', name: 'amp_tool', status: 'completed' },
      ];
      return JSON.stringify(templates[index % templates.length]);
    });
  }

  /**
   * Run comprehensive memory benchmark
   */
  async runBenchmark() {
    console.log('🧠 Starting Memory Benchmark');
    console.log(`⏱️  Duration: ${this.options.duration} seconds`);
    console.log(`📊 Event Rate: ${this.options.rate} events/sec`);
    console.log(`🎯 Vendors: ${this.options.vendors.join(', ')}`);
    console.log(`🗑️  GC Interval: ${this.options.gcInterval}ms`);

    // Check if GC is available
    if (typeof global.gc !== 'function') {
      console.log(
        '⚠️  Note: Run with --expose-gc for manual garbage collection',
      );
    }
    console.log();

    // Run tests for each vendor
    for (const vendor of this.options.vendors) {
      console.log(`\n🔍 Testing ${vendor.toUpperCase()} memory usage:`);
      console.log('━'.repeat(50));

      await this.testVendorMemory(vendor);
    }

    // Run combined stress test
    await this.runStressTest();

    // Generate results
    await this.generateResults();

    console.log('\n✅ Memory Benchmark Complete!');
  }

  /**
   * Test memory usage for a specific vendor
   */
  async testVendorMemory(vendor) {
    const testResults = {
      vendor,
      startTime: Date.now(),
      duration: this.options.duration * 1000,
      targetRate: this.options.rate,
      samples: [],
      events: {
        generated: 0,
        processed: 0,
        errors: 0,
      },
      memory: {
        initial: 0,
        peak: 0,
        final: 0,
        leaked: 0,
        stable: true,
      },
      gc: {
        manual: 0,
        automatic: 0,
      },
    };

    // Start memory monitoring
    const memoryMonitor = this.startMemoryMonitoring(testResults);

    // Record initial memory
    if (global.gc) {
      global.gc();
      testResults.gc.manual++;
    }

    const initialMemory = process.memoryUsage();
    testResults.memory.initial = initialMemory.heapUsed / 1024 / 1024;

    console.log(
      `  📊 Initial memory: ${testResults.memory.initial.toFixed(2)}MB`,
    );

    // Start event generation and processing
    this.isRunning = true;
    const eventStream = this.createEventStream(vendor, testResults);

    // Setup GC monitoring
    const gcMonitor = this.setupGCMonitoring(testResults);

    try {
      // Process events for specified duration
      const processingPromise = this.processEventStream(
        vendor,
        eventStream,
        testResults,
      );
      const timeoutPromise = new Promise(resolve =>
        setTimeout(() => {
          this.isRunning = false;
          resolve();
        }, this.options.duration * 1000),
      );

      await Promise.race([processingPromise, timeoutPromise]);
      this.isRunning = false;
    } catch (error) {
      console.log(`  ❌ Error during processing: ${error.message}`);
      testResults.events.errors++;
    }

    // Stop monitoring
    clearInterval(memoryMonitor);
    clearInterval(gcMonitor);

    // Final memory measurement
    if (global.gc) {
      global.gc();
      testResults.gc.manual++;
    }

    const finalMemory = process.memoryUsage();
    testResults.memory.final = finalMemory.heapUsed / 1024 / 1024;
    testResults.memory.leaked =
      testResults.memory.final - testResults.memory.initial;

    // Analyze memory stability
    testResults.memory.stable = this.analyzeMemoryStability(
      testResults.samples,
    );

    // Display results
    this.displayVendorResults(testResults);

    // Store results
    this.results.push(testResults);
  }

  /**
   * Start memory usage monitoring
   */
  startMemoryMonitoring(testResults) {
    return setInterval(() => {
      const memory = process.memoryUsage();
      const timestamp = Date.now() - testResults.startTime;

      const sample = {
        timestamp,
        heapUsed: memory.heapUsed / 1024 / 1024,
        heapTotal: memory.heapTotal / 1024 / 1024,
        external: memory.external / 1024 / 1024,
        rss: memory.rss / 1024 / 1024,
        eventsProcessed: testResults.events.processed,
      };

      testResults.samples.push(sample);

      // Update peak memory
      if (sample.heapUsed > testResults.memory.peak) {
        testResults.memory.peak = sample.heapUsed;
      }
    }, this.options.samplingInterval);
  }

  /**
   * Setup garbage collection monitoring
   */
  setupGCMonitoring(testResults) {
    return setInterval(() => {
      if (global.gc && this.isRunning) {
        global.gc();
        testResults.gc.manual++;
      }
    }, this.options.gcInterval);
  }

  /**
   * Create continuous event stream
   */
  createEventStream(vendor, testResults) {
    const generator = this.eventGenerators.get(vendor);
    const self = this;

    return new Readable({
      objectMode: false,
      read() {
        if (!self.isRunning) {
          this.push(null);
          return;
        }

        // Generate events at specified rate
        const eventsPerInterval =
          self.options.rate / (1000 / self.options.samplingInterval);

        for (let i = 0; i < eventsPerInterval && self.isRunning; i++) {
          const event = generator(testResults.events.generated++);
          this.push(event + '\n');
        }
      },
    });
  }

  /**
   * Process event stream and count events
   */
  async processEventStream(vendor, eventStream, testResults) {
    try {
      for await (const event of streamEvents({
        vendor,
        source: eventStream,
      })) {
        if (!this.isRunning) break;

        testResults.events.processed++;

        // Periodically update progress
        if (testResults.events.processed % 10000 === 0) {
          const elapsed = (Date.now() - testResults.startTime) / 1000;
          const rate = testResults.events.processed / elapsed;
          console.log(
            `    📈 Processed: ${testResults.events.processed.toLocaleString()} events (${rate.toFixed(0)} events/sec)`,
          );
        }
      }
    } catch (error) {
      testResults.events.errors++;
      throw error;
    }
  }

  /**
   * Analyze memory stability over time
   */
  analyzeMemoryStability(samples) {
    if (samples.length < 10) return true;

    // Calculate trend in memory usage
    const recentSamples = samples.slice(-Math.min(50, samples.length));
    const memoryValues = recentSamples.map(s => s.heapUsed);

    // Simple linear regression to detect memory trend
    const n = memoryValues.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = memoryValues;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Memory is stable if slope is minimal (< 0.1 MB per sample)
    return Math.abs(slope) < 0.1;
  }

  /**
   * Display vendor test results
   */
  displayVendorResults(testResults) {
    const duration = (Date.now() - testResults.startTime) / 1000;
    const actualRate = testResults.events.processed / duration;

    console.log(`  ⏱️  Duration: ${duration.toFixed(1)}s`);
    console.log(
      `  📊 Events: ${testResults.events.processed.toLocaleString()} processed, ${testResults.events.generated.toLocaleString()} generated`,
    );
    console.log(
      `  📈 Rate: ${actualRate.toFixed(0)} events/sec (target: ${this.options.rate})`,
    );
    console.log(`  🧠 Memory:`);
    console.log(`     Initial: ${testResults.memory.initial.toFixed(2)}MB`);
    console.log(`     Peak: ${testResults.memory.peak.toFixed(2)}MB`);
    console.log(`     Final: ${testResults.memory.final.toFixed(2)}MB`);
    console.log(
      `     Leaked: ${testResults.memory.leaked >= 0 ? '+' : ''}${testResults.memory.leaked.toFixed(2)}MB`,
    );
    console.log(`     Stable: ${testResults.memory.stable ? '✅' : '⚠️'}`);
    console.log(`  🗑️  GC: ${testResults.gc.manual} manual collections`);

    if (testResults.events.errors > 0) {
      console.log(`  ❌ Errors: ${testResults.events.errors}`);
    }
  }

  /**
   * Run stress test with all vendors simultaneously
   */
  async runStressTest() {
    console.log('\n🔥 Running Memory Stress Test:');
    console.log('━'.repeat(50));
    console.log('Testing all vendors simultaneously for memory pressure...\n');

    const stressResults = {
      startTime: Date.now(),
      duration: Math.min(this.options.duration, 30) * 1000, // Max 30s for stress test
      vendors: this.options.vendors,
      samples: [],
      totalEvents: 0,
      peakMemory: 0,
      memoryGrowth: 0,
    };

    // Record initial memory
    if (global.gc) {
      global.gc();
    }
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    // Start memory monitoring
    const stressMonitor = setInterval(() => {
      const memory = process.memoryUsage();
      const sample = {
        timestamp: Date.now() - stressResults.startTime,
        heapUsed: memory.heapUsed / 1024 / 1024,
        rss: memory.rss / 1024 / 1024,
      };
      stressResults.samples.push(sample);

      if (sample.heapUsed > stressResults.peakMemory) {
        stressResults.peakMemory = sample.heapUsed;
      }
    }, this.options.samplingInterval);

    try {
      // Start multiple vendor streams simultaneously
      const streams = this.options.vendors.map(vendor => ({
        vendor,
        stream: this.createEventStream(vendor, { events: { generated: 0 } }),
        processed: 0,
      }));

      this.isRunning = true;

      // Process all streams in parallel
      const processingPromises = streams.map(async ({ vendor, stream }) => {
        let processed = 0;
        try {
          for await (const event of streamEvents({ vendor, source: stream })) {
            if (!this.isRunning) break;
            processed++;
            stressResults.totalEvents++;
          }
        } catch (error) {
          console.log(`    ❌ ${vendor} error:`, error.message);
        }
        return processed;
      });

      // Run for stress test duration
      setTimeout(() => {
        this.isRunning = false;
      }, stressResults.duration);

      const eventCounts = await Promise.all(processingPromises);
    } catch (error) {
      console.log(`  ❌ Stress test error: ${error.message}`);
    } finally {
      this.isRunning = false;
      clearInterval(stressMonitor);
    }

    // Final memory measurement
    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    stressResults.memoryGrowth = finalMemory - initialMemory;

    // Display stress test results
    const duration = (Date.now() - stressResults.startTime) / 1000;
    const rate = stressResults.totalEvents / duration;

    console.log(`  ⏱️  Duration: ${duration.toFixed(1)}s`);
    console.log(
      `  📊 Total Events: ${stressResults.totalEvents.toLocaleString()}`,
    );
    console.log(`  📈 Combined Rate: ${rate.toFixed(0)} events/sec`);
    console.log(`  🧠 Memory:`);
    console.log(`     Initial: ${initialMemory.toFixed(2)}MB`);
    console.log(`     Peak: ${stressResults.peakMemory.toFixed(2)}MB`);
    console.log(`     Final: ${finalMemory.toFixed(2)}MB`);
    console.log(
      `     Growth: ${stressResults.memoryGrowth >= 0 ? '+' : ''}${stressResults.memoryGrowth.toFixed(2)}MB`,
    );

    // Memory pressure analysis
    const pressureRatio = stressResults.peakMemory / initialMemory;
    if (pressureRatio < 2.0) {
      console.log(`  ✅ Low memory pressure (${pressureRatio.toFixed(1)}x)`);
    } else if (pressureRatio < 5.0) {
      console.log(
        `  ⚠️  Moderate memory pressure (${pressureRatio.toFixed(1)}x)`,
      );
    } else {
      console.log(`  ❌ High memory pressure (${pressureRatio.toFixed(1)}x)`);
    }

    this.results.push(stressResults);
  }

  /**
   * Generate and output results
   */
  async generateResults() {
    console.log('\n📊 Generating Memory Test Results...');

    const summary = this.generateMemorySummary();

    switch (this.options.format) {
      case 'json':
        await this.generateJSONResults(summary);
        break;
      case 'csv':
        await this.generateCSVResults(summary);
        break;
      case 'console':
      default:
        this.displayMemorySummary(summary);
        break;
    }
  }

  /**
   * Generate memory test summary
   */
  generateMemorySummary() {
    const vendorResults = this.results.filter(r => r.vendor);
    const stressResult = this.results.find(r => !r.vendor);

    const summary = {
      metadata: {
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        options: this.options,
      },
      overall: {
        avgMemoryLeak: 0,
        avgPeakMemory: 0,
        stableVendors: 0,
        totalEvents: 0,
      },
      byVendor: {},
      stressTest: stressResult,
      recommendations: [],
    };

    // Analyze vendor results
    if (vendorResults.length > 0) {
      summary.overall.avgMemoryLeak =
        vendorResults.reduce((sum, r) => sum + r.memory.leaked, 0) /
        vendorResults.length;
      summary.overall.avgPeakMemory =
        vendorResults.reduce((sum, r) => sum + r.memory.peak, 0) /
        vendorResults.length;
      summary.overall.stableVendors = vendorResults.filter(
        r => r.memory.stable,
      ).length;
      summary.overall.totalEvents = vendorResults.reduce(
        (sum, r) => sum + r.events.processed,
        0,
      );

      for (const result of vendorResults) {
        summary.byVendor[result.vendor] = {
          memoryLeak: result.memory.leaked,
          peakMemory: result.memory.peak,
          stable: result.memory.stable,
          eventsProcessed: result.events.processed,
          efficiency: result.events.processed / result.memory.peak, // events per MB
        };
      }
    }

    // Generate recommendations
    summary.recommendations = this.generateMemoryRecommendations(summary);

    return summary;
  }

  /**
   * Generate memory optimization recommendations
   */
  generateMemoryRecommendations(summary) {
    const recommendations = [];

    // Memory leak analysis
    if (summary.overall.avgMemoryLeak > 10) {
      recommendations.push(
        '⚠️ Significant memory leaks detected - investigate event processing lifecycle',
      );
    } else if (summary.overall.avgMemoryLeak > 5) {
      recommendations.push(
        '⚠️ Minor memory leaks detected - monitor long-running processes',
      );
    } else if (summary.overall.avgMemoryLeak < 1) {
      recommendations.push(
        '✅ Excellent memory management - no significant leaks detected',
      );
    }

    // Memory efficiency
    const bestEfficiency = Math.max(
      ...Object.values(summary.byVendor).map(v => v.efficiency),
    );
    const worstEfficiency = Math.min(
      ...Object.values(summary.byVendor).map(v => v.efficiency),
    );

    if (bestEfficiency > 5000) {
      recommendations.push(
        '✅ Excellent memory efficiency - high event throughput per MB',
      );
    }

    if (worstEfficiency < 1000) {
      recommendations.push(
        '⚠️ Some vendors show low memory efficiency - consider optimization',
      );
    }

    // Stability
    if (
      summary.overall.stableVendors === Object.keys(summary.byVendor).length
    ) {
      recommendations.push('✅ All vendors show stable memory usage');
    } else {
      recommendations.push(
        '⚠️ Some vendors show unstable memory growth patterns',
      );
    }

    // Stress test results
    if (summary.stressTest) {
      if (summary.stressTest.memoryGrowth < 50) {
        recommendations.push(
          '✅ Stress test passed - good memory pressure handling',
        );
      } else {
        recommendations.push(
          '⚠️ High memory growth under stress - consider load balancing',
        );
      }
    }

    // Peak memory guidance
    if (summary.overall.avgPeakMemory > 100) {
      recommendations.push(
        '⚠️ High peak memory usage - monitor in production environments',
      );
    } else if (summary.overall.avgPeakMemory < 50) {
      recommendations.push(
        '✅ Low memory footprint - suitable for resource-constrained environments',
      );
    }

    return recommendations;
  }

  /**
   * Display memory summary in console
   */
  displayMemorySummary(summary) {
    console.log('\n🧠 MEMORY BENCHMARK SUMMARY');
    console.log('═'.repeat(60));

    console.log('\n📊 Overall Memory Performance:');
    console.log(
      `   Average Memory Leak: ${summary.overall.avgMemoryLeak.toFixed(2)}MB`,
    );
    console.log(
      `   Average Peak Memory: ${summary.overall.avgPeakMemory.toFixed(2)}MB`,
    );
    console.log(
      `   Stable Vendors: ${summary.overall.stableVendors}/${Object.keys(summary.byVendor).length}`,
    );
    console.log(
      `   Total Events Processed: ${summary.overall.totalEvents.toLocaleString()}`,
    );

    console.log('\n📈 By Vendor:');
    for (const [vendor, stats] of Object.entries(summary.byVendor)) {
      console.log(`   ${vendor.toUpperCase()}:`);
      console.log(
        `     Memory Leak: ${stats.memoryLeak >= 0 ? '+' : ''}${stats.memoryLeak.toFixed(2)}MB`,
      );
      console.log(`     Peak Memory: ${stats.peakMemory.toFixed(2)}MB`);
      console.log(
        `     Stability: ${stats.stable ? '✅ Stable' : '⚠️ Unstable'}`,
      );
      console.log(`     Efficiency: ${stats.efficiency.toFixed(0)} events/MB`);
    }

    if (summary.stressTest) {
      console.log('\n🔥 Stress Test Results:');
      console.log(
        `   Peak Memory: ${summary.stressTest.peakMemory.toFixed(2)}MB`,
      );
      console.log(
        `   Memory Growth: ${summary.stressTest.memoryGrowth >= 0 ? '+' : ''}${summary.stressTest.memoryGrowth.toFixed(2)}MB`,
      );
      console.log(
        `   Total Events: ${summary.stressTest.totalEvents.toLocaleString()}`,
      );
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
      join(__dirname, `../../temp/memory-benchmark-${Date.now()}.json`);

    writeFileSync(outputFile, JSON.stringify(fullResults, null, 2));
    console.log(`📄 JSON results saved to: ${outputFile}`);
  }

  /**
   * Generate CSV results file
   */
  async generateCSVResults(summary) {
    // Memory samples CSV
    const samplesCSV = [
      'Vendor,Timestamp,HeapUsed,HeapTotal,RSS,EventsProcessed',
      ...this.results
        .filter(r => r.vendor)
        .flatMap(result =>
          result.samples.map(
            s =>
              `${result.vendor},${s.timestamp},${s.heapUsed.toFixed(2)},${s.heapTotal.toFixed(2)},${s.rss.toFixed(2)},${s.eventsProcessed}`,
          ),
        ),
    ].join('\n');

    const outputFile =
      this.options.output ||
      join(__dirname, `../../temp/memory-samples-${Date.now()}.csv`);

    writeFileSync(outputFile, samplesCSV);
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
      case '--duration':
        options.duration = parseInt(args[++i]);
        break;
      case '--rate':
        options.rate = parseInt(args[++i]);
        break;
      case '--vendors':
        options.vendors = args[++i].split(',').map(s => s.trim());
        break;
      case '--gc-interval':
        options.gcInterval = parseInt(args[++i]);
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
🧠 Memory Benchmark for Agent Stream Formatter

USAGE:
  node --expose-gc memory-test.js [options]

OPTIONS:
  --duration <seconds>  Test duration (default: 60)
  --rate <events/sec>   Event generation rate (default: 1000)
  --vendors <list>      Vendors to test (default: claude,gemini,amp)
  --gc-interval <ms>    GC interval (default: 5000)
  --output <path>       Results output file
  --format <type>       Results format: json, csv, console (default: console)
  --help                Show this help message

EXAMPLES:
  node --expose-gc memory-test.js
  node --expose-gc memory-test.js --duration 120 --rate 2000
  node --expose-gc memory-test.js --vendors claude,gemini --format json
  node --expose-gc memory-test.js --duration 300 --gc-interval 10000

MEMORY TARGETS:
  • Excellent: <1MB memory growth per hour
  • Good: <5MB memory growth per hour
  • Acceptable: <20MB memory growth per hour
  • Peak Memory: <100MB for continuous streaming
  • Stability: Consistent memory usage pattern

NOTE:
  Run with --expose-gc flag for accurate memory testing
  `);
}

/**
 * Main execution
 */
async function main() {
  console.log('🧠 Agent Stream Formatter - Memory Benchmark\n');

  const options = parseArgs();
  const benchmark = new MemoryBenchmark(options);

  try {
    await benchmark.runBenchmark();
  } catch (error) {
    console.error('\n❌ Memory benchmark failed:', error.message);
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

export default MemoryBenchmark;
