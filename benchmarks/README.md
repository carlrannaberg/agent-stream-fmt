# Performance Benchmarks

This directory contains performance benchmarks for the agent-stream-fmt streaming engine.

## Available Benchmarks

### 1. Throughput Benchmark (`throughput.ts`)

Measures the streaming engine's throughput performance:

- Processes 100,000 test lines
- Reports lines/second throughput
- Monitors memory usage (RSS)
- Calculates average processing time per line

### 2. Memory Benchmark (`memory.ts`)

Verifies bounded memory usage for large files:

- Tests with increasing input sizes (1K, 10K, 100K, 1M lines)
- Monitors peak, average, and final memory usage
- Analyzes memory growth patterns
- Verifies constant memory usage regardless of input size

## Running Benchmarks

### Option 1: Using the run script

```bash
./benchmarks/run-benchmarks.sh
```

### Option 2: Using npm scripts

```bash
# Run throughput benchmark
npm run benchmark:throughput

# Run memory benchmark with garbage collection exposed
npm run benchmark:memory

# Run all benchmarks
npm run benchmark:all
```

### Option 3: Using tsx directly

```bash
# Run throughput benchmark
npx tsx benchmarks/throughput.ts

# Run memory benchmark with garbage collection exposed
npx tsx --expose-gc benchmarks/memory.ts
```

## Benchmark Details

### Throughput Benchmark

- Generates 100,000 JSONL lines with test messages
- Streams data through the parsing engine
- Measures total processing time and calculates throughput
- Reports memory usage at completion

### Memory Benchmark

- Tests with progressively larger inputs
- Monitors memory usage during processing
- Analyzes memory growth patterns to verify O(1) memory complexity
- Provides detailed memory usage statistics and growth analysis

## Expected Results

### Throughput

- Should process > 100,000 lines/second on modern hardware
- Memory usage should remain bounded

### Memory

- Memory growth should be sub-linear (ideally constant)
- Peak memory usage should not scale with input size
- No memory leaks should be detected

## Notes

- The `--expose-gc` flag enables manual garbage collection for more accurate memory measurements
- Benchmarks use the compiled JavaScript output from the `dist` directory
- Results may vary based on system specifications and current load
