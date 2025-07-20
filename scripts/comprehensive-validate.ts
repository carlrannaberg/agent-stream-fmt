#!/usr/bin/env node
/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

// Import parsers and registry
import { registry, detectVendor, selectParser } from '../src/parsers/index.js';
import { ParseError } from '../src/parsers/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

interface ValidationError {
  vendor: string;
  file?: string;
  line?: number;
  type: 'json' | 'detection' | 'parsing' | 'performance';
  message: string;
  details?: any;
}

interface ParseResult {
  line: string;
  lineNumber: number;
  detected: boolean;
  detectedVendor?: string;
  parseTime: number;
  eventCount: number;
  events?: any[];
  error?: string;
}

interface FileResult {
  vendor: string;
  filename: string;
  totalLines: number;
  validLines: number;
  parseResults: ParseResult[];
  averageParseTime: number;
  totalParseTime: number;
  linesPerSecond: number;
  errors: ValidationError[];
}

interface VendorResult {
  vendor: string;
  hasDirectory: boolean;
  files: FileResult[];
  totalLines: number;
  totalParseTime: number;
  averageLinesPerSecond: number;
  detectionAccuracy: number;
  errors: ValidationError[];
}

interface ValidationReport {
  timestamp: string;
  vendors: VendorResult[];
  overallStats: {
    totalVendors: number;
    totalFiles: number;
    totalLines: number;
    totalErrors: number;
    averagePerformance: number;
    registrySize: number;
    availableParsers: string[];
  };
  performanceBenchmarks: {
    minLinesPerSecond: number;
    maxLinesPerSecond: number;
    averageLinesPerSecond: number;
    performanceTarget: number;
    meetsTarget: boolean;
  };
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function validateFile(vendor: string, filename: string): FileResult {
  const fixtureDir = join(dirname(__dirname), 'tests', 'fixtures', vendor);
  const filePath = join(fixtureDir, filename);
  
  const result: FileResult = {
    vendor,
    filename,
    totalLines: 0,
    validLines: 0,
    parseResults: [],
    averageParseTime: 0,
    totalParseTime: 0,
    linesPerSecond: 0,
    errors: []
  };

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (error) {
    result.errors.push({
      vendor,
      file: filename,
      type: 'json',
      message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
    });
    return result;
  }

  const lines = content.split('\n').filter(line => line.trim());
  result.totalLines = lines.length;
  
  if (lines.length === 0) {
    result.errors.push({
      vendor,
      file: filename,
      type: 'json',
      message: 'File is empty or contains no valid lines'
    });
    return result;
  }

  const totalStartTime = performance.now();
  
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const parseResult: ParseResult = {
      line,
      lineNumber,
      detected: false,
      parseTime: 0,
      eventCount: 0
    };

    // Test JSON validity
    try {
      JSON.parse(line);
    } catch (error) {
      result.errors.push({
        vendor,
        file: filename,
        line: lineNumber,
        type: 'json',
        message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
      });
      
      parseResult.error = 'Invalid JSON';
      result.parseResults.push(parseResult);
      continue;
    }

    // Test detection
    const detectStartTime = performance.now();
    const detected = detectVendor(line);
    
    if (detected) {
      parseResult.detected = true;
      parseResult.detectedVendor = detected.vendor;
      
      // Check if detection matches expected vendor
      if (detected.vendor !== vendor) {
        result.errors.push({
          vendor,
          file: filename,
          line: lineNumber,
          type: 'detection',
          message: `Expected vendor '${vendor}', detected '${detected.vendor}'`
        });
      }
      
      // Test parsing
      try {
        const parseTime = performance.now();
        const events = detected.parse(line);
        parseResult.parseTime = performance.now() - parseTime;
        parseResult.events = events;
        parseResult.eventCount = events.length;
        
        // Validate event structure
        for (const event of events) {
          if (!event.t) {
            result.errors.push({
              vendor,
              file: filename,
              line: lineNumber,
              type: 'parsing',
              message: 'Event missing required \'t\' field',
              details: event
            });
          }
        }
        
        result.validLines++;
      } catch (error) {
        parseResult.error = error instanceof Error ? error.message : String(error);
        
        // Parse errors are expected for malformed JSON in error-handling fixtures
        if (!filename.includes('error-handling') || !(error instanceof ParseError)) {
          result.errors.push({
            vendor,
            file: filename,
            line: lineNumber,
            type: 'parsing',
            message: `Parse error: ${parseResult.error}`
          });
        }
      }
    } else {
      result.errors.push({
        vendor,
        file: filename,
        line: lineNumber,
        type: 'detection',
        message: 'Failed to detect vendor'
      });
    }
    
    const detectEndTime = performance.now();
    parseResult.parseTime = detectEndTime - detectStartTime;
    result.parseResults.push(parseResult);
  }
  
  const totalEndTime = performance.now();
  result.totalParseTime = totalEndTime - totalStartTime;
  result.averageParseTime = result.totalParseTime / result.totalLines;
  result.linesPerSecond = (result.totalLines / result.totalParseTime) * 1000;
  
  // Performance validation
  const performanceTarget = 1000; // lines per second
  if (result.linesPerSecond < performanceTarget) {
    result.errors.push({
      vendor,
      file: filename,
      type: 'performance',
      message: `Performance below target: ${result.linesPerSecond.toFixed(2)} lines/sec (target: ${performanceTarget})`
    });
  }
  
  return result;
}

function validateVendor(vendor: string): VendorResult {
  const result: VendorResult = {
    vendor,
    hasDirectory: false,
    files: [],
    totalLines: 0,
    totalParseTime: 0,
    averageLinesPerSecond: 0,
    detectionAccuracy: 0,
    errors: []
  };

  const fixtureDir = join(dirname(__dirname), 'tests', 'fixtures', vendor);

  if (!existsSync(fixtureDir)) {
    result.errors.push({
      vendor,
      type: 'json',
      message: `Fixture directory does not exist: ${fixtureDir}`
    });
    return result;
  }

  result.hasDirectory = true;

  let files: string[];
  try {
    files = readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl'));
  } catch (error) {
    result.errors.push({
      vendor,
      type: 'json',
      message: `Failed to read fixture directory: ${fixtureDir}`
    });
    return result;
  }

  if (files.length === 0) {
    result.errors.push({
      vendor,
      type: 'json',
      message: 'No .jsonl fixture files found'
    });
    return result;
  }

  for (const filename of files) {
    const fileResult = validateFile(vendor, filename);
    result.files.push(fileResult);
    result.totalLines += fileResult.totalLines;
    result.totalParseTime += fileResult.totalParseTime;
    result.errors.push(...fileResult.errors);
  }

  // Calculate overall stats
  if (result.totalLines > 0) {
    result.averageLinesPerSecond = (result.totalLines / result.totalParseTime) * 1000;
    
    const totalDetections = result.files.reduce((sum, file) => 
      sum + file.parseResults.filter(r => r.detected).length, 0
    );
    const correctDetections = result.files.reduce((sum, file) => 
      sum + file.parseResults.filter(r => r.detected && r.detectedVendor === vendor).length, 0
    );
    
    result.detectionAccuracy = totalDetections > 0 ? (correctDetections / totalDetections) * 100 : 0;
  }

  return result;
}

function runPerformanceBenchmarks(): {
  singleLinePerformance: number;
  bulkProcessingPerformance: number;
  memoryUsage: NodeJS.MemoryUsage;
} {
  const testLine = '{"type":"message","role":"assistant","content":"Performance test message"}';
  const testLines = Array(10000).fill(testLine);
  
  // Single line performance test
  const singleStartTime = performance.now();
  for (let i = 0; i < 10000; i++) {
    const parser = selectParser('claude');
    parser.parse(testLine);
  }
  const singleEndTime = performance.now();
  const singleLinePerformance = (10000 / (singleEndTime - singleStartTime)) * 1000;
  
  // Bulk processing performance test
  const bulkStartTime = performance.now();
  for (const line of testLines) {
    const parser = selectParser('claude');
    parser.parse(line);
  }
  const bulkEndTime = performance.now();
  const bulkProcessingPerformance = (testLines.length / (bulkEndTime - bulkStartTime)) * 1000;
  
  return {
    singleLinePerformance,
    bulkProcessingPerformance,
    memoryUsage: process.memoryUsage()
  };
}

function generateReport(results: VendorResult[]): ValidationReport {
  const benchmarks = runPerformanceBenchmarks();
  
  const totalFiles = results.reduce((sum, r) => sum + r.files.length, 0);
  const totalLines = results.reduce((sum, r) => sum + r.totalLines, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  
  const performanceValues = results
    .filter(r => r.averageLinesPerSecond > 0)
    .map(r => r.averageLinesPerSecond);
  
  const performanceTarget = 1000;
  const averagePerformance = performanceValues.length > 0 
    ? performanceValues.reduce((sum, val) => sum + val, 0) / performanceValues.length 
    : 0;
  
  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    vendors: results,
    overallStats: {
      totalVendors: results.length,
      totalFiles,
      totalLines,
      totalErrors,
      averagePerformance,
      registrySize: registry.size(),
      availableParsers: registry.listParsers()
    },
    performanceBenchmarks: {
      minLinesPerSecond: Math.min(...performanceValues, benchmarks.singleLinePerformance),
      maxLinesPerSecond: Math.max(...performanceValues, benchmarks.singleLinePerformance),
      averageLinesPerSecond: averagePerformance,
      performanceTarget,
      meetsTarget: averagePerformance >= performanceTarget
    }
  };
  
  return report;
}

function printResults(report: ValidationReport): void {
  console.log(`${colors.bold}${colors.cyan}📋 Comprehensive Validation Report${colors.reset}`);
  console.log(`${colors.dim}Generated: ${report.timestamp}${colors.reset}\n`);
  
  // Registry info
  console.log(`${colors.bold}Registry Status:${colors.reset}`);
  console.log(`  Size: ${report.overallStats.registrySize}`);
  console.log(`  Parsers: ${report.overallStats.availableParsers.join(', ')}\n`);
  
  // Overall stats
  console.log(`${colors.bold}Overall Statistics:${colors.reset}`);
  console.log(`  Total vendors: ${report.overallStats.totalVendors}`);
  console.log(`  Total files: ${report.overallStats.totalFiles}`);
  console.log(`  Total lines: ${formatNumber(report.overallStats.totalLines)}`);
  console.log(`  Total errors: ${report.overallStats.totalErrors}`);
  console.log(`  Average performance: ${report.overallStats.averagePerformance.toFixed(2)} lines/sec\n`);
  
  // Performance benchmarks
  console.log(`${colors.bold}Performance Benchmarks:${colors.reset}`);
  console.log(`  Target: ${report.performanceBenchmarks.performanceTarget} lines/sec`);
  console.log(`  Average: ${report.performanceBenchmarks.averageLinesPerSecond.toFixed(2)} lines/sec`);
  console.log(`  Range: ${report.performanceBenchmarks.minLinesPerSecond.toFixed(2)} - ${report.performanceBenchmarks.maxLinesPerSecond.toFixed(2)} lines/sec`);
  
  const targetStatus = report.performanceBenchmarks.meetsTarget 
    ? `${colors.green}✓ MEETS TARGET${colors.reset}`
    : `${colors.red}✗ BELOW TARGET${colors.reset}`;
  console.log(`  Status: ${targetStatus}\n`);
  
  // Vendor results
  for (const vendor of report.vendors) {
    console.log(`${colors.bold}${vendor.vendor.toUpperCase()}:${colors.reset}`);
    
    if (!vendor.hasDirectory) {
      console.log(`  ${colors.red}✗ Directory missing${colors.reset}`);
      continue;
    }
    
    if (vendor.files.length === 0) {
      console.log(`  ${colors.yellow}⚠ No .jsonl files found${colors.reset}`);
      continue;
    }
    
    console.log(`  Files: ${vendor.files.length}`);
    console.log(`  Total lines: ${formatNumber(vendor.totalLines)}`);
    console.log(`  Performance: ${vendor.averageLinesPerSecond.toFixed(2)} lines/sec`);
    console.log(`  Detection accuracy: ${vendor.detectionAccuracy.toFixed(1)}%`);
    console.log(`  Errors: ${vendor.errors.length}`);
    
    // File breakdown
    for (const file of vendor.files) {
      const fileStatus = file.errors.length === 0 
        ? `${colors.green}✓${colors.reset}`
        : `${colors.red}✗${colors.reset}`;
      
      const performanceColor = file.linesPerSecond >= 1000 ? colors.green : colors.yellow;
      
      console.log(`    ${fileStatus} ${file.filename}`);
      console.log(`      Lines: ${file.totalLines} (${file.validLines} valid)`);
      console.log(`      Performance: ${performanceColor}${file.linesPerSecond.toFixed(2)} lines/sec${colors.reset}`);
      console.log(`      Parse time: ${formatDuration(file.averageParseTime)} avg`);
      
      if (file.errors.length > 0) {
        console.log(`      Errors: ${file.errors.length}`);
        
        // Group errors by type
        const errorsByType = file.errors.reduce((acc, error) => {
          acc[error.type] = (acc[error.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        for (const [type, count] of Object.entries(errorsByType)) {
          console.log(`        ${type}: ${count}`);
        }
      }
    }
    
    console.log('');
  }
  
  // Error summary
  if (report.overallStats.totalErrors > 0) {
    console.log(`${colors.bold}${colors.red}Error Summary:${colors.reset}`);
    
    const allErrors = report.vendors.flatMap(v => v.errors);
    const errorsByType = allErrors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    for (const [type, count] of Object.entries(errorsByType)) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log('');
  }
  
  // Final status
  const overallStatus = report.overallStats.totalErrors === 0 && report.performanceBenchmarks.meetsTarget
    ? `${colors.green}${colors.bold}✓ ALL TESTS PASSED${colors.reset}`
    : `${colors.red}${colors.bold}✗ ISSUES FOUND${colors.reset}`;
  
  console.log(`${overallStatus}\n`);
}

function saveReport(report: ValidationReport): void {
  const reportPath = join(dirname(__dirname), 'validation-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${colors.dim}Report saved to: ${reportPath}${colors.reset}`);
}

function main(): void {
  const vendors = ['claude', 'gemini', 'amp'] as const;
  const results: VendorResult[] = [];
  
  console.log(`${colors.bold}${colors.cyan}🔍 Running Comprehensive Validation...${colors.reset}\n`);
  
  for (const vendor of vendors) {
    process.stdout.write(`${colors.dim}Validating ${vendor}...${colors.reset}`);
    const result = validateVendor(vendor);
    results.push(result);
    
    const status = result.errors.length === 0 
      ? `${colors.green} ✓${colors.reset}`
      : `${colors.red} ✗ (${result.errors.length} errors)${colors.reset}`;
    console.log(status);
  }
  
  console.log('');
  
  const report = generateReport(results);
  printResults(report);
  
  // Save report to file
  saveReport(report);
  
  // Exit with appropriate code
  const hasErrors = report.overallStats.totalErrors > 0;
  const meetsPerformance = report.performanceBenchmarks.meetsTarget;
  
  if (hasErrors || !meetsPerformance) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
