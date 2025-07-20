#!/usr/bin/env node

/**
 * Log Analyzer Integration Example
 *
 * This example demonstrates how to build a comprehensive log analysis tool
 * using agent-stream-fmt. It processes AI agent logs to extract insights,
 * generate reports, and identify patterns. Features include:
 *
 * 1. Multi-file log processing and aggregation
 * 2. Time-series analysis of agent activity
 * 3. Performance metrics and cost tracking
 * 4. Error pattern detection and reporting
 * 5. Interactive dashboard generation
 *
 * Run this example:
 *   node examples/integrations/log-analyzer.js [options]
 *
 * Options:
 *   --input <path>     Directory or file pattern to analyze
 *   --output <path>    Output directory for reports
 *   --format <type>    Report format (html, json, csv)
 *   --vendor <name>    Force vendor detection
 *   --days <number>    Analyze last N days
 */

import { streamEvents } from 'agent-stream-fmt';
import {
  createReadStream,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join, basename, extname } from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Log Analyzer Class
 */
class LogAnalyzer {
  constructor(options = {}) {
    this.options = {
      inputPath: options.input || './logs',
      outputPath: options.output || './reports',
      format: options.format || 'html',
      vendor: options.vendor || 'auto',
      days: options.days || 30,
      ...options,
    };

    this.stats = {
      filesProcessed: 0,
      totalEvents: 0,
      timeRange: { start: null, end: null },
      byFile: new Map(),
      byVendor: new Map(),
      byType: new Map(),
      byHour: new Array(24).fill(0),
      byDay: new Map(),
      tools: {
        executions: new Map(),
        failures: new Map(),
        avgDuration: new Map(),
        successRate: new Map(),
      },
      costs: {
        total: 0,
        byVendor: new Map(),
        byDay: new Map(),
        byHour: new Array(24).fill(0),
      },
      messages: {
        total: 0,
        byRole: new Map(),
        avgLength: 0,
        totalChars: 0,
      },
      errors: {
        total: 0,
        byType: new Map(),
        byFile: new Map(),
        patterns: new Map(),
      },
      performance: {
        avgEventsPerSecond: 0,
        processingTime: 0,
        memoryPeak: 0,
      },
    };
  }

  /**
   * Main analysis entry point
   */
  async analyze() {
    console.log('🔍 Starting Log Analysis...');
    console.log(`📁 Input: ${this.options.inputPath}`);
    console.log(`📊 Output: ${this.options.outputPath}`);
    console.log(`🎯 Vendor: ${this.options.vendor}`);
    console.log(`📅 Days: ${this.options.days}\n`);

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Find log files
      const logFiles = await this.findLogFiles();
      console.log(`📋 Found ${logFiles.length} log files to process\n`);

      if (logFiles.length === 0) {
        console.log('❌ No log files found. Check your input path.');
        return;
      }

      // Process each file
      for (const file of logFiles) {
        await this.processLogFile(file);
      }

      // Calculate performance metrics
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      this.stats.performance.processingTime = endTime - startTime;
      this.stats.performance.memoryPeak = Math.max(endMemory, startMemory);
      this.stats.performance.avgEventsPerSecond =
        this.stats.totalEvents / (this.stats.performance.processingTime / 1000);

      // Generate reports
      await this.generateReports();

      console.log('\n✅ Analysis Complete!');
      console.log(`📊 Processed ${this.stats.filesProcessed} files`);
      console.log(`🎯 Analyzed ${this.stats.totalEvents} events`);
      console.log(
        `⚡ ${this.stats.performance.avgEventsPerSecond.toFixed(0)} events/sec`,
      );
      console.log(`📁 Reports saved to: ${this.options.outputPath}`);
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Find log files based on input path and criteria
   */
  async findLogFiles() {
    const files = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.days);

    try {
      if (statSync(this.options.inputPath).isFile()) {
        // Single file
        files.push(this.options.inputPath);
      } else if (statSync(this.options.inputPath).isDirectory()) {
        // Directory - find JSONL files
        const pattern = join(this.options.inputPath, '**/*.jsonl');
        const foundFiles = await glob(pattern);

        for (const file of foundFiles) {
          const stats = statSync(file);
          if (stats.mtime >= cutoffDate) {
            files.push(file);
          }
        }
      }
    } catch (error) {
      // Try as glob pattern
      const foundFiles = await glob(this.options.inputPath);
      for (const file of foundFiles) {
        try {
          const stats = statSync(file);
          if (stats.mtime >= cutoffDate && file.endsWith('.jsonl')) {
            files.push(file);
          }
        } catch (e) {
          // Skip files we can't stat
        }
      }
    }

    // Sort by modification time (newest first)
    files.sort((a, b) => {
      try {
        return statSync(b).mtime - statSync(a).mtime;
      } catch (e) {
        return 0;
      }
    });

    return files;
  }

  /**
   * Process a single log file
   */
  async processLogFile(filePath) {
    const fileName = basename(filePath);
    console.log(`📄 Processing: ${fileName}`);

    const fileStats = {
      path: filePath,
      events: 0,
      types: new Map(),
      errors: 0,
      size: 0,
      processed: new Date().toISOString(),
    };

    try {
      const stats = statSync(filePath);
      fileStats.size = stats.size;

      const input = createReadStream(filePath, { encoding: 'utf8' });

      for await (const event of streamEvents({
        vendor: this.options.vendor,
        source: input,
      })) {
        this.processEvent(event, fileName);
        fileStats.events++;
        fileStats.types.set(event.t, (fileStats.types.get(event.t) || 0) + 1);

        if (event.t === 'error') {
          fileStats.errors++;
        }
      }

      this.stats.byFile.set(fileName, fileStats);
      this.stats.filesProcessed++;

      console.log(`  ✅ ${fileStats.events} events processed`);
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      fileStats.errors++;
      this.stats.errors.byFile.set(fileName, error.message);
    }
  }

  /**
   * Process a single event and update statistics
   */
  processEvent(event, fileName) {
    this.stats.totalEvents++;

    // Update type counts
    this.stats.byType.set(event.t, (this.stats.byType.get(event.t) || 0) + 1);

    // Extract timestamp if available (from debug info or estimate)
    const timestamp = this.extractTimestamp(event) || new Date();

    // Update time range
    if (!this.stats.timeRange.start || timestamp < this.stats.timeRange.start) {
      this.stats.timeRange.start = timestamp;
    }
    if (!this.stats.timeRange.end || timestamp > this.stats.timeRange.end) {
      this.stats.timeRange.end = timestamp;
    }

    // Update hourly distribution
    this.stats.byHour[timestamp.getHours()]++;

    // Update daily distribution
    const dayKey = timestamp.toISOString().split('T')[0];
    this.stats.byDay.set(dayKey, (this.stats.byDay.get(dayKey) || 0) + 1);

    // Process by event type
    switch (event.t) {
      case 'msg':
        this.processMessage(event, timestamp);
        break;
      case 'tool':
        this.processTool(event, timestamp);
        break;
      case 'cost':
        this.processCost(event, timestamp);
        break;
      case 'error':
        this.processError(event, fileName);
        break;
    }
  }

  /**
   * Extract timestamp from event (heuristic)
   */
  extractTimestamp(event) {
    // Try to extract from debug info
    if (event.t === 'debug' && event.raw) {
      if (event.raw.timestamp) {
        return new Date(event.raw.timestamp);
      }
      if (event.raw.created_at) {
        return new Date(event.raw.created_at);
      }
    }

    // Fallback to current time (not ideal but better than nothing)
    return null;
  }

  /**
   * Process message events
   */
  processMessage(event, timestamp) {
    this.stats.messages.total++;
    this.stats.messages.byRole.set(
      event.role,
      (this.stats.messages.byRole.get(event.role) || 0) + 1,
    );
    this.stats.messages.totalChars += event.text.length;
    this.stats.messages.avgLength =
      this.stats.messages.totalChars / this.stats.messages.total;
  }

  /**
   * Process tool events
   */
  processTool(event, timestamp) {
    const toolName = event.name;

    if (event.phase === 'start') {
      this.stats.tools.executions.set(
        toolName,
        (this.stats.tools.executions.get(toolName) || 0) + 1,
      );
    } else if (event.phase === 'end') {
      if (event.exitCode !== 0) {
        this.stats.tools.failures.set(
          toolName,
          (this.stats.tools.failures.get(toolName) || 0) + 1,
        );
      }

      // Calculate success rate
      const executions = this.stats.tools.executions.get(toolName) || 0;
      const failures = this.stats.tools.failures.get(toolName) || 0;
      const successRate =
        executions > 0 ? ((executions - failures) / executions) * 100 : 0;
      this.stats.tools.successRate.set(toolName, successRate);
    }
  }

  /**
   * Process cost events
   */
  processCost(event, timestamp) {
    this.stats.costs.total += event.deltaUsd;

    // By hour
    this.stats.costs.byHour[timestamp.getHours()] += event.deltaUsd;

    // By day
    const dayKey = timestamp.toISOString().split('T')[0];
    this.stats.costs.byDay.set(
      dayKey,
      (this.stats.costs.byDay.get(dayKey) || 0) + event.deltaUsd,
    );
  }

  /**
   * Process error events
   */
  processError(event, fileName) {
    this.stats.errors.total++;

    // Categorize error
    const errorType = this.categorizeError(event.message);
    this.stats.errors.byType.set(
      errorType,
      (this.stats.errors.byType.get(errorType) || 0) + 1,
    );

    // Track by file
    if (!this.stats.errors.byFile.has(fileName)) {
      this.stats.errors.byFile.set(fileName, []);
    }
    this.stats.errors.byFile.get(fileName).push(event.message);

    // Extract error patterns
    const pattern = this.extractErrorPattern(event.message);
    this.stats.errors.patterns.set(
      pattern,
      (this.stats.errors.patterns.get(pattern) || 0) + 1,
    );
  }

  /**
   * Categorize error messages
   */
  categorizeError(message) {
    if (message.includes('JSON') || message.includes('parse'))
      return 'PARSE_ERROR';
    if (message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (message.includes('network') || message.includes('connection'))
      return 'NETWORK_ERROR';
    if (message.includes('permission') || message.includes('access'))
      return 'PERMISSION_ERROR';
    if (message.includes('not found') || message.includes('404'))
      return 'NOT_FOUND_ERROR';
    if (message.includes('validation') || message.includes('invalid'))
      return 'VALIDATION_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * Extract error patterns for grouping
   */
  extractErrorPattern(message) {
    // Remove specific values and keep general pattern
    return message
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9]{8,}/g, 'HASH')
      .replace(/https?:\/\/[^\s]+/g, 'URL')
      .replace(/["'][^"']*["']/g, 'STRING')
      .substring(0, 100);
  }

  /**
   * Generate comprehensive reports
   */
  async generateReports() {
    console.log('\n📊 Generating reports...');

    // Ensure output directory exists
    if (!existsSync(this.options.outputPath)) {
      mkdirSync(this.options.outputPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    switch (this.options.format) {
      case 'html':
        await this.generateHTMLReport(timestamp);
        break;
      case 'json':
        await this.generateJSONReport(timestamp);
        break;
      case 'csv':
        await this.generateCSVReport(timestamp);
        break;
      case 'all':
        await this.generateHTMLReport(timestamp);
        await this.generateJSONReport(timestamp);
        await this.generateCSVReport(timestamp);
        break;
    }
  }

  /**
   * Generate HTML dashboard report
   */
  async generateHTMLReport(timestamp) {
    const fileName = `log-analysis-${timestamp}.html`;
    const filePath = join(this.options.outputPath, fileName);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Log Analysis Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        h1 { color: #333; border-bottom: 3px solid #007acc; padding-bottom: 10px; }
        h2 { color: #555; margin-top: 30px; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007acc;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #007acc;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            margin-top: 5px;
        }
        .chart-container {
            position: relative;
            height: 400px;
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: bold;
        }
        .error { color: #dc3545; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .info { color: #17a2b8; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Agent Log Analysis Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Analysis Period:</strong> ${this.stats.timeRange.start?.toLocaleString() || 'Unknown'} - ${this.stats.timeRange.end?.toLocaleString() || 'Unknown'}</p>
        <p><strong>Files Processed:</strong> ${this.stats.filesProcessed}</p>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${this.stats.totalEvents.toLocaleString()}</div>
                <div class="stat-label">Total Events</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.stats.messages.total.toLocaleString()}</div>
                <div class="stat-label">Messages</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Array.from(this.stats.tools.executions.values()).reduce((a, b) => a + b, 0)}</div>
                <div class="stat-label">Tool Executions</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">$${this.stats.costs.total.toFixed(4)}</div>
                <div class="stat-label">Total Cost</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.stats.errors.total}</div>
                <div class="stat-label">Errors</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${this.stats.performance.avgEventsPerSecond.toFixed(0)}</div>
                <div class="stat-label">Events/Second</div>
            </div>
        </div>

        <h2>📊 Event Distribution</h2>
        <div class="chart-container">
            <canvas id="eventTypesChart"></canvas>
        </div>

        <h2>⏰ Activity by Hour</h2>
        <div class="chart-container">
            <canvas id="hourlyChart"></canvas>
        </div>

        <h2>💰 Cost Analysis</h2>
        <div class="chart-container">
            <canvas id="costChart"></canvas>
        </div>

        <h2>🔧 Tool Performance</h2>
        <table>
            <thead>
                <tr>
                    <th>Tool Name</th>
                    <th>Executions</th>
                    <th>Failures</th>
                    <th>Success Rate</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(this.stats.tools.executions.entries())
                  .sort(([, a], [, b]) => b - a)
                  .map(([tool, executions]) => {
                    const failures = this.stats.tools.failures.get(tool) || 0;
                    const successRate =
                      this.stats.tools.successRate.get(tool) || 0;
                    const statusClass =
                      successRate >= 95
                        ? 'success'
                        : successRate >= 80
                          ? 'warning'
                          : 'error';
                    return `
                      <tr>
                        <td>${tool}</td>
                        <td>${executions}</td>
                        <td class="${failures > 0 ? 'error' : 'success'}">${failures}</td>
                        <td class="${statusClass}">${successRate.toFixed(1)}%</td>
                      </tr>
                    `;
                  })
                  .join('')}
            </tbody>
        </table>

        <h2>❌ Error Analysis</h2>
        <table>
            <thead>
                <tr>
                    <th>Error Type</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(this.stats.errors.byType.entries())
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => {
                    const percentage = (
                      (count / this.stats.errors.total) *
                      100
                    ).toFixed(1);
                    return `
                      <tr>
                        <td>${type}</td>
                        <td class="error">${count}</td>
                        <td>${percentage}%</td>
                      </tr>
                    `;
                  })
                  .join('')}
            </tbody>
        </table>

        <h2>📁 File Processing Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>File</th>
                    <th>Events</th>
                    <th>Size</th>
                    <th>Errors</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(this.stats.byFile.entries())
                  .sort(([, a], [, b]) => b.events - a.events)
                  .map(
                    ([file, stats]) => `
                    <tr>
                      <td>${file}</td>
                      <td>${stats.events}</td>
                      <td>${(stats.size / 1024).toFixed(1)} KB</td>
                      <td class="${stats.errors > 0 ? 'error' : 'success'}">${stats.errors}</td>
                    </tr>
                  `,
                  )
                  .join('')}
            </tbody>
        </table>
    </div>

    <script>
        // Event Types Chart
        const eventTypesCtx = document.getElementById('eventTypesChart').getContext('2d');
        new Chart(eventTypesCtx, {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(Array.from(this.stats.byType.keys()))},
                datasets: [{
                    data: ${JSON.stringify(Array.from(this.stats.byType.values()))},
                    backgroundColor: ['#007acc', '#28a745', '#ffc107', '#dc3545', '#17a2b8']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Event Distribution'
                    }
                }
            }
        });

        // Hourly Activity Chart
        const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
        new Chart(hourlyCtx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => i + ':00'),
                datasets: [{
                    label: 'Events',
                    data: ${JSON.stringify(this.stats.byHour)},
                    backgroundColor: '#007acc'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Activity by Hour'
                    }
                }
            }
        });

        // Cost Chart
        const costCtx = document.getElementById('costChart').getContext('2d');
        new Chart(costCtx, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => i + ':00'),
                datasets: [{
                    label: 'Cost ($)',
                    data: ${JSON.stringify(this.stats.costs.byHour.map(cost => cost.toFixed(6)))},
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Cost Distribution by Hour'
                    }
                }
            }
        });
    </script>
</body>
</html>
    `;

    writeFileSync(filePath, html);
    console.log(`📄 HTML report: ${fileName}`);
  }

  /**
   * Generate JSON report
   */
  async generateJSONReport(timestamp) {
    const fileName = `log-analysis-${timestamp}.json`;
    const filePath = join(this.options.outputPath, fileName);

    const report = {
      metadata: {
        generated: new Date().toISOString(),
        analyzer: 'agent-stream-fmt log analyzer',
        version: '1.0.0',
        options: this.options,
      },
      summary: {
        filesProcessed: this.stats.filesProcessed,
        totalEvents: this.stats.totalEvents,
        timeRange: this.stats.timeRange,
        processingTime: this.stats.performance.processingTime,
        avgEventsPerSecond: this.stats.performance.avgEventsPerSecond,
      },
      events: {
        byType: Object.fromEntries(this.stats.byType),
        byHour: this.stats.byHour,
        byDay: Object.fromEntries(this.stats.byDay),
      },
      tools: {
        executions: Object.fromEntries(this.stats.tools.executions),
        failures: Object.fromEntries(this.stats.tools.failures),
        successRate: Object.fromEntries(this.stats.tools.successRate),
      },
      costs: {
        total: this.stats.costs.total,
        byDay: Object.fromEntries(this.stats.costs.byDay),
        byHour: this.stats.costs.byHour,
      },
      messages: {
        total: this.stats.messages.total,
        byRole: Object.fromEntries(this.stats.messages.byRole),
        avgLength: this.stats.messages.avgLength,
        totalChars: this.stats.messages.totalChars,
      },
      errors: {
        total: this.stats.errors.total,
        byType: Object.fromEntries(this.stats.errors.byType),
        patterns: Object.fromEntries(this.stats.errors.patterns),
        byFile: Object.fromEntries(this.stats.errors.byFile),
      },
      files: Object.fromEntries(
        Array.from(this.stats.byFile.entries()).map(([name, stats]) => [
          name,
          {
            ...stats,
            types: Object.fromEntries(stats.types),
          },
        ]),
      ),
    };

    writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`📄 JSON report: ${fileName}`);
  }

  /**
   * Generate CSV reports (multiple files)
   */
  async generateCSVReport(timestamp) {
    // Events summary CSV
    const eventsFile = join(
      this.options.outputPath,
      `events-summary-${timestamp}.csv`,
    );
    const eventsCSV = [
      'Type,Count,Percentage',
      ...Array.from(this.stats.byType.entries()).map(
        ([type, count]) =>
          `${type},${count},${((count / this.stats.totalEvents) * 100).toFixed(2)}%`,
      ),
    ].join('\n');
    writeFileSync(eventsFile, eventsCSV);

    // Tools performance CSV
    const toolsFile = join(
      this.options.outputPath,
      `tools-performance-${timestamp}.csv`,
    );
    const toolsCSV = [
      'Tool,Executions,Failures,Success Rate',
      ...Array.from(this.stats.tools.executions.entries()).map(
        ([tool, executions]) => {
          const failures = this.stats.tools.failures.get(tool) || 0;
          const successRate = this.stats.tools.successRate.get(tool) || 0;
          return `${tool},${executions},${failures},${successRate.toFixed(1)}%`;
        },
      ),
    ].join('\n');
    writeFileSync(toolsFile, toolsCSV);

    // Files processed CSV
    const filesFile = join(
      this.options.outputPath,
      `files-processed-${timestamp}.csv`,
    );
    const filesCSV = [
      'File,Events,Size (KB),Errors',
      ...Array.from(this.stats.byFile.entries()).map(
        ([file, stats]) =>
          `${file},${stats.events},${(stats.size / 1024).toFixed(1)},${stats.errors}`,
      ),
    ].join('\n');
    writeFileSync(filesFile, filesCSV);

    console.log(
      `📄 CSV reports: events-summary, tools-performance, files-processed`,
    );
  }
}

/**
 * CLI Interface
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.input = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--format':
        options.format = args[++i];
        break;
      case '--vendor':
        options.vendor = args[++i];
        break;
      case '--days':
        options.days = parseInt(args[++i]);
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🔍 Agent Stream Formatter - Log Analyzer

USAGE:
  node log-analyzer.js [options]

OPTIONS:
  --input <path>     Directory or glob pattern for log files (default: ./logs)
  --output <path>    Output directory for reports (default: ./reports)
  --format <type>    Report format: html, json, csv, all (default: html)
  --vendor <name>    Force vendor detection: auto, claude, gemini, amp (default: auto)
  --days <number>    Analyze logs from last N days (default: 30)
  --help             Show this help message

EXAMPLES:
  node log-analyzer.js --input ./agent-logs --format html
  node log-analyzer.js --input "logs/**/*.jsonl" --format all --days 7
  node log-analyzer.js --input single-file.jsonl --output ./analysis --vendor claude

FEATURES:
  • Multi-file log processing and aggregation
  • Time-series analysis of agent activity  
  • Performance metrics and cost tracking
  • Error pattern detection and categorization
  • Interactive HTML dashboard with charts
  • CSV exports for spreadsheet analysis
  • JSON reports for programmatic use
  `);
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Agent Stream Formatter - Log Analyzer\n');

  const options = parseArgs();
  const analyzer = new LogAnalyzer(options);

  try {
    await analyzer.analyze();
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
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

export default LogAnalyzer;
