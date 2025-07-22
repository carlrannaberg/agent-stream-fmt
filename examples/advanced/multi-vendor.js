#!/usr/bin/env node

/**
 * Multi-Vendor Handling Examples
 *
 * This example demonstrates advanced techniques for handling mixed vendor
 * formats and complex scenarios. It shows how to:
 *
 * 1. Process mixed vendor formats in a single stream
 * 2. Implement vendor-specific customizations
 * 3. Handle format transitions and auto-detection
 * 4. Aggregate data across different vendors
 * 5. Build vendor-agnostic processing pipelines
 *
 * Run this example:
 *   node examples/advanced/multi-vendor.js
 */

import { streamEvents, selectParser, registry } from 'agent-stream-fmt';
import { createReadStream, writeFileSync } from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Example 1: Processing mixed vendor formats in a single stream
 */
async function mixedVendorStream() {
  console.log('=== Example 1: Mixed Vendor Stream Processing ===\n');

  // Create a mixed stream with different vendor formats
  const mixedData = [
    // Claude format
    '{"type":"message","role":"user","content":"Claude: Start session"}',
    '{"type":"message","role":"assistant","content":"Hello from Claude!"}',
    '{"type":"tool_use","name":"read_file","phase":"start"}',
    '{"type":"tool_use","name":"read_file","phase":"end","exit_code":0}',

    // Gemini format
    '{"event":"content","role":"user","content":"Gemini: Different format"}',
    '{"event":"content","role":"model","content":"Hello from Gemini!"}',
    '{"event":"tool","name":"search","phase":"start"}',
    '{"event":"tool","name":"search","phase":"end","status":"success"}',

    // Amp format
    '{"event":"message","role":"user","text":"Amp: Yet another format"}',
    '{"event":"message","role":"assistant","text":"Hello from Amp!"}',
    '{"event":"tool","name":"build","status":"running"}',
    '{"event":"tool","name":"build","status":"completed"}',

    // Back to Claude
    '{"type":"usage","delta_usd":0.005}',
    '{"type":"message","role":"assistant","content":"Mixed processing complete"}',
  ];

  const input = Readable.from([mixedData.join('\n')]);

  console.log('Processing mixed vendor formats with auto-detection:\n');

  const vendorStats = {
    claude: { events: 0, types: {} },
    gemini: { events: 0, types: {} },
    amp: { events: 0, types: {} },
    unknown: { events: 0, types: {} },
  };

  let totalEvents = 0;
  let detectedVendor = null;

  try {
    for await (const event of streamEvents({
      vendor: 'auto',
      source: input,
    })) {
      totalEvents++;

      // Try to infer which vendor this event came from based on original format
      const vendor = inferVendorFromEvent(event);
      detectedVendor = vendor;

      vendorStats[vendor].events++;
      vendorStats[vendor].types[event.t] =
        (vendorStats[vendor].types[event.t] || 0) + 1;

      console.log(
        `[${vendor.toUpperCase()}] ${event.t}: ${getEventSummary(event)}`,
      );
    }

    console.log('\n=== Mixed Vendor Processing Results ===');
    console.log(`Total events processed: ${totalEvents}`);

    for (const [vendor, stats] of Object.entries(vendorStats)) {
      if (stats.events > 0) {
        console.log(`\n${vendor.toUpperCase()}:`);
        console.log(`  Events: ${stats.events}`);
        console.log(
          `  Types: ${Object.entries(stats.types)
            .map(([t, c]) => `${t}(${c})`)
            .join(', ')}`,
        );
      }
    }
  } catch (error) {
    console.error('Error processing mixed vendor stream:', error.message);
  }
}

/**
 * Helper function to infer vendor from normalized event
 */
function inferVendorFromEvent(event) {
  // This is a simplified heuristic - in practice, you might track this
  // during parsing or use other context clues

  // Check for vendor-specific patterns in debug info if available
  if (event.t === 'debug' && event.raw) {
    if (event.raw.type) return 'claude';
    if (event.raw.event) return 'gemini';
    if (event.raw.status) return 'amp';
  }

  // Fallback to auto-detection based on common patterns
  return 'auto';
}

/**
 * Helper function to get event summary
 */
function getEventSummary(event) {
  switch (event.t) {
    case 'msg':
      return `${event.role} - "${event.text.substring(0, 50)}${event.text.length > 50 ? '...' : ''}"`;
    case 'tool':
      return `${event.name} (${event.phase})`;
    case 'cost':
      return `$${event.deltaUsd.toFixed(6)}`;
    case 'error':
      return event.message;
    default:
      return 'N/A';
  }
}

/**
 * Example 2: Vendor-specific processing pipelines
 */
async function vendorSpecificPipelines() {
  console.log('\n=== Example 2: Vendor-Specific Processing Pipelines ===\n');

  // Load different vendor fixtures
  const vendorFixtures = [
    { name: 'Claude', path: '../../tests/fixtures/claude/basic-message.jsonl' },
    { name: 'Gemini', path: '../../tests/fixtures/gemini/basic-content.txt' },
    { name: 'Amp', path: '../../tests/fixtures/amp/simple-task.jsonl' },
  ];

  // Vendor-specific processors
  const processors = {
    claude: {
      name: 'Claude Processor',
      processMessage: event => `🔵 Claude AI: ${event.text}`,
      processTool: event => `🔧 Claude Tool: ${event.name} (${event.phase})`,
      processCost: event => `💰 Claude Usage: $${event.deltaUsd.toFixed(6)}`,
    },

    gemini: {
      name: 'Gemini Processor',
      processMessage: event => `🟢 Gemini AI: ${event.text}`,
      processTool: event => `⚙️ Gemini Tool: ${event.name} (${event.phase})`,
      processCost: event => `💎 Gemini Cost: $${event.deltaUsd.toFixed(6)}`,
    },

    amp: {
      name: 'Amp Processor',
      processMessage: event => `🟠 Amp Code: ${event.text}`,
      processTool: event => `🛠️ Amp Tool: ${event.name} (${event.phase})`,
      processCost: event => `⚡ Amp Usage: $${event.deltaUsd.toFixed(6)}`,
    },
  };

  for (const fixture of vendorFixtures) {
    console.log(`--- Processing ${fixture.name} Output ---`);

    try {
      const fixturePath = join(__dirname, fixture.path);
      const input = createReadStream(fixturePath, { encoding: 'utf8' });
      const vendorKey = fixture.name.toLowerCase();
      const processor = processors[vendorKey];

      if (!processor) {
        console.log(
          `No specific processor for ${fixture.name}, using default\n`,
        );
        continue;
      }

      let eventCount = 0;

      for await (const event of streamEvents({
        vendor: vendorKey, // Use specific vendor parser
        source: input,
      })) {
        eventCount++;

        let output;
        switch (event.t) {
          case 'msg':
            output = processor.processMessage(event);
            break;
          case 'tool':
            output = processor.processTool(event);
            break;
          case 'cost':
            output = processor.processCost(event);
            break;
          default:
            output = `${processor.name}: ${event.t} event`;
        }

        console.log(output);
      }

      console.log(`Processed ${eventCount} events with ${processor.name}\n`);
    } catch (error) {
      console.log(`Error processing ${fixture.name}: ${error.message}\n`);
    }
  }
}

/**
 * Example 3: Advanced vendor detection and fallback strategies
 */
async function advancedVendorDetection() {
  console.log('\n=== Example 3: Advanced Vendor Detection ===\n');

  // Create ambiguous input that could match multiple formats
  const ambiguousData = [
    '{"type":"message","content":"Could be Claude or custom format"}',
    '{"event":"something","data":"Could be Gemini-like"}',
    '{"message":"text","source":"unknown"}',
    '{"completely":"unknown","format":"here"}',
    '{"type":"tool_use","name":"test"}', // Clearly Claude
    '{"event":"content","role":"model"}', // Clearly Gemini
  ];

  const input = Readable.from([ambiguousData.join('\n')]);

  console.log('Testing vendor detection with ambiguous input:\n');

  // Implement custom detection logic
  class VendorDetector {
    constructor() {
      this.confidence = {
        claude: 0,
        gemini: 0,
        amp: 0,
      };
      this.samples = [];
    }

    analyzeInput(lines) {
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          this.samples.push(obj);

          // Claude indicators
          if (obj.type && ['message', 'tool_use', 'usage'].includes(obj.type)) {
            this.confidence.claude += 2;
          }
          if (obj.role && ['user', 'assistant'].includes(obj.role)) {
            this.confidence.claude += 1;
          }

          // Gemini indicators
          if (obj.event && ['content', 'tool'].includes(obj.event)) {
            this.confidence.gemini += 2;
          }
          if (obj.role === 'model') {
            this.confidence.gemini += 1;
          }

          // Amp indicators
          if (
            obj.status &&
            ['running', 'completed', 'failed'].includes(obj.status)
          ) {
            this.confidence.amp += 2;
          }
          if (obj.event === 'message' && obj.text) {
            this.confidence.amp += 1;
          }
        } catch (e) {
          // Invalid JSON - could indicate corruption or non-JSONL format
        }
      }
    }

    getBestGuess() {
      const total = Object.values(this.confidence).reduce((a, b) => a + b, 0);
      if (total === 0) return 'unknown';

      return Object.entries(this.confidence).sort(
        ([, a], [, b]) => b - a,
      )[0][0];
    }

    getConfidenceScores() {
      const total = Object.values(this.confidence).reduce((a, b) => a + b, 0);
      if (total === 0) return this.confidence;

      return Object.fromEntries(
        Object.entries(this.confidence).map(([k, v]) => [
          k,
          ((v / total) * 100).toFixed(1),
        ]),
      );
    }
  }

  const detector = new VendorDetector();
  detector.analyzeInput(ambiguousData);

  const bestGuess = detector.getBestGuess();
  const confidenceScores = detector.getConfidenceScores();

  console.log('Vendor Detection Analysis:');
  console.log(`Best guess: ${bestGuess}`);
  console.log('Confidence scores:');
  for (const [vendor, score] of Object.entries(confidenceScores)) {
    console.log(`  ${vendor}: ${score}%`);
  }

  console.log('\nTrying with detected vendor...\n');

  try {
    let successfulEvents = 0;
    let errorEvents = 0;

    for await (const event of streamEvents({
      vendor: bestGuess === 'unknown' ? 'auto' : bestGuess,
      source: input,
    })) {
      if (event.t === 'error') {
        errorEvents++;
        console.log(`❌ Parse error: ${event.message.substring(0, 60)}...`);
      } else {
        successfulEvents++;
        console.log(`✅ Successfully parsed: ${event.t}`);
      }
    }

    console.log(
      `\nResults: ${successfulEvents} successful, ${errorEvents} errors`,
    );
    const successRate = (
      (successfulEvents / (successfulEvents + errorEvents)) *
      100
    ).toFixed(1);
    console.log(`Success rate: ${successRate}%`);
  } catch (error) {
    console.error('Error with vendor detection:', error.message);
  }
}

/**
 * Example 4: Cross-vendor data aggregation
 */
async function crossVendorAggregation() {
  console.log('\n=== Example 4: Cross-Vendor Data Aggregation ===\n');

  // Process multiple vendor fixtures and aggregate metrics
  const fixtureFiles = [
    {
      vendor: 'claude',
      path: '../../tests/fixtures/claude/complex-session.jsonl',
    },
    {
      vendor: 'gemini',
      path: '../../tests/fixtures/gemini/basic-content.txt',
    },
    { vendor: 'amp', path: '../../tests/fixtures/amp/simple-task.jsonl' },
  ];

  const aggregatedMetrics = {
    totalEvents: 0,
    byVendor: {},
    byType: {},
    tools: {
      total: 0,
      byVendor: {},
      byName: {},
      successRate: {},
    },
    costs: {
      total: 0,
      byVendor: {},
      events: 0,
    },
    messages: {
      total: 0,
      byVendor: {},
      totalChars: 0,
      byRole: {},
    },
  };

  console.log('Aggregating data across vendors...\n');

  for (const fixture of fixtureFiles) {
    console.log(`Processing ${fixture.vendor} fixture...`);

    try {
      const fixturePath = join(__dirname, fixture.path);
      const input = createReadStream(fixturePath, { encoding: 'utf8' });

      // Initialize vendor stats
      if (!aggregatedMetrics.byVendor[fixture.vendor]) {
        aggregatedMetrics.byVendor[fixture.vendor] = {
          events: 0,
          types: {},
        };
        aggregatedMetrics.tools.byVendor[fixture.vendor] = {
          total: 0,
          successful: 0,
        };
        aggregatedMetrics.costs.byVendor[fixture.vendor] = 0;
        aggregatedMetrics.messages.byVendor[fixture.vendor] = {
          count: 0,
          chars: 0,
        };
      }

      for await (const event of streamEvents({
        vendor: fixture.vendor,
        source: input,
      })) {
        // Overall metrics
        aggregatedMetrics.totalEvents++;
        aggregatedMetrics.byVendor[fixture.vendor].events++;

        // By type
        aggregatedMetrics.byType[event.t] =
          (aggregatedMetrics.byType[event.t] || 0) + 1;
        aggregatedMetrics.byVendor[fixture.vendor].types[event.t] =
          (aggregatedMetrics.byVendor[fixture.vendor].types[event.t] || 0) + 1;

        // Event-specific aggregation
        switch (event.t) {
          case 'msg':
            aggregatedMetrics.messages.total++;
            aggregatedMetrics.messages.totalChars += event.text.length;
            aggregatedMetrics.messages.byRole[event.role] =
              (aggregatedMetrics.messages.byRole[event.role] || 0) + 1;
            aggregatedMetrics.messages.byVendor[fixture.vendor].count++;
            aggregatedMetrics.messages.byVendor[fixture.vendor].chars +=
              event.text.length;
            break;

          case 'tool':
            if (event.phase === 'start') {
              aggregatedMetrics.tools.total++;
              aggregatedMetrics.tools.byVendor[fixture.vendor].total++;
              aggregatedMetrics.tools.byName[event.name] =
                (aggregatedMetrics.tools.byName[event.name] || 0) + 1;
            } else if (event.phase === 'end') {
              if (event.exitCode === 0) {
                aggregatedMetrics.tools.byVendor[fixture.vendor].successful++;
              }
            }
            break;

          case 'cost':
            aggregatedMetrics.costs.total += event.deltaUsd;
            aggregatedMetrics.costs.byVendor[fixture.vendor] += event.deltaUsd;
            aggregatedMetrics.costs.events++;
            break;
        }
      }

      console.log(
        `  ${aggregatedMetrics.byVendor[fixture.vendor].events} events processed`,
      );
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
  }

  // Calculate derived metrics
  for (const [vendor, toolStats] of Object.entries(
    aggregatedMetrics.tools.byVendor,
  )) {
    aggregatedMetrics.tools.successRate[vendor] =
      toolStats.total > 0
        ? ((toolStats.successful / toolStats.total) * 100).toFixed(1) + '%'
        : 'N/A';
  }

  console.log('\n=== Cross-Vendor Aggregation Results ===');
  console.log(
    `Total events across all vendors: ${aggregatedMetrics.totalEvents}`,
  );

  console.log('\nBy Vendor:');
  for (const [vendor, stats] of Object.entries(aggregatedMetrics.byVendor)) {
    console.log(`  ${vendor}: ${stats.events} events`);
    const types = Object.entries(stats.types)
      .map(([t, c]) => `${t}(${c})`)
      .join(', ');
    console.log(`    Types: ${types}`);
  }

  console.log('\nBy Event Type:');
  for (const [type, count] of Object.entries(aggregatedMetrics.byType)) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\nMessages:');
  console.log(`  Total: ${aggregatedMetrics.messages.total}`);
  console.log(
    `  Total characters: ${aggregatedMetrics.messages.totalChars.toLocaleString()}`,
  );
  console.log(
    `  Average length: ${(aggregatedMetrics.messages.totalChars / aggregatedMetrics.messages.total).toFixed(1)} chars`,
  );
  console.log(
    `  By role: ${Object.entries(aggregatedMetrics.messages.byRole)
      .map(([r, c]) => `${r}(${c})`)
      .join(', ')}`,
  );

  console.log('\nTools:');
  console.log(`  Total executions: ${aggregatedMetrics.tools.total}`);
  console.log(
    `  Unique tools: ${Object.keys(aggregatedMetrics.tools.byName).length}`,
  );
  console.log(`  Success rates by vendor:`);
  for (const [vendor, rate] of Object.entries(
    aggregatedMetrics.tools.successRate,
  )) {
    console.log(`    ${vendor}: ${rate}`);
  }

  console.log('\nCosts:');
  console.log(`  Total cost: $${aggregatedMetrics.costs.total.toFixed(6)}`);
  console.log(`  Cost events: ${aggregatedMetrics.costs.events}`);
  console.log(`  By vendor:`);
  for (const [vendor, cost] of Object.entries(
    aggregatedMetrics.costs.byVendor,
  )) {
    const percentage =
      aggregatedMetrics.costs.total > 0
        ? ((cost / aggregatedMetrics.costs.total) * 100).toFixed(1)
        : '0';
    console.log(`    ${vendor}: $${cost.toFixed(6)} (${percentage}%)`);
  }

  // Save aggregated results
  const reportPath = join(__dirname, '../../temp/cross-vendor-analysis.json');
  writeFileSync(reportPath, JSON.stringify(aggregatedMetrics, null, 2));
  console.log(`\nDetailed analysis saved to: ${reportPath}`);
}

/**
 * Example 5: Vendor-agnostic processing pipeline
 */
async function vendorAgnosticPipeline() {
  console.log('\n=== Example 5: Vendor-Agnostic Processing Pipeline ===\n');

  // Build a pipeline that works consistently across all vendors
  class UniversalProcessor {
    constructor() {
      this.processors = new Map();
      this.stats = {
        processed: 0,
        byVendor: {},
        errors: 0,
      };
    }

    registerProcessor(eventType, processor) {
      this.processors.set(eventType, processor);
    }

    async processStream(vendor, source) {
      console.log(`Processing ${vendor} stream...`);

      if (!this.stats.byVendor[vendor]) {
        this.stats.byVendor[vendor] = { events: 0, types: {} };
      }

      try {
        for await (const event of streamEvents({
          vendor,
          source,
        })) {
          this.stats.processed++;
          this.stats.byVendor[vendor].events++;
          this.stats.byVendor[vendor].types[event.t] =
            (this.stats.byVendor[vendor].types[event.t] || 0) + 1;

          // Apply universal processing
          const processor = this.processors.get(event.t);
          if (processor) {
            const result = await processor(event, vendor);
            if (result) {
              console.log(`  ${result}`);
            }
          }
        }
      } catch (error) {
        this.stats.errors++;
        console.log(`  Error: ${error.message}`);
      }
    }

    getStats() {
      return this.stats;
    }
  }

  // Create universal processor
  const processor = new UniversalProcessor();

  // Register universal event processors
  processor.registerProcessor('msg', async (event, vendor) => {
    const prefix =
      {
        claude: '🔵',
        gemini: '🟢',
        amp: '🟠',
      }[vendor] || '⚪';

    return `${prefix} ${event.role}: ${event.text.substring(0, 60)}${event.text.length > 60 ? '...' : ''}`;
  });

  processor.registerProcessor('tool', async (event, vendor) => {
    if (event.phase === 'start') {
      return `🔧 [${vendor}] Starting ${event.name}`;
    } else if (event.phase === 'end') {
      const status = event.exitCode === 0 ? '✅' : '❌';
      return `${status} [${vendor}] ${event.name} finished (${event.exitCode})`;
    }
    return null; // Don't show intermediate phases
  });

  processor.registerProcessor('cost', async (event, vendor) => {
    return `💰 [${vendor}] Cost: $${event.deltaUsd.toFixed(6)}`;
  });

  processor.registerProcessor('error', async (event, vendor) => {
    return `❌ [${vendor}] Error: ${event.message}`;
  });

  // Process all vendor types through the same pipeline
  const testData = [
    {
      vendor: 'claude',
      path: '../../tests/fixtures/claude/basic-message.jsonl',
    },
    {
      vendor: 'gemini',
      path: '../../tests/fixtures/gemini/basic-content.txt',
    },
    { vendor: 'amp', path: '../../tests/fixtures/amp/simple-task.jsonl' },
  ];

  for (const { vendor, path } of testData) {
    try {
      const fixturePath = join(__dirname, path);
      const input = createReadStream(fixturePath, { encoding: 'utf8' });
      await processor.processStream(vendor, input);
      console.log();
    } catch (error) {
      console.log(`Failed to process ${vendor}: ${error.message}\n`);
    }
  }

  const stats = processor.getStats();
  console.log('=== Universal Processing Results ===');
  console.log(`Total events processed: ${stats.processed}`);
  console.log(`Errors encountered: ${stats.errors}`);
  console.log('\nBy vendor:');
  for (const [vendor, vendorStats] of Object.entries(stats.byVendor)) {
    console.log(`  ${vendor}: ${vendorStats.events} events`);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Agent Stream Formatter - Multi-Vendor Handling Examples\n');
  console.log(
    'This demonstrates advanced multi-vendor processing techniques.\n',
  );

  try {
    await mixedVendorStream();
    await vendorSpecificPipelines();
    await advancedVendorDetection();
    await crossVendorAggregation();
    await vendorAgnosticPipeline();

    console.log('\n=== Multi-Vendor Examples Complete ===');
    console.log('\nKey techniques demonstrated:');
    console.log('- Mixed vendor format processing');
    console.log('- Vendor-specific customization');
    console.log('- Advanced format detection');
    console.log('- Cross-vendor data aggregation');
    console.log('- Universal processing pipelines');

    console.log('\nBest practices:');
    console.log('- Use auto-detection for unknown inputs');
    console.log('- Implement fallback strategies for ambiguous formats');
    console.log('- Aggregate metrics across vendors for insights');
    console.log('- Build vendor-agnostic pipelines for consistency');
    console.log('- Track vendor-specific success rates');

    console.log('\nNext steps:');
    console.log('- Explore integration examples: ls examples/integrations/');
    console.log('- Try benchmark examples: ls examples/benchmarks/');
    console.log('- Check the main CLI: npx agent-stream-fmt --help');
  } catch (error) {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
