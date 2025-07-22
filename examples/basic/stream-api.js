#!/usr/bin/env node

/**
 * Basic Stream API Usage Example
 *
 * This example demonstrates the fundamental streaming API for processing
 * AI agent CLI outputs. It shows how to:
 *
 * 1. Parse JSONL input from different vendors
 * 2. Process events in real-time
 * 3. Handle different event types
 * 4. Use formatted output streams
 *
 * Run this example:
 *   node examples/basic/stream-api.js
 *
 * Or pipe data to it:
 *   cat tests/fixtures/claude/basic-message.jsonl | node examples/basic/stream-api.js
 */

import { streamEvents, streamFormat } from 'agent-stream-fmt';
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Example 1: Basic event streaming with manual event handling
 */
async function basicEventStreaming() {
  console.log('=== Example 1: Basic Event Streaming ===\n');

  // Use a sample fixture file for demonstration
  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/basic-message.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  try {
    // Stream events with auto-detection
    for await (const event of streamEvents({
      vendor: 'auto', // Auto-detect vendor from input
      source: input,
    })) {
      // Handle different event types
      switch (event.t) {
        case 'msg':
          console.log(`💬 ${event.role.toUpperCase()}: ${event.text}`);
          break;

        case 'tool':
          if (event.phase === 'start') {
            console.log(`🔧 Running tool: ${event.name}`);
          } else if (event.phase === 'stdout' && event.text) {
            console.log(`   Output: ${event.text.trim()}`);
          } else if (event.phase === 'end') {
            const status = event.exitCode === 0 ? '✅' : '❌';
            console.log(
              `   ${status} Tool finished (exit code: ${event.exitCode})`,
            );
          }
          break;

        case 'cost':
          console.log(`💰 Cost: $${event.deltaUsd.toFixed(4)}`);
          break;

        case 'error':
          console.log(`❌ Error: ${event.message}`);
          break;

        case 'debug':
          console.log(`🐛 Debug: ${JSON.stringify(event.raw, null, 2)}`);
          break;

        default:
          console.log(`❓ Unknown event type: ${event.t}`);
      }
    }
  } catch (error) {
    console.error('Error streaming events:', error.message);
  }
}

/**
 * Example 2: Using formatted output streams
 */
async function formattedStreaming() {
  console.log('\n=== Example 2: Formatted Output Streaming ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/tool-use.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  try {
    // Stream with ANSI formatting (same as CLI default)
    for await (const formatted of streamFormat({
      vendor: 'claude',
      source: input,
      format: 'ansi',
      hideTools: false,
      collapseTools: true, // Collapse tool output for cleaner display
    })) {
      process.stdout.write(formatted);
    }
  } catch (error) {
    console.error('Error streaming formatted output:', error.message);
  }
}

/**
 * Example 3: Processing from stdin
 */
async function processStdin() {
  console.log('\n=== Example 3: Processing from stdin ===\n');
  console.log('This example processes input from stdin.');
  console.log(
    'Try: echo \'{"type":"message","role":"assistant","content":"Hello!"}\' | node examples/basic/stream-api.js\n',
  );

  // Check if we have stdin input
  if (process.stdin.isTTY) {
    console.log('No stdin input detected. Using sample data instead.\n');
    return;
  }

  try {
    let eventCount = 0;

    for await (const event of streamEvents({
      vendor: 'auto',
      source: process.stdin,
    })) {
      eventCount++;

      console.log(`Event ${eventCount}: ${event.t}`);

      // Show condensed view of each event
      switch (event.t) {
        case 'msg':
          console.log(
            `  Role: ${event.role}, Text: "${event.text.substring(0, 50)}${event.text.length > 50 ? '...' : ''}"`,
          );
          break;
        case 'tool':
          console.log(`  Tool: ${event.name}, Phase: ${event.phase}`);
          break;
        case 'cost':
          console.log(`  Cost: $${event.deltaUsd}`);
          break;
        case 'error':
          console.log(`  Message: ${event.message}`);
          break;
        case 'debug':
          console.log(
            `  Raw: ${JSON.stringify(event.raw).substring(0, 100)}...`,
          );
          break;
      }
    }

    console.log(`\nProcessed ${eventCount} events total.`);
  } catch (error) {
    console.error('Error processing stdin:', error.message);
  }
}

/**
 * Example 4: Event filtering and counting
 */
async function eventAnalysis() {
  console.log('\n=== Example 4: Event Analysis ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/complex-session.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  const stats = {
    total: 0,
    messages: 0,
    tools: 0,
    costs: 0,
    errors: 0,
    debug: 0,
  };

  const toolNames = new Set();
  let totalCost = 0;

  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      stats.total++;

      switch (event.t) {
        case 'msg':
          stats.messages++;
          break;
        case 'tool':
          stats.tools++;
          toolNames.add(event.name);
          break;
        case 'cost':
          stats.costs++;
          totalCost += event.deltaUsd;
          break;
        case 'error':
          stats.errors++;
          break;
        case 'debug':
          stats.debug++;
          break;
      }
    }

    console.log('Session Analysis:');
    console.log(`  Total events: ${stats.total}`);
    console.log(`  Messages: ${stats.messages}`);
    console.log(`  Tool events: ${stats.tools}`);
    console.log(`  Cost events: ${stats.costs}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Debug events: ${stats.debug}`);
    console.log(`  Tools used: ${Array.from(toolNames).join(', ')}`);
    console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  } catch (error) {
    console.error('Error analyzing events:', error.message);
  }
}

/**
 * Example 5: Multi-vendor processing
 */
async function multiVendorExample() {
  console.log('\n=== Example 5: Multi-Vendor Processing ===\n');

  const vendors = [
    { name: 'Claude', path: '../../tests/fixtures/claude/basic-message.jsonl' },
    { name: 'Gemini', path: '../../tests/fixtures/gemini/basic-content.txt' },
    { name: 'Amp', path: '../../tests/fixtures/amp/simple-task.jsonl' },
  ];

  for (const vendor of vendors) {
    console.log(`\n--- Processing ${vendor.name} output ---`);

    try {
      const fixturePath = join(__dirname, vendor.path);
      const input = createReadStream(fixturePath, { encoding: 'utf8' });

      let eventCount = 0;
      for await (const event of streamEvents({
        vendor: 'auto', // Let it auto-detect
        source: input,
      })) {
        eventCount++;
      }

      console.log(`${vendor.name}: Processed ${eventCount} events`);
    } catch (error) {
      console.log(`${vendor.name}: Error - ${error.message}`);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Agent Stream Formatter - Basic API Examples\n');
  console.log('This demonstrates basic usage of the streaming API.\n');

  try {
    await basicEventStreaming();
    await formattedStreaming();
    await processStdin();
    await eventAnalysis();
    await multiVendorExample();

    console.log('\n=== Examples Complete ===');
    console.log('\nNext steps:');
    console.log('- Try piping real CLI output to this script');
    console.log(
      '- Explore filtering examples: node examples/basic/filter-events.js',
    );
    console.log('- Check advanced examples: ls examples/advanced/');
  } catch (error) {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  }
}

// Handle both direct execution and stdin input
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
