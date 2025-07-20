#!/usr/bin/env node

/**
 * Robust Error Handling Examples
 *
 * This example demonstrates comprehensive error handling patterns for
 * robust streaming applications. It shows how to:
 *
 * 1. Handle malformed JSON input gracefully
 * 2. Recover from parser errors
 * 3. Implement fallback strategies
 * 4. Track and report error statistics
 * 5. Build resilient streaming pipelines
 *
 * Run this example:
 *   node examples/advanced/error-handling.js
 */

import { streamEvents, ParseError } from 'agent-stream-fmt';
import { createReadStream, writeFileSync } from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Example 1: Basic error handling with try-catch
 */
async function basicErrorHandling() {
  console.log('=== Example 1: Basic Error Handling ===\n');

  // Create a stream with some malformed JSON
  const malformedInput = [
    '{"type":"message","role":"user","content":"Hello"}',
    '{"type":"message","role":"assistant"', // Malformed - missing closing
    '{"type":"message","role":"assistant","content":"Fixed message"}',
    'not even json',
    '{"type":"cost","delta_usd":0.001}',
  ].join('\n');

  const input = Readable.from([malformedInput]);

  console.log('Processing input with malformed JSON:\n');

  try {
    let validEvents = 0;
    let errorCount = 0;

    for await (const event of streamEvents({
      vendor: 'auto',
      source: input,
    })) {
      if (event.t === 'error') {
        errorCount++;
        console.log(`❌ Parse Error ${errorCount}: ${event.message}`);
      } else {
        validEvents++;
        console.log(`✅ Valid Event ${validEvents}: ${event.t}`);

        if (event.t === 'msg') {
          console.log(`   ${event.role}: ${event.text}`);
        }
      }
    }

    console.log(
      `\nSummary: ${validEvents} valid events, ${errorCount} errors\n`,
    );
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

/**
 * Example 2: Custom error recovery with retry logic
 */
async function errorRecoveryWithRetry() {
  console.log('=== Example 2: Error Recovery with Retry ===\n');

  // Simulate unstable input source
  class UnstableInputStream extends Readable {
    constructor(data, options = {}) {
      super({ objectMode: false });
      this.lines = data.split('\n');
      this.index = 0;
      this.failureRate = options.failureRate || 0.2;
      this.retryCount = options.retryCount || 3;
    }

    _read() {
      if (this.index >= this.lines.length) {
        this.push(null);
        return;
      }

      const line = this.lines[this.index++];

      // Simulate occasional failures
      if (Math.random() < this.failureRate) {
        // Corrupt the line to simulate transmission errors
        const corrupted = line.slice(0, Math.floor(line.length * 0.7));
        this.push(corrupted + '\n');
      } else {
        this.push(line + '\n');
      }
    }
  }

  const testData = [
    '{"type":"message","role":"user","content":"Start session"}',
    '{"type":"message","role":"assistant","content":"Session started"}',
    '{"type":"tool","name":"read_file","phase":"start"}',
    '{"type":"tool","name":"read_file","phase":"stdout","text":"File contents"}',
    '{"type":"tool","name":"read_file","phase":"end","exit_code":0}',
    '{"type":"cost","delta_usd":0.002}',
  ].join('\n');

  const unstableInput = new UnstableInputStream(testData, { failureRate: 0.3 });

  console.log('Processing unstable input with retry logic:\n');

  const errorStats = {
    parseErrors: 0,
    recovered: 0,
    failed: 0,
  };

  try {
    for await (const event of streamEvents({
      vendor: 'auto',
      source: unstableInput,
    })) {
      if (event.t === 'error') {
        errorStats.parseErrors++;
        console.log(
          `🔄 Parse error detected: ${event.message.substring(0, 50)}...`,
        );

        // In a real application, you might implement retry logic here
        // For demo, we just count and continue
        errorStats.recovered++;
      } else {
        console.log(`✅ Processed: ${event.t}`);
      }
    }

    console.log('\nError Recovery Statistics:');
    console.log(`  Parse Errors: ${errorStats.parseErrors}`);
    console.log(`  Recovered: ${errorStats.recovered}`);
    console.log(`  Failed: ${errorStats.failed}`);
    console.log(
      `  Recovery Rate: ${((errorStats.recovered / Math.max(errorStats.parseErrors, 1)) * 100).toFixed(1)}%\n`,
    );
  } catch (error) {
    console.error('Fatal error:', error.message);
  }
}

/**
 * Example 3: Comprehensive error tracking and reporting
 */
async function comprehensiveErrorTracking() {
  console.log('=== Example 3: Comprehensive Error Tracking ===\n');

  // Create problematic input mixing multiple vendor formats and errors
  const problematicInput = [
    '{"type":"message","role":"user","content":"Valid Claude message"}',
    '{"event":"content","content":"Gemini format"}', // Different format
    '{"invalid":"json","missing":"required_fields"}', // Invalid structure
    'plain text line', // Not JSON at all
    '{"type":"message","role":"user"}', // Missing content
    '{"type":"tool","name":"test","phase":"invalid_phase"}', // Invalid enum
    '{"type":"cost","delta_usd":"not_a_number"}', // Type error
    '{"type":"message","role":"assistant","content":"Another valid message"}',
  ].join('\n');

  const input = Readable.from([problematicInput]);

  console.log('Tracking various error types:\n');

  const errorTracker = {
    byType: {},
    byLine: [],
    patterns: {},
    total: 0,
  };

  let lineNumber = 0;
  let validEvents = 0;

  try {
    for await (const event of streamEvents({
      vendor: 'auto',
      source: input,
    })) {
      if (event.t === 'error') {
        errorTracker.total++;

        // Categorize error types
        const errorType = categorizeError(event.message);
        errorTracker.byType[errorType] =
          (errorTracker.byType[errorType] || 0) + 1;

        // Track pattern
        const pattern = extractErrorPattern(event.message);
        errorTracker.patterns[pattern] =
          (errorTracker.patterns[pattern] || 0) + 1;

        // Record line-specific error
        errorTracker.byLine.push({
          line: lineNumber,
          type: errorType,
          message: event.message,
          pattern: pattern,
        });

        console.log(`Line ${lineNumber}: [${errorType}] ${event.message}`);
      } else {
        validEvents++;
        console.log(`Line ${lineNumber}: ✅ Valid ${event.t} event`);
      }

      lineNumber++;
    }

    console.log('\n=== Error Analysis Report ===');
    console.log(`Total Events: ${lineNumber}`);
    console.log(`Valid Events: ${validEvents}`);
    console.log(`Error Events: ${errorTracker.total}`);
    console.log(
      `Error Rate: ${((errorTracker.total / lineNumber) * 100).toFixed(1)}%\n`,
    );

    console.log('Error Types:');
    for (const [type, count] of Object.entries(errorTracker.byType)) {
      console.log(`  ${type}: ${count}`);
    }

    console.log('\nError Patterns:');
    for (const [pattern, count] of Object.entries(errorTracker.patterns)) {
      console.log(`  ${pattern}: ${count}`);
    }

    console.log('\nMost Common Errors:');
    const sortedErrors = Object.entries(errorTracker.byType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    for (const [type, count] of sortedErrors) {
      const percentage = ((count / errorTracker.total) * 100).toFixed(1);
      console.log(`  ${type}: ${count} (${percentage}%)`);
    }
  } catch (error) {
    console.error('Fatal error in error tracking:', error.message);
  }
}

/**
 * Helper function to categorize error types
 */
function categorizeError(message) {
  if (message.includes('JSON')) return 'JSON_PARSE';
  if (message.includes('required')) return 'MISSING_FIELD';
  if (message.includes('type')) return 'TYPE_ERROR';
  if (message.includes('enum')) return 'ENUM_ERROR';
  if (message.includes('format')) return 'FORMAT_ERROR';
  return 'UNKNOWN';
}

/**
 * Helper function to extract error patterns
 */
function extractErrorPattern(message) {
  // Extract common error patterns for analysis
  if (message.includes('Unexpected token')) return 'MALFORMED_JSON';
  if (message.includes('missing property')) return 'MISSING_PROPERTY';
  if (message.includes('invalid value')) return 'INVALID_VALUE';
  if (message.includes('unknown field')) return 'UNKNOWN_FIELD';
  return 'OTHER';
}

/**
 * Example 4: Circuit breaker pattern for error handling
 */
async function circuitBreakerPattern() {
  console.log('=== Example 4: Circuit Breaker Pattern ===\n');

  class CircuitBreaker {
    constructor(options = {}) {
      this.failureThreshold = options.failureThreshold || 5;
      this.recoveryTimeMs = options.recoveryTimeMs || 5000;
      this.monitoringWindowMs = options.monitoringWindowMs || 10000;

      this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
      this.failures = 0;
      this.lastFailureTime = 0;
      this.successes = 0;
    }

    async execute(fn) {
      if (this.state === 'OPEN') {
        if (Date.now() - this.lastFailureTime > this.recoveryTimeMs) {
          this.state = 'HALF_OPEN';
          console.log('🔄 Circuit breaker: Attempting recovery...');
        } else {
          throw new Error('Circuit breaker is OPEN - service unavailable');
        }
      }

      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    }

    onSuccess() {
      this.failures = 0;
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        console.log('✅ Circuit breaker: Service recovered, state = CLOSED');
      }
      this.successes++;
    }

    onFailure() {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        console.log(`🚨 Circuit breaker: OPEN (${this.failures} failures)`);
      }
    }

    getStats() {
      return {
        state: this.state,
        failures: this.failures,
        successes: this.successes,
        lastFailureTime: this.lastFailureTime,
      };
    }
  }

  // Simulate a flaky data source
  const flakyInput = () => {
    const shouldFail = Math.random() < 0.4; // 40% failure rate

    if (shouldFail) {
      return Readable.from(['invalid json line\n']);
    } else {
      return Readable.from([
        '{"type":"message","role":"assistant","content":"Success"}\n',
      ]);
    }
  };

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeMs: 2000,
  });

  console.log('Testing circuit breaker with flaky input source:\n');

  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      console.log(`Attempt ${attempt}:`);

      await circuitBreaker.execute(async () => {
        const input = flakyInput();
        let hasError = false;

        for await (const event of streamEvents({
          vendor: 'auto',
          source: input,
        })) {
          if (event.t === 'error') {
            hasError = true;
            throw new Error(`Parse error: ${event.message}`);
          }
        }

        if (!hasError) {
          console.log('  ✅ Success');
        }
      });
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
    }

    // Show circuit breaker stats
    const stats = circuitBreaker.getStats();
    console.log(
      `  State: ${stats.state}, Failures: ${stats.failures}, Successes: ${stats.successes}\n`,
    );

    // Wait a bit between attempts
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Example 5: Error aggregation and batch reporting
 */
async function errorAggregationAndReporting() {
  console.log('=== Example 5: Error Aggregation and Reporting ===\n');

  class ErrorAggregator {
    constructor(options = {}) {
      this.reportIntervalMs = options.reportIntervalMs || 5000;
      this.maxErrors = options.maxErrors || 100;
      this.errors = [];
      this.stats = {
        total: 0,
        byType: {},
        byHour: {},
      };
    }

    recordError(error, context = {}) {
      const timestamp = new Date();
      const errorRecord = {
        timestamp,
        message: error.message || error,
        type: this.categorizeError(error.message || error),
        context,
        hour: timestamp.getHours(),
      };

      this.errors.push(errorRecord);
      this.stats.total++;
      this.stats.byType[errorRecord.type] =
        (this.stats.byType[errorRecord.type] || 0) + 1;
      this.stats.byHour[errorRecord.hour] =
        (this.stats.byHour[errorRecord.hour] || 0) + 1;

      // Keep only recent errors to prevent memory growth
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors);
      }
    }

    categorizeError(message) {
      if (message.includes('JSON')) return 'PARSE_ERROR';
      if (message.includes('required')) return 'VALIDATION_ERROR';
      if (message.includes('timeout')) return 'TIMEOUT_ERROR';
      if (message.includes('network')) return 'NETWORK_ERROR';
      return 'UNKNOWN_ERROR';
    }

    generateReport() {
      const now = new Date();
      const recentErrors = this.errors.filter(
        e => now - e.timestamp < this.reportIntervalMs * 2,
      );

      return {
        generated: now.toISOString(),
        interval_ms: this.reportIntervalMs,
        total_errors: this.stats.total,
        recent_errors: recentErrors.length,
        error_rate: this.calculateErrorRate(),
        by_type: this.stats.byType,
        by_hour: this.stats.byHour,
        recent_samples: recentErrors.slice(-5).map(e => ({
          timestamp: e.timestamp.toISOString(),
          type: e.type,
          message: e.message.substring(0, 100),
        })),
      };
    }

    calculateErrorRate() {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentErrors = this.errors.filter(e => e.timestamp > oneHourAgo);
      return (recentErrors.length / 60).toFixed(2); // errors per minute
    }
  }

  const aggregator = new ErrorAggregator({ reportIntervalMs: 2000 });

  // Simulate processing with various error types
  const errorSources = [
    'Invalid JSON: Unexpected token',
    'Validation error: missing required field "type"',
    'Network timeout: connection failed',
    'Parse error: invalid enum value',
    'Unknown field: "invalid_field"',
  ];

  console.log('Collecting errors for aggregation...\n');

  // Simulate error collection over time
  for (let i = 0; i < 20; i++) {
    const errorMessage =
      errorSources[Math.floor(Math.random() * errorSources.length)];
    const context = {
      source: 'simulation',
      line: i + 1,
      vendor: ['claude', 'gemini', 'amp'][Math.floor(Math.random() * 3)],
    };

    aggregator.recordError(new Error(errorMessage), context);
    console.log(`Error ${i + 1}: ${errorMessage}`);

    // Generate periodic reports
    if ((i + 1) % 7 === 0) {
      console.log('\n--- Error Report ---');
      const report = aggregator.generateReport();
      console.log(`Total errors: ${report.total_errors}`);
      console.log(`Error rate: ${report.error_rate} errors/min`);
      console.log('By type:', JSON.stringify(report.by_type, null, 2));
      console.log('Recent samples:', report.recent_samples.length);
      console.log('');
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Final comprehensive report
  console.log('\n=== Final Error Report ===');
  const finalReport = aggregator.generateReport();

  // Save report to file
  const reportPath = join(__dirname, '../../temp/error-report.json');
  writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  console.log(`Detailed report saved to: ${reportPath}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('Agent Stream Formatter - Error Handling Examples\n');
  console.log('This demonstrates robust error handling patterns.\n');

  try {
    await basicErrorHandling();
    await errorRecoveryWithRetry();
    await comprehensiveErrorTracking();
    await circuitBreakerPattern();
    await errorAggregationAndReporting();

    console.log('\n=== Error Handling Examples Complete ===');
    console.log('\nKey patterns demonstrated:');
    console.log('- Graceful degradation with try-catch');
    console.log('- Error categorization and tracking');
    console.log('- Circuit breaker for failure protection');
    console.log('- Error aggregation and reporting');
    console.log('- Recovery strategies and retry logic');

    console.log('\nNext steps:');
    console.log(
      '- Try performance examples: node examples/advanced/performance.js',
    );
    console.log(
      '- Explore multi-vendor handling: node examples/advanced/multi-vendor.js',
    );
    console.log('- Check integration examples: ls examples/integrations/');
  } catch (error) {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
