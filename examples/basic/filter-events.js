#!/usr/bin/env node

/**
 * Event Filtering Examples
 *
 * This example demonstrates various ways to filter and process events
 * from AI agent CLI outputs. It shows how to:
 *
 * 1. Filter events by type
 * 2. Create custom event processors
 * 3. Implement conditional formatting
 * 4. Build event aggregators
 * 5. Handle real-time filtering
 *
 * Run this example:
 *   node examples/basic/filter-events.js
 *
 * Or with specific input:
 *   cat tests/fixtures/claude/tool-use.jsonl | node examples/basic/filter-events.js --demo
 */

import { streamEvents, streamFormat } from 'agent-stream-fmt';
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Example 1: Basic event type filtering
 */
async function basicFiltering() {
  console.log('=== Example 1: Basic Event Type Filtering ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/complex-session.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  // Filter to show only messages and errors
  const allowedTypes = new Set(['msg', 'error']);

  console.log('Showing only messages and errors:\n');

  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      // Simple type filtering
      if (allowedTypes.has(event.t)) {
        switch (event.t) {
          case 'msg':
            console.log(`💬 [${event.role}]: ${event.text}`);
            break;
          case 'error':
            console.log(`❌ ERROR: ${event.message}`);
            break;
        }
      }
    }
  } catch (error) {
    console.error('Filtering error:', error.message);
  }
}

/**
 * Example 2: Conditional message filtering
 */
async function conditionalFiltering() {
  console.log('\n=== Example 2: Conditional Message Filtering ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/basic-message.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  console.log('Showing only assistant messages longer than 10 characters:\n');

  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      // Filter assistant messages by length
      if (
        event.t === 'msg' &&
        event.role === 'assistant' &&
        event.text.length > 10
      ) {
        console.log(`🤖 Assistant: ${event.text}`);
        console.log(`   (${event.text.length} characters)\n`);
      }
    }
  } catch (error) {
    console.error('Conditional filtering error:', error.message);
  }
}

/**
 * Example 3: Tool event filtering and analysis
 */
async function toolFiltering() {
  console.log('\n=== Example 3: Tool Event Filtering ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/tool-use.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  const toolSessions = new Map(); // Track tool execution sessions

  console.log('Analyzing tool usage:\n');

  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      if (event.t === 'tool') {
        const toolName = event.name;

        if (!toolSessions.has(toolName)) {
          toolSessions.set(toolName, {
            name: toolName,
            startTime: Date.now(),
            phases: [],
            success: null,
          });
        }

        const session = toolSessions.get(toolName);
        session.phases.push(event.phase);

        switch (event.phase) {
          case 'start':
            console.log(`🔧 Starting tool: ${toolName}`);
            break;

          case 'stdout':
            if (event.text && event.text.trim()) {
              console.log(`   📤 Output: ${event.text.trim()}`);
            }
            break;

          case 'stderr':
            if (event.text && event.text.trim()) {
              console.log(`   ⚠️  Error: ${event.text.trim()}`);
            }
            break;

          case 'end':
            session.success = event.exitCode === 0;
            const status = session.success ? '✅ Success' : '❌ Failed';
            console.log(`   ${status} (exit code: ${event.exitCode})\n`);
            break;
        }
      }
    }

    // Summary of tool usage
    console.log('=== Tool Usage Summary ===');
    for (const [name, session] of toolSessions) {
      const phases = session.phases.join(' → ');
      const result =
        session.success === null
          ? 'Unknown'
          : session.success
            ? 'Success'
            : 'Failed';
      console.log(`${name}: ${phases} (${result})`);
    }
  } catch (error) {
    console.error('Tool filtering error:', error.message);
  }
}

/**
 * Example 4: Cost tracking and filtering
 */
async function costFiltering() {
  console.log('\n=== Example 4: Cost Tracking ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/complex-session.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  let totalCost = 0;
  let costEvents = 0;
  const costThreshold = 0.001; // Only show costs above $0.001

  console.log(`Tracking costs (showing only costs > $${costThreshold}):\n`);

  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      if (event.t === 'cost') {
        costEvents++;
        totalCost += event.deltaUsd;

        // Filter by cost threshold
        if (event.deltaUsd > costThreshold) {
          console.log(`💰 Cost event: $${event.deltaUsd.toFixed(6)}`);
        }
      }
    }

    console.log(`\n=== Cost Summary ===`);
    console.log(`Total cost events: ${costEvents}`);
    console.log(`Total cost: $${totalCost.toFixed(6)}`);
    console.log(
      `Average per event: $${(totalCost / Math.max(costEvents, 1)).toFixed(6)}`,
    );
  } catch (error) {
    console.error('Cost filtering error:', error.message);
  }
}

/**
 * Example 5: Real-time event filtering with debouncing
 */
async function realTimeFiltering() {
  console.log('\n=== Example 5: Real-time Filtering with Debouncing ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/basic-message.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  let messageBuffer = [];
  const debounceMs = 100; // Group messages within 100ms

  console.log('Grouping rapid messages (debounced):\n');

  try {
    let lastMessageTime = 0;

    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      if (event.t === 'msg') {
        const now = Date.now();

        // If enough time has passed, flush the buffer
        if (now - lastMessageTime > debounceMs && messageBuffer.length > 0) {
          await flushMessageBuffer(messageBuffer);
          messageBuffer = [];
        }

        messageBuffer.push(event);
        lastMessageTime = now;
      }
    }

    // Flush any remaining messages
    if (messageBuffer.length > 0) {
      await flushMessageBuffer(messageBuffer);
    }
  } catch (error) {
    console.error('Real-time filtering error:', error.message);
  }
}

/**
 * Helper function to flush grouped messages
 */
async function flushMessageBuffer(messages) {
  if (messages.length === 1) {
    const msg = messages[0];
    console.log(`💬 ${msg.role}: ${msg.text}`);
  } else {
    console.log(`📦 Message group (${messages.length} messages):`);
    for (const msg of messages) {
      console.log(
        `   ${msg.role}: ${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}`,
      );
    }
  }
  console.log();
}

/**
 * Example 6: Custom filter functions
 */
async function customFilters() {
  console.log('\n=== Example 6: Custom Filter Functions ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/complex-session.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  // Define custom filter functions
  const filters = {
    // Filter for long messages
    longMessages: event => event.t === 'msg' && event.text.length > 50,

    // Filter for successful tools
    successfulTools: event =>
      event.t === 'tool' && event.phase === 'end' && event.exitCode === 0,

    // Filter for expensive operations (mock)
    expensiveOps: event => event.t === 'cost' && event.deltaUsd > 0.0001,

    // Filter for user questions
    userQuestions: event =>
      event.t === 'msg' && event.role === 'user' && event.text.includes('?'),
  };

  console.log('Applying custom filters:\n');

  try {
    const results = {
      longMessages: [],
      successfulTools: [],
      expensiveOps: [],
      userQuestions: [],
    };

    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      // Apply each filter
      for (const [filterName, filterFn] of Object.entries(filters)) {
        if (filterFn(event)) {
          results[filterName].push(event);
        }
      }
    }

    // Display results
    for (const [filterName, events] of Object.entries(results)) {
      console.log(`${filterName}: ${events.length} events`);
      events.slice(0, 2).forEach((event, i) => {
        const preview = event.text
          ? ` - "${event.text.substring(0, 30)}..."`
          : event.name
            ? ` - ${event.name}`
            : event.deltaUsd
              ? ` - $${event.deltaUsd}`
              : '';
        console.log(`  ${i + 1}.${preview}`);
      });
      if (events.length > 2) {
        console.log(`  ... and ${events.length - 2} more`);
      }
      console.log();
    }
  } catch (error) {
    console.error('Custom filtering error:', error.message);
  }
}

/**
 * Example 7: Stream-based filtering with formatted output
 */
async function streamFiltering() {
  console.log('\n=== Example 7: Stream-based Filtering ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/tool-use.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  console.log('Filtered formatted output (hiding debug, collapsing tools):\n');

  try {
    // Use streamFormat with built-in filtering
    for await (const formatted of streamFormat({
      vendor: 'claude',
      source: input,
      format: 'ansi',
      hideDebug: true,
      collapseTools: true,
      hideCost: false,
    })) {
      process.stdout.write(formatted);
    }
  } catch (error) {
    console.error('Stream filtering error:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Agent Stream Formatter - Event Filtering Examples\n');

  // Check for demo mode (when input is piped)
  const demoMode = process.argv.includes('--demo') || !process.stdin.isTTY;

  if (demoMode) {
    console.log('Demo mode: Using sample fixture data\n');
  }

  try {
    await basicFiltering();
    await conditionalFiltering();
    await toolFiltering();
    await costFiltering();
    await realTimeFiltering();
    await customFilters();
    await streamFiltering();

    console.log('\n=== Filtering Examples Complete ===');
    console.log('\nKey takeaways:');
    console.log('- Filter events by type using simple conditionals');
    console.log('- Implement custom filter functions for complex logic');
    console.log('- Use streamFormat() built-in options for common filtering');
    console.log('- Group and debounce events for real-time processing');
    console.log('- Track state across events for analysis');

    console.log('\nNext steps:');
    console.log('- Try advanced examples: ls examples/advanced/');
    console.log(
      '- Explore custom renderers: node examples/advanced/custom-renderer.js',
    );
  } catch (error) {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
