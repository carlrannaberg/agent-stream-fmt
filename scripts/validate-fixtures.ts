#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

interface ValidationError {
  vendor: string;
  file?: string;
  line?: number;
  message: string;
}

interface ValidationResult {
  vendor: string;
  hasDirectory: boolean;
  files: string[];
  errors: ValidationError[];
}

function formatError(error: ValidationError): string {
  if (error.file && error.line !== undefined) {
    return `${colors.red}✗${colors.reset} ${error.vendor}/${error.file}:${error.line} - ${error.message}`;
  } else if (error.file) {
    return `${colors.red}✗${colors.reset} ${error.vendor}/${error.file} - ${error.message}`;
  } else {
    return `${colors.red}✗${colors.reset} ${error.vendor} - ${error.message}`;
  }
}

function validateVendor(vendor: string): ValidationResult {
  const result: ValidationResult = {
    vendor,
    hasDirectory: false,
    files: [],
    errors: [],
  };

  const fixtureDir = join(dirname(__dirname), 'tests', 'fixtures', vendor);

  // Check if directory exists
  if (!existsSync(fixtureDir)) {
    result.errors.push({
      vendor,
      message: `Fixture directory does not exist: ${fixtureDir}`,
    });
    return result;
  }

  result.hasDirectory = true;

  // Get all .jsonl files
  try {
    result.files = readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl'));
  } catch (error) {
    result.errors.push({
      vendor,
      message: `Failed to read fixture directory: ${fixtureDir}`,
    });
    return result;
  }

  // Check if there are any .jsonl files
  if (result.files.length === 0) {
    result.errors.push({
      vendor,
      message: 'No .jsonl fixture files found',
    });
    return result;
  }

  // Validate each JSONL file
  for (const file of result.files) {
    const filePath = join(fixtureDir, file);
    let content: string;

    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (error) {
      result.errors.push({
        vendor,
        file,
        message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    const lines = content.split('\n').filter(line => line.trim());

    for (const [index, line] of lines.entries()) {
      try {
        JSON.parse(line);
      } catch (error) {
        result.errors.push({
          vendor,
          file,
          line: index + 1,
          message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }

  return result;
}

function main() {
  const vendors = ['claude', 'gemini', 'amp'] as const;
  const results: ValidationResult[] = [];

  console.log(`${colors.bold}${colors.cyan}Validating fixture files...${colors.reset}\n`);

  for (const vendor of vendors) {
    results.push(validateVendor(vendor));
  }

  // Display results
  let totalErrors = 0;
  let totalFiles = 0;
  let totalLines = 0;
  let validVendors = 0;

  for (const result of results) {
    console.log(`${colors.bold}${result.vendor}:${colors.reset}`);

    if (!result.hasDirectory) {
      console.log(`  ${colors.red}✗ Directory missing${colors.reset}`);
    } else if (result.files.length === 0) {
      console.log(`  ${colors.yellow}⚠ No .jsonl files found${colors.reset}`);
    } else {
      console.log(`  ${colors.green}✓ ${result.files.length} fixture file(s)${colors.reset}`);
      
      for (const file of result.files) {
        const fileErrors = result.errors.filter(e => e.file === file);
        if (fileErrors.length === 0) {
          console.log(`    ${colors.green}✓${colors.reset} ${file}`);
        } else {
          console.log(`    ${colors.red}✗${colors.reset} ${file} (${fileErrors.length} error${fileErrors.length > 1 ? 's' : ''})`);
        }
      }
    }

    if (result.errors.length > 0) {
      console.log('');
      // Group errors by file
      const errorsByFile = new Map<string | undefined, ValidationError[]>();
      for (const error of result.errors) {
        const key = error.file;
        if (!errorsByFile.has(key)) {
          errorsByFile.set(key, []);
        }
        errorsByFile.get(key)!.push(error);
      }

      for (const [file, errors] of errorsByFile) {
        if (file) {
          console.log(`  ${colors.bold}Errors in ${file}:${colors.reset}`);
          for (const error of errors) {
            if (error.line !== undefined) {
              console.log(`    Line ${error.line}: ${error.message}`);
            } else {
              console.log(`    ${error.message}`);
            }
          }
        } else {
          for (const error of errors) {
            console.log(`  ${error.message}`);
          }
        }
      }
    }

    console.log('');

    totalErrors += result.errors.length;
    totalFiles += result.files.length;
    if (result.hasDirectory && result.errors.length === 0) {
      validVendors++;
    }
  }

  // Summary
  console.log(`${colors.bold}${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Total vendors: ${vendors.length}`);
  console.log(`  Valid vendors: ${validVendors}`);
  console.log(`  Total files: ${totalFiles}`);
  console.log(`  Total errors: ${totalErrors}`);

  if (totalErrors === 0) {
    console.log(`\n${colors.green}${colors.bold}All fixtures are valid! ✓${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}Fixture validation failed with ${totalErrors} error${totalErrors > 1 ? 's' : ''}${colors.reset}`);
    process.exit(1);
  }
}

main();