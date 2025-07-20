#!/usr/bin/env node

/**
 * Custom Renderer Examples
 *
 * This example demonstrates how to build custom output renderers for
 * specialized formatting needs. It shows how to:
 *
 * 1. Implement the Renderer interface
 * 2. Create specialized formatters (Markdown, Slack, etc.)
 * 3. Handle different event types with custom styling
 * 4. Build stateful renderers that track context
 * 5. Integrate custom renderers with the streaming API
 *
 * Run this example:
 *   node examples/advanced/custom-renderer.js
 */

import { streamEvents } from 'agent-stream-fmt';
import { createReadStream, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Example 1: Markdown Renderer
 *
 * Converts agent events to clean Markdown format suitable for
 * documentation or reports.
 */
class MarkdownRenderer {
  constructor(options = {}) {
    this.options = {
      includeMetadata: true,
      collapseTools: false,
      showTimestamps: false,
      ...options,
    };
    this.buffer = [];
    this.toolSessions = new Map();
  }

  render(event, context = {}) {
    const timestamp = this.options.showTimestamps
      ? `_${new Date().toISOString()}_\n\n`
      : '';

    switch (event.t) {
      case 'msg':
        return this.renderMessage(event, timestamp);
      case 'tool':
        return this.renderTool(event, timestamp);
      case 'cost':
        return this.renderCost(event, timestamp);
      case 'error':
        return this.renderError(event, timestamp);
      case 'debug':
        return this.options.includeMetadata
          ? this.renderDebug(event, timestamp)
          : '';
      default:
        return '';
    }
  }

  renderMessage(event, timestamp) {
    const roleEmoji = {
      user: '👤',
      assistant: '🤖',
      system: '⚙️',
    };

    const emoji = roleEmoji[event.role] || '❓';
    return `${timestamp}## ${emoji} ${event.role.charAt(0).toUpperCase() + event.role.slice(1)}\n\n${event.text}\n\n`;
  }

  renderTool(event, timestamp) {
    const toolName = event.name;

    if (!this.toolSessions.has(toolName)) {
      this.toolSessions.set(toolName, {
        name: toolName,
        outputs: [],
        completed: false,
      });
    }

    const session = this.toolSessions.get(toolName);

    switch (event.phase) {
      case 'start':
        return `${timestamp}### 🔧 Tool: \`${toolName}\`\n\n`;

      case 'stdout':
        if (event.text && event.text.trim()) {
          session.outputs.push({ type: 'stdout', text: event.text.trim() });
          if (!this.options.collapseTools) {
            return `\`\`\`\n${event.text.trim()}\n\`\`\`\n\n`;
          }
        }
        return '';

      case 'stderr':
        if (event.text && event.text.trim()) {
          session.outputs.push({ type: 'stderr', text: event.text.trim() });
          if (!this.options.collapseTools) {
            return `**Error output:**\n\`\`\`\n${event.text.trim()}\n\`\`\`\n\n`;
          }
        }
        return '';

      case 'end':
        session.completed = true;
        const status = event.exitCode === 0 ? '✅ Success' : '❌ Failed';
        let result = `**Result:** ${status} (exit code: ${event.exitCode})\n\n`;

        if (this.options.collapseTools && session.outputs.length > 0) {
          result += '<details>\n<summary>Tool Output</summary>\n\n';
          for (const output of session.outputs) {
            const label = output.type === 'stderr' ? 'Error Output' : 'Output';
            result += `**${label}:**\n\`\`\`\n${output.text}\n\`\`\`\n\n`;
          }
          result += '</details>\n\n';
        }

        return result;

      default:
        return '';
    }
  }

  renderCost(event, timestamp) {
    return `${timestamp}💰 **Cost:** $${event.deltaUsd.toFixed(6)}\n\n`;
  }

  renderError(event, timestamp) {
    return `${timestamp}❌ **Error:** ${event.message}\n\n`;
  }

  renderDebug(event, timestamp) {
    const rawData = JSON.stringify(event.raw, null, 2);
    return `${timestamp}<details>\n<summary>🐛 Debug Information</summary>\n\n\`\`\`json\n${rawData}\n\`\`\`\n</details>\n\n`;
  }

  finalize() {
    return ''; // No special finalization needed for Markdown
  }
}

/**
 * Example 2: Slack Message Renderer
 *
 * Formats events for Slack messages using Slack's Block Kit format.
 */
class SlackRenderer {
  constructor(options = {}) {
    this.options = {
      channel: '#ai-logs',
      username: 'Agent Monitor',
      groupMessages: true,
      ...options,
    };
    this.messageBuffer = [];
  }

  render(event, context = {}) {
    switch (event.t) {
      case 'msg':
        return this.renderMessage(event);
      case 'tool':
        return this.renderTool(event);
      case 'cost':
        return this.renderCost(event);
      case 'error':
        return this.renderError(event);
      default:
        return null;
    }
  }

  renderMessage(event) {
    const roleEmoji = {
      user: ':bust_in_silhouette:',
      assistant: ':robot_face:',
      system: ':gear:',
    };

    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${roleEmoji[event.role]} *${event.role}:* ${event.text}`,
          },
        },
      ],
    };
  }

  renderTool(event) {
    if (event.phase === 'start') {
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:wrench: Starting tool: \`${event.name}\``,
            },
          },
        ],
      };
    } else if (event.phase === 'end') {
      const status = event.exitCode === 0 ? ':white_check_mark:' : ':x:';
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${status} Tool \`${event.name}\` finished (exit code: ${event.exitCode})`,
            },
          },
        ],
      };
    }
    return null;
  }

  renderCost(event) {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:moneybag: Cost: $${event.deltaUsd.toFixed(6)}`,
          },
        },
      ],
    };
  }

  renderError(event) {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:warning: *Error:* ${event.message}`,
          },
        },
      ],
    };
  }

  finalize() {
    return JSON.stringify(
      {
        channel: this.options.channel,
        username: this.options.username,
        blocks: this.messageBuffer,
      },
      null,
      2,
    );
  }
}

/**
 * Example 3: Metrics Renderer
 *
 * Focuses on collecting and formatting metrics rather than content.
 */
class MetricsRenderer {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      events: {
        total: 0,
        byType: {},
      },
      tools: {
        total: 0,
        successful: 0,
        failed: 0,
        byName: {},
      },
      costs: {
        total: 0,
        events: 0,
        min: Infinity,
        max: 0,
      },
      messages: {
        total: 0,
        byRole: {},
        totalChars: 0,
      },
      errors: 0,
    };
  }

  render(event, context = {}) {
    this.metrics.events.total++;
    this.metrics.events.byType[event.t] =
      (this.metrics.events.byType[event.t] || 0) + 1;

    switch (event.t) {
      case 'msg':
        this.processMessage(event);
        break;
      case 'tool':
        this.processTool(event);
        break;
      case 'cost':
        this.processCost(event);
        break;
      case 'error':
        this.metrics.errors++;
        break;
    }

    return ''; // Metrics renderer doesn't produce immediate output
  }

  processMessage(event) {
    this.metrics.messages.total++;
    this.metrics.messages.byRole[event.role] =
      (this.metrics.messages.byRole[event.role] || 0) + 1;
    this.metrics.messages.totalChars += event.text.length;
  }

  processTool(event) {
    if (event.phase === 'start') {
      this.metrics.tools.total++;
      this.metrics.tools.byName[event.name] =
        (this.metrics.tools.byName[event.name] || 0) + 1;
    } else if (event.phase === 'end') {
      if (event.exitCode === 0) {
        this.metrics.tools.successful++;
      } else {
        this.metrics.tools.failed++;
      }
    }
  }

  processCost(event) {
    this.metrics.costs.events++;
    this.metrics.costs.total += event.deltaUsd;
    this.metrics.costs.min = Math.min(this.metrics.costs.min, event.deltaUsd);
    this.metrics.costs.max = Math.max(this.metrics.costs.max, event.deltaUsd);
  }

  finalize() {
    const duration = Date.now() - this.startTime;
    const avgMessageLength =
      this.metrics.messages.total > 0
        ? this.metrics.messages.totalChars / this.metrics.messages.total
        : 0;

    return JSON.stringify(
      {
        summary: {
          duration_ms: duration,
          total_events: this.metrics.events.total,
          events_per_second: (
            this.metrics.events.total /
            (duration / 1000)
          ).toFixed(2),
        },
        events: this.metrics.events,
        tools: {
          ...this.metrics.tools,
          success_rate:
            this.metrics.tools.total > 0
              ? (
                  (this.metrics.tools.successful / this.metrics.tools.total) *
                  100
                ).toFixed(1) + '%'
              : 'N/A',
        },
        costs: {
          ...this.metrics.costs,
          average:
            this.metrics.costs.events > 0
              ? this.metrics.costs.total / this.metrics.costs.events
              : 0,
          min: this.metrics.costs.min === Infinity ? 0 : this.metrics.costs.min,
        },
        messages: {
          ...this.metrics.messages,
          average_length: Math.round(avgMessageLength),
        },
        errors: this.metrics.errors,
      },
      null,
      2,
    );
  }
}

/**
 * Example 4: CSV Renderer
 *
 * Exports events to CSV format for spreadsheet analysis.
 */
class CSVRenderer {
  constructor() {
    this.rows = [];
    this.headers = [
      'timestamp',
      'type',
      'role',
      'tool_name',
      'tool_phase',
      'cost_usd',
      'text_preview',
    ];
  }

  render(event, context = {}) {
    const timestamp = new Date().toISOString();
    const textPreview = event.text
      ? event.text.substring(0, 50).replace(/["\n\r]/g, ' ')
      : '';

    const row = {
      timestamp,
      type: event.t,
      role: event.role || '',
      tool_name: event.name || '',
      tool_phase: event.phase || '',
      cost_usd: event.deltaUsd || '',
      text_preview: textPreview,
    };

    this.rows.push(row);
    return ''; // CSV renderer builds output at finalization
  }

  finalize() {
    let csv = this.headers.join(',') + '\n';

    for (const row of this.rows) {
      const values = this.headers.map(header => {
        const value = row[header] || '';
        // Escape CSV values that contain commas or quotes
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    }

    return csv;
  }
}

/**
 * Demo function to test custom renderers
 */
async function demonstrateCustomRenderers() {
  console.log('=== Custom Renderer Examples ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/tool-use.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  // Initialize custom renderers
  const renderers = {
    markdown: new MarkdownRenderer({
      collapseTools: true,
      showTimestamps: false,
    }),
    slack: new SlackRenderer(),
    metrics: new MetricsRenderer(),
    csv: new CSVRenderer(),
  };

  console.log('Processing events with custom renderers...\n');

  try {
    // Process events through all renderers
    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      for (const [name, renderer] of Object.entries(renderers)) {
        const output = renderer.render(event);

        // For demo, only show markdown output in real-time
        if (name === 'markdown' && output) {
          process.stdout.write(output);
        }
      }
    }

    console.log('\n=== Renderer Outputs ===\n');

    // Generate final outputs
    const outputs = {};
    for (const [name, renderer] of Object.entries(renderers)) {
      outputs[name] = renderer.finalize();
    }

    // Save outputs to files (in real app, you might send to different destinations)
    const outputDir = join(__dirname, '../../temp');

    console.log('Generated outputs:');
    console.log(`- Markdown: ${outputs.markdown.split('\n').length} lines`);
    console.log(
      `- Slack: ${JSON.parse(outputs.slack || '{}').blocks?.length || 0} blocks`,
    );
    console.log('- Metrics:');
    const metrics = JSON.parse(outputs.metrics);
    console.log(`  • Total events: ${metrics.summary.total_events}`);
    console.log(
      `  • Processing rate: ${metrics.summary.events_per_second} events/sec`,
    );
    console.log(`  • Tools used: ${Object.keys(metrics.tools.byName).length}`);
    console.log(`  • Total cost: $${metrics.costs.total.toFixed(6)}`);
    console.log(`- CSV: ${outputs.csv.split('\n').length - 1} data rows`);

    // Write sample outputs to temp directory
    writeFileSync(join(outputDir, 'sample-output.md'), outputs.markdown);
    writeFileSync(join(outputDir, 'sample-metrics.json'), outputs.metrics);
    writeFileSync(join(outputDir, 'sample-events.csv'), outputs.csv);

    console.log(`\nSample files written to ${outputDir}/`);
  } catch (error) {
    console.error('Error in custom renderer demo:', error.message);
  }
}

/**
 * Example usage with the streaming format API
 */
async function integrateWithStreamingAPI() {
  console.log('\n=== Integration with Streaming API ===\n');

  const fixturePath = join(
    __dirname,
    '../../tests/fixtures/claude/basic-message.jsonl',
  );
  const input = createReadStream(fixturePath, { encoding: 'utf8' });

  const markdownRenderer = new MarkdownRenderer({
    includeMetadata: false,
    showTimestamps: true,
  });

  console.log('Using custom renderer with streaming API:\n');

  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: input,
    })) {
      const output = markdownRenderer.render(event);
      if (output) {
        process.stdout.write(output);
      }
    }

    const finalOutput = markdownRenderer.finalize();
    if (finalOutput) {
      process.stdout.write(finalOutput);
    }
  } catch (error) {
    console.error('Error in streaming integration:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Agent Stream Formatter - Custom Renderer Examples\n');
  console.log('This demonstrates building custom output formatters.\n');

  try {
    await demonstrateCustomRenderers();
    await integrateWithStreamingAPI();

    console.log('\n=== Custom Renderer Examples Complete ===');
    console.log('\nKey concepts demonstrated:');
    console.log('- Implement render(event, context) method');
    console.log('- Handle different event types with custom formatting');
    console.log('- Use finalize() for output generation');
    console.log('- Track state across events for complex renderers');
    console.log('- Export to various formats (Markdown, JSON, CSV, etc.)');

    console.log('\nNext steps:');
    console.log(
      '- Explore error handling: node examples/advanced/error-handling.js',
    );
    console.log(
      '- Check performance examples: node examples/advanced/performance.js',
    );
    console.log('- Try integration examples: ls examples/integrations/');
  } catch (error) {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  }
}

// Handle both direct execution and module import
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}
