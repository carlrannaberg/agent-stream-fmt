/**
 * Throughput benchmark for agent-stream-fmt
 * Tests streaming performance with 100,000 lines
 */
import { streamEvents } from '../src/index.js';
import { Readable } from 'stream';

async function runBenchmark() {
  const lines = 100_000;
  const testLine =
    '{"type":"message","content":"Test message for benchmarking"}\n';
  const data = testLine.repeat(lines);

  // eslint-disable-next-line no-console
  console.log(
    `Starting throughput benchmark with ${lines.toLocaleString()} lines...`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `Total data size: ${(data.length / 1024 / 1024).toFixed(2)} MB\n`,
  );

  const start = process.hrtime.bigint();
  const initialMemory = process.memoryUsage().rss;
  let count = 0;

  try {
    for await (const _event of streamEvents({
      vendor: 'claude',
      source: Readable.from(data),
    })) {
      count++;
    }

    const elapsed = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsed) / 1_000_000;
    const elapsedSec = elapsedMs / 1_000;
    const linesPerSec = lines / elapsedSec;
    const finalMemory = process.memoryUsage().rss;
    const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024;

    // eslint-disable-next-line no-console
    console.log('Benchmark Results:');
    // eslint-disable-next-line no-console
    console.log('==================');
    // eslint-disable-next-line no-console
    console.log(
      `Processed: ${count.toLocaleString()} events from ${lines.toLocaleString()} lines`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `Time: ${elapsedMs.toFixed(2)} ms (${elapsedSec.toFixed(2)} seconds)`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `Throughput: ${linesPerSec.toFixed(0).toLocaleString()} lines/sec`,
    );
    // eslint-disable-next-line no-console
    console.log(`Memory RSS: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    // eslint-disable-next-line no-console
    console.log(
      `Memory Delta: ${memoryUsed > 0 ? '+' : ''}${memoryUsed.toFixed(2)} MB`,
    );
    // eslint-disable-next-line no-console
    console.log(`Average time per line: ${(elapsedMs / lines).toFixed(4)} ms`);
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

// Run the benchmark
runBenchmark().catch(console.error);
