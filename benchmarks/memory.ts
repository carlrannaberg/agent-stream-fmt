/**
 * Memory benchmark for agent-stream-fmt
 * Verifies bounded memory usage for large files
 */
import { streamEvents } from '../src/index.js';
import { Readable } from 'stream';

async function measureMemoryUsage(lineCount: number): Promise<{
  peakMemory: number;
  averageMemory: number;
  finalMemory: number;
  processedEvents: number;
}> {
  const testLine = '{"type":"message","content":"Test message for memory benchmarking"}\n';
  const chunkSize = 1000; // Process in chunks to simulate streaming
  
  const initialMemory = process.memoryUsage().rss;
  let peakMemory = initialMemory;
  let totalMemory = 0;
  let measurements = 0;
  let processedEvents = 0;
  
  // Create a stream that generates data on demand
  const stream = new Readable({
    read() {
      if (lineCount > 0) {
        const chunk = Math.min(chunkSize, lineCount);
        this.push(testLine.repeat(chunk));
        lineCount -= chunk;
      } else {
        this.push(null); // End stream
      }
    }
  });
  
  // Monitor memory during processing
  const memoryInterval = setInterval(() => {
    const currentMemory = process.memoryUsage().rss;
    peakMemory = Math.max(peakMemory, currentMemory);
    totalMemory += currentMemory;
    measurements++;
  }, 100); // Sample every 100ms for better coverage
  
  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: stream
    })) {
      processedEvents++;
    }
  } finally {
    clearInterval(memoryInterval);
  }
  
  const finalMemory = process.memoryUsage().rss;
  const averageMemory = totalMemory / measurements;
  
  return {
    peakMemory,
    averageMemory,
    finalMemory,
    processedEvents
  };
}

async function runMemoryBenchmark() {
  console.log('Memory Benchmark for agent-stream-fmt');
  console.log('====================================\n');
  
  const testSizes = [
    { lines: 1_000, label: '1K' },
    { lines: 10_000, label: '10K' },
    { lines: 100_000, label: '100K' },
    { lines: 1_000_000, label: '1M' }
  ];
  
  const results: any[] = [];
  
  // Force garbage collection before starting (if available)
  if (global.gc) {
    global.gc();
  }
  
  const baselineMemory = process.memoryUsage().rss;
  console.log(`Baseline memory: ${(baselineMemory / 1024 / 1024).toFixed(2)} MB\n`);
  
  for (const { lines, label } of testSizes) {
    console.log(`Testing ${label} lines (${lines.toLocaleString()})...`);
    
    const start = Date.now();
    const result = await measureMemoryUsage(lines);
    const elapsed = Date.now() - start;
    
    const peakMB = result.peakMemory / 1024 / 1024;
    const avgMB = result.averageMemory / 1024 / 1024;
    const finalMB = result.finalMemory / 1024 / 1024;
    const baselineMB = baselineMemory / 1024 / 1024;
    
    results.push({
      lines,
      label,
      peakMemory: peakMB,
      averageMemory: avgMB,
      finalMemory: finalMB,
      peakDelta: peakMB - baselineMB,
      processedEvents: result.processedEvents,
      timeMs: elapsed
    });
    
    console.log(`  Processed: ${result.processedEvents.toLocaleString()} events`);
    console.log(`  Time: ${elapsed.toLocaleString()} ms`);
    console.log(`  Peak memory: ${peakMB.toFixed(2)} MB (+${(peakMB - baselineMB).toFixed(2)} MB)`);
    console.log(`  Average memory: ${avgMB.toFixed(2)} MB`);
    console.log(`  Final memory: ${finalMB.toFixed(2)} MB\n`);
    
    // Force garbage collection between tests (if available)
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Analyze results
  console.log('\nMemory Usage Analysis:');
  console.log('=====================');
  
  // Check if memory usage is bounded
  const memoryGrowthRates = results.slice(1).map((result, i) => ({
    from: results[i].label,
    to: result.label,
    growthFactor: result.lines / results[i].lines,
    memoryGrowthFactor: result.peakDelta / results[i].peakDelta
  }));
  
  console.log('\nMemory Growth Analysis:');
  memoryGrowthRates.forEach(({ from, to, growthFactor, memoryGrowthFactor }) => {
    const efficiency = memoryGrowthFactor / growthFactor;
    console.log(`  ${from} → ${to}: Input ×${growthFactor}, Memory ×${memoryGrowthFactor.toFixed(2)} (Efficiency: ${(efficiency * 100).toFixed(1)}%)`);
  });
  
  // Check if memory is bounded
  const maxGrowthFactor = Math.max(...memoryGrowthRates.map(r => r.memoryGrowthFactor));
  const isBounded = maxGrowthFactor < 2; // Memory should grow sub-linearly
  
  console.log(`\nMemory usage is ${isBounded ? '✓ BOUNDED' : '✗ UNBOUNDED'}`);
  console.log(`Maximum memory growth factor: ${maxGrowthFactor.toFixed(2)}x`);
  
  // Summary table
  console.log('\nSummary Table:');
  console.log('Lines     | Time (ms) | Peak Mem | Avg Mem  | Lines/sec');
  console.log('----------|-----------|----------|----------|----------');
  results.forEach(r => {
    const linesPerSec = (r.lines / (r.timeMs / 1000)).toFixed(0);
    console.log(
      `${r.label.padEnd(9)} | ` +
      `${r.timeMs.toString().padStart(9)} | ` +
      `${r.peakMemory.toFixed(1).padStart(8)} | ` +
      `${r.averageMemory.toFixed(1).padStart(8)} | ` +
      `${linesPerSec.padStart(9)}`
    );
  });
}

// Enable --expose-gc flag message
if (!global.gc) {
  console.log('Note: Run with --expose-gc flag for more accurate memory measurements');
  console.log('Example: node --expose-gc benchmarks/memory.js\n');
}

// Run the benchmark
runMemoryBenchmark().catch(console.error);