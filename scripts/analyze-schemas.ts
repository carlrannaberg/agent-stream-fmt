#!/usr/bin/env tsx
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { writeFileSync } from 'fs';

interface SchemaAnalysis {
  vendor: string;
  file: string;
  lineCount: number;
  eventTypes: Map<string, number>;
  uniqueKeys: Set<string>;
  samples: Map<string, any>;
  errors: string[];
}

function analyzeFile(vendor: string, filename: string): SchemaAnalysis {
  const filepath = join('tests/fixtures', vendor, filename);
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const analysis: SchemaAnalysis = {
    vendor,
    file: filename,
    lineCount: lines.length,
    eventTypes: new Map(),
    uniqueKeys: new Set(),
    samples: new Map(),
    errors: [],
  };

  for (const [index, line] of lines.entries()) {
    try {
      const obj = JSON.parse(line);

      // Determine event type
      const eventType = obj.type || obj.kind || obj.phase || 'unknown';
      analysis.eventTypes.set(
        eventType,
        (analysis.eventTypes.get(eventType) || 0) + 1,
      );

      // Collect all keys
      const collectKeys = (obj: any, prefix = '') => {
        for (const key of Object.keys(obj)) {
          analysis.uniqueKeys.add(prefix + key);
          if (
            typeof obj[key] === 'object' &&
            obj[key] !== null &&
            !Array.isArray(obj[key])
          ) {
            collectKeys(obj[key], `${prefix}${key}.`);
          }
        }
      };
      collectKeys(obj);

      // Save first sample of each type
      if (!analysis.samples.has(eventType)) {
        analysis.samples.set(eventType, obj);
      }
    } catch (error) {
      analysis.errors.push(`Line ${index + 1}: ${(error as Error).message}`);
    }
  }

  return analysis;
}

function generateReport(): string {
  const vendors = ['claude', 'gemini', 'amp'];
  const report: string[] = ['# JSONL Schema Analysis Report\n'];

  report.push(`Generated on: ${new Date().toISOString()}\n`);

  for (const vendor of vendors) {
    report.push(`## ${vendor.toUpperCase()}\n`);

    try {
      const vendorDir = join('tests/fixtures', vendor);

      // Check if vendor directory exists
      if (!existsSync(vendorDir)) {
        report.push(`*No fixtures directory found for ${vendor}*\n`);
        continue;
      }

      const files = readdirSync(vendorDir).filter(f => f.endsWith('.jsonl'));

      if (files.length === 0) {
        report.push(`*No JSONL files found for ${vendor}*\n`);
        continue;
      }

      for (const file of files) {
        const analysis = analyzeFile(vendor, file);

        report.push(`### ${file}`);
        report.push(`- Lines: ${analysis.lineCount}`);
        report.push(`- Parse errors: ${analysis.errors.length}`);
        report.push(`\n**Event Types:**`);

        // Sort event types by count (descending)
        const sortedEventTypes = Array.from(analysis.eventTypes.entries()).sort(
          (a, b) => b[1] - a[1],
        );

        for (const [type, count] of sortedEventTypes) {
          report.push(`- \`${type}\`: ${count} occurrences`);
        }

        // Sort unique keys alphabetically
        const sortedKeys = Array.from(analysis.uniqueKeys).sort();
        report.push(`\n**Unique Keys (${sortedKeys.length} total):**`);
        report.push(`\`${sortedKeys.join('`, `')}\``);

        report.push(`\n**Sample Events:**`);
        for (const [type, sample] of analysis.samples) {
          report.push(`\n*${type}:*`);
          report.push('```json');
          report.push(JSON.stringify(sample, null, 2));
          report.push('```');
        }

        if (analysis.errors.length > 0) {
          report.push(`\n**Parse Errors:**`);
          analysis.errors.slice(0, 5).forEach(err => report.push(`- ${err}`));
          if (analysis.errors.length > 5) {
            report.push(`- ... and ${analysis.errors.length - 5} more errors`);
          }
        }

        report.push('');
      }
    } catch (error) {
      report.push(
        `Error reading ${vendor} fixtures: ${(error as Error).message}\n`,
      );
    }
  }

  // Add summary section
  report.push('## Summary\n');
  let totalFiles = 0;
  let totalLines = 0;
  let totalErrors = 0;
  const allEventTypes = new Map<string, number>();

  for (const vendor of vendors) {
    try {
      const vendorDir = join('tests/fixtures', vendor);
      if (!existsSync(vendorDir)) continue;

      const files = readdirSync(vendorDir).filter(f => f.endsWith('.jsonl'));
      totalFiles += files.length;

      for (const file of files) {
        const analysis = analyzeFile(vendor, file);
        totalLines += analysis.lineCount;
        totalErrors += analysis.errors.length;

        for (const [type, count] of analysis.eventTypes) {
          allEventTypes.set(type, (allEventTypes.get(type) || 0) + count);
        }
      }
    } catch (error) {
      // Skip vendor on error
    }
  }

  report.push(`- Total fixture files: ${totalFiles}`);
  report.push(`- Total lines analyzed: ${totalLines}`);
  report.push(`- Total parse errors: ${totalErrors}`);
  report.push(`\n**All Event Types Across Vendors:**`);

  const sortedAllEventTypes = Array.from(allEventTypes.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  for (const [type, count] of sortedAllEventTypes) {
    report.push(`- \`${type}\`: ${count} total occurrences`);
  }

  return report.join('\n');
}

// Main execution
try {
  console.log('Analyzing JSONL schemas...\n');

  const report = generateReport();
  console.log(report);

  // Save to file
  const outputPath = 'tests/fixtures/SCHEMA_ANALYSIS.md';
  writeFileSync(outputPath, report);
  console.log(`\nReport saved to ${outputPath}`);
} catch (error) {
  console.error('Error generating report:', error);
  process.exit(1);
}
