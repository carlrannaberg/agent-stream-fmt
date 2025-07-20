# Performance Guide

This guide provides comprehensive information about agent-stream-fmt's performance characteristics, optimization strategies, and best practices for high-throughput scenarios.

## 📊 Throughput Characteristics

agent-stream-fmt is designed for high-throughput stream processing with vendor-specific optimizations:

### Vendor-Specific Performance

| Vendor     | Lines/sec | Memory/25K lines | Relative Speed |
| ---------- | --------- | ---------------- | -------------- |
| **Claude** | ~900K     | 8.7 MB           | Fastest        |
| **Amp**    | ~800K     | 11.4 MB          | Fast           |
| **Gemini** | ~668K     | 3.2 MB           | Good           |

_Benchmarks run on M1 MacBook Pro with 25,000 lines per test_

### Overall Performance Metrics

- **Peak throughput**: ~1.1M lines/second (mixed workload)
- **Sustained throughput**: 600K-950K lines/second (vendor-specific)
- **Cold start time**: <100ms from CLI invocation
- **First event latency**: <10ms for streaming scenarios

## 🧠 Memory Usage Patterns

The streaming architecture ensures bounded memory usage regardless of input size:

### Memory Characteristics

- **Per event overhead**: ~600 bytes
- **Peak memory (1M lines)**: ~118 MB
- **Memory growth factor**: <2x (sub-linear scaling)
- **Baseline memory**: ~98 MB (Node.js + dependencies)

### Memory Scaling Analysis

| Input Size | Peak Memory | Growth Factor | Efficiency |
| ---------- | ----------- | ------------- | ---------- |
| 1K lines   | 103.1 MB    | -             | -          |
| 10K lines  | 103.5 MB    | 1.07x         | 10.7%      |
| 100K lines | 108.8 MB    | 1.95x         | 19.5%      |
| 1M lines   | 118.2 MB    | 1.87x         | 18.7%      |

**✅ Memory usage is BOUNDED** - grows sub-linearly with input size.

## 🚀 Optimization Strategies

### 1. Use Vendor-Specific Parsers

**Avoid auto-detection** when you know the format to skip detection overhead:

```typescript
// ✅ Faster - direct parser selection
for await (const event of streamEvents({
  vendor: 'claude',
  source,
})) {
  // Process events
}

// ❌ Slower - requires format detection
for await (const event of streamEvents({
  vendor: 'auto',
  source,
})) {
  // Process events
}
```

**Performance impact**: Auto-detection adds overhead due to format sampling and may fail on malformed input. Use specific vendor parsers when format is known for best performance and reliability.

### 2. Filter Events Early

Use CLI filtering to reduce parser workload:

```bash
# ✅ More efficient - parser skips unwanted events
agent-stream-fmt --only tool,error input.jsonl

# ❌ Less efficient - parser processes all events
agent-stream-fmt input.jsonl | grep -E "(tool|error)"
```

**Performance impact**: Early filtering can improve throughput by 15-30% for selective processing.

### 3. Optimize Output Format

Choose the right output format for your use case:

```bash
# ✅ Fastest - minimal processing
agent-stream-fmt --format json     # ~625K lines/sec

# ✅ Medium - structured HTML output
agent-stream-fmt --format html     # ~540K lines/sec

# ❌ Slower - ANSI color processing
agent-stream-fmt --format ansi     # ~358K lines/sec
```

**Performance ranking**: JSON > HTML > ANSI

_Note: ANSI formatting requires color computation which adds overhead_

### 4. Use Streaming APIs

Always use streaming patterns to maintain constant memory usage:

```typescript
// ✅ Excellent - constant memory, immediate processing
for await (const event of streamEvents(options)) {
  await processEvent(event);
}

// ❌ Bad - buffers everything in memory
const allEvents = [];
for await (const event of streamEvents(options)) {
  allEvents.push(event);
}
await processAllEvents(allEvents);
```

### 5. Tune Line Reader Options

Adjust line reader settings for your data characteristics:

```typescript
const options = {
  vendor: 'claude',
  source: inputStream,
  lineReaderOptions: {
    maxLineLength: 10 * 1024 * 1024, // 10MB for large events
    encoding: 'utf8',
  },
};
```

**Guidelines**:

- **Small events** (< 1KB): Use default `maxLineLength` (1MB)
- **Large events** (> 1KB): Increase `maxLineLength` to avoid truncation
- **Binary data**: Use 'binary' encoding, then decode manually

## 💡 Best Practices

### Stream Processing Patterns

```typescript
// ✅ Process events as they arrive
async function processStream(source: NodeJS.ReadableStream) {
  for await (const event of streamEvents({ vendor: 'claude', source })) {
    switch (event.t) {
      case 'msg':
        await handleMessage(event);
        break;
      case 'tool':
        if (event.phase === 'end') {
          await handleToolCompletion(event);
        }
        break;
    }
  }
}

// ✅ Use backpressure control for slow consumers
async function processWithBackpressure(source: NodeJS.ReadableStream) {
  const iterator = streamEvents({ vendor: 'claude', source });

  for await (const event of iterator) {
    await slowProcessing(event);
    // Iterator naturally handles backpressure
  }
}
```

### Error Handling Best Practices

```typescript
// ✅ Robust error handling with continuation
async function robustProcessing(source: NodeJS.ReadableStream) {
  try {
    for await (const event of streamEvents({
      vendor: 'auto',
      source,
      continueOnError: true,
      maxConsecutiveErrors: 50,
    })) {
      if (event.t === 'error') {
        console.warn('Parse error:', event.message);
        continue;
      }

      await processEvent(event);
    }
  } catch (error) {
    console.error('Stream processing failed:', error);
    // Implement retry logic or fallback
  }
}
```

### Memory-Efficient Large File Processing

```typescript
// ✅ Process large files without memory growth
import { createReadStream } from 'fs';

async function processLargeFile(filePath: string) {
  const stream = createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: 64 * 1024, // 64KB chunks
  });

  let eventCount = 0;
  const startTime = Date.now();

  for await (const event of streamEvents({ vendor: 'auto', stream })) {
    eventCount++;

    // Process event immediately, don't accumulate
    await processEvent(event);

    // Optional: progress reporting
    if (eventCount % 10000 === 0) {
      const elapsed = Date.now() - startTime;
      const rate = eventCount / (elapsed / 1000);
      console.log(
        `Processed ${eventCount} events at ${rate.toFixed(0)} events/sec`,
      );
    }
  }
}
```

## ⚠️ Performance Anti-Patterns

### 1. Avoid Accumulating Events

```typescript
// ❌ Memory leak - accumulates all events
const allEvents: AgentEvent[] = [];
for await (const event of streamEvents(options)) {
  allEvents.push(event);
}

// ✅ Process immediately
for await (const event of streamEvents(options)) {
  await processEvent(event);
}
```

### 2. Don't Use Synchronous Processing

```typescript
// ❌ Blocks event loop
for await (const event of streamEvents(options)) {
  processEventSync(event); // Synchronous processing
}

// ✅ Use async processing
for await (const event of streamEvents(options)) {
  await processEventAsync(event);
}
```

### 3. Avoid Excessive JSON Serialization

```typescript
// ❌ Unnecessary serialization overhead
for await (const event of streamEvents(options)) {
  const serialized = JSON.stringify(event);
  const parsed = JSON.parse(serialized);
  await processEvent(parsed);
}

// ✅ Work with objects directly
for await (const event of streamEvents(options)) {
  await processEvent(event);
}
```

## 🧪 Performance Testing

### Running Benchmarks

Test performance with the included benchmark suite:

```bash
# Overall throughput test
npm run benchmark:throughput

# Memory usage analysis
npm run benchmark:memory

# Vendor-specific performance
npm run benchmark:all
```

### Custom Performance Testing

Create your own performance tests:

```typescript
// Custom throughput test
async function measureThroughput(vendor: Vendor, lineCount: number) {
  const testData = generateTestData(lineCount);
  const start = performance.now();

  let eventCount = 0;
  for await (const event of streamEvents({ vendor, source: testData })) {
    eventCount++;
  }

  const elapsed = performance.now() - start;
  const linesPerSec = lineCount / (elapsed / 1000);

  console.log(`${vendor}: ${linesPerSec.toFixed(0)} lines/sec`);
  return { vendor, linesPerSec, eventCount, elapsed };
}
```

### Memory Profiling

Monitor memory usage during processing:

```bash
# Run with garbage collection exposed for accurate measurements
node --expose-gc --max-old-space-size=512 dist/cli.js < large-file.jsonl

# Profile with Node.js inspector
node --inspect --inspect-brk dist/cli.js < test-data.jsonl
```

## 📈 Performance Monitoring

### Production Monitoring

```typescript
// Monitor performance in production
class PerformanceMonitor {
  private eventCount = 0;
  private startTime = Date.now();
  private lastReport = Date.now();

  onEvent(event: AgentEvent) {
    this.eventCount++;

    // Report every 10 seconds
    const now = Date.now();
    if (now - this.lastReport > 10000) {
      this.report();
      this.lastReport = now;
    }
  }

  private report() {
    const elapsed = Date.now() - this.startTime;
    const eventsPerSec = this.eventCount / (elapsed / 1000);
    const memoryUsage = process.memoryUsage();

    console.log({
      eventsPerSec: eventsPerSec.toFixed(0),
      totalEvents: this.eventCount,
      memoryMB: (memoryUsage.rss / 1024 / 1024).toFixed(1),
      uptimeMs: elapsed,
    });
  }
}
```

### Health Checks

```typescript
// Performance health check
export function checkPerformance(): { healthy: boolean; metrics: any } {
  const metrics = {
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    version: process.version,
  };

  const memoryMB = metrics.memoryUsage.rss / 1024 / 1024;
  const healthy = memoryMB < 500; // Alert if over 500MB

  return { healthy, metrics };
}
```

## 🔧 Environment Optimization

### Node.js Tuning

Optimize Node.js for high-throughput scenarios:

```bash
# Increase memory limits for large datasets
node --max-old-space-size=8192 dist/cli.js

# Optimize garbage collection
node --gc-interval=100 dist/cli.js

# Use multiple threads for parsing (if applicable)
node --experimental-worker dist/cli.js
```

### System-Level Optimization

- **File system**: Use SSDs for large file processing
- **Memory**: Ensure adequate RAM (>= 4GB recommended)
- **CPU**: Multi-core systems benefit from concurrent processing
- **Network**: High bandwidth for remote stream processing

## 📋 Performance Checklist

Before deploying to production:

- [ ] **Choose specific vendor** instead of 'auto' when format is known
- [ ] **Use appropriate filtering** to reduce processing overhead
- [ ] **Select optimal output format** for your use case
- [ ] **Implement proper error handling** with bounded retries
- [ ] **Monitor memory usage** to detect potential leaks
- [ ] **Test with representative data** sizes and patterns
- [ ] **Set up performance monitoring** and alerting
- [ ] **Configure appropriate Node.js memory limits**

## 🔗 Related Resources

- [Benchmarking Scripts](../benchmarks/) - Run your own performance tests
- [Architecture Guide](./architecture.md) - Understanding the streaming design
- [API Reference](./api/) - Complete API documentation
- [Contributing Guide](../CONTRIBUTING.md) - Performance testing guidelines

---

**Next**: [Architecture Guide](./architecture.md) | **Previous**: [API Reference](./api/)
