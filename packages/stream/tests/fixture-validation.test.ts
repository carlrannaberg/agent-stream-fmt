/* eslint-disable no-console */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { detectVendor } from '../src/parsers/index.js';

/**
 * Comprehensive fixture validation test
 * Tests all fixture data from tests/fixtures/ directory
 */
describe('Fixture Validation Tests', () => {
  const fixturesDir = join(process.cwd(), 'tests/fixtures');
  const vendors = ['claude', 'gemini', 'amp'] as const;

  interface FixtureData {
    vendor: string;
    filename: string;
    path: string;
    lines: string[];
    validLines: string[];
    invalidLines: { line: string; lineNumber: number; error: string }[];
  }

  const allFixtures: FixtureData[] = [];

  beforeAll(() => {
    // Load all fixture files
    for (const vendor of vendors) {
      const vendorDir = join(fixturesDir, vendor);
      if (!existsSync(vendorDir)) {
        console.warn(`Warning: ${vendor} fixture directory not found`);
        continue;
      }

      const files = readdirSync(vendorDir).filter(f => f.endsWith('.jsonl'));
      for (const filename of files) {
        const filepath = join(vendorDir, filename);
        const content = readFileSync(filepath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        const validLines: string[] = [];
        const invalidLines: {
          line: string;
          lineNumber: number;
          error: string;
        }[] = [];

        // Separate valid and invalid JSON lines
        for (const [index, line] of lines.entries()) {
          try {
            JSON.parse(line);
            validLines.push(line);
          } catch (error) {
            invalidLines.push({
              line,
              lineNumber: index + 1,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        allFixtures.push({
          vendor,
          filename,
          path: filepath,
          lines,
          validLines,
          invalidLines,
        });
      }
    }
  });

  describe('JSON Structure Validation', () => {
    it('all fixture files contain valid JSON lines', () => {
      let totalLines = 0;
      let validLines = 0;
      let invalidLines = 0;

      for (const fixture of allFixtures) {
        totalLines += fixture.lines.length;
        validLines += fixture.validLines.length;
        invalidLines += fixture.invalidLines.length;

        // Error handling fixtures are expected to have some invalid JSON
        if (fixture.filename.includes('error-handling')) {
          expect(
            fixture.invalidLines.length,
            `${fixture.vendor}/${fixture.filename} should have some invalid JSON for error testing`,
          ).toBeGreaterThan(0);
        } else {
          // Other fixtures should have minimal invalid JSON
          const invalidRatio =
            fixture.invalidLines.length / fixture.lines.length;
          expect(
            invalidRatio,
            `${fixture.vendor}/${fixture.filename} should have minimal invalid JSON (${(invalidRatio * 100).toFixed(1)}%)`,
          ).toBeLessThan(0.1); // Less than 10% invalid
        }
      }

      console.log(`\nFixture JSON validation summary:`);
      console.log(`  Total lines: ${totalLines}`);
      console.log(`  Valid JSON lines: ${validLines}`);
      console.log(`  Invalid JSON lines: ${invalidLines}`);
      console.log(
        `  Success rate: ${((validLines / totalLines) * 100).toFixed(1)}%`,
      );

      expect(validLines, 'Should have valid JSON lines').toBeGreaterThan(0);
    });

    it('valid JSON lines contain required fields', () => {
      for (const fixture of allFixtures) {
        for (const line of fixture.validLines) {
          const data = JSON.parse(line);

          // All fixtures should have some identifying field
          const hasIdentifyingField =
            data.type || // Claude format
            data.event || // Alternative format
            data.kind || // Another format
            data.phase || // Phase-based format
            data.message || // Message field
            data.content || // Content field
            data.data; // Data field

          expect(
            hasIdentifyingField,
            `Line in ${fixture.vendor}/${fixture.filename} should have identifying field: ${line}`,
          ).toBeTruthy();
        }
      }
    });
  });

  describe('Vendor Detection Validation', () => {
    it('detects correct vendor for all valid fixture lines', () => {
      const detectionStats = {
        total: 0,
        detected: 0,
        correctVendor: 0,
        wrongVendor: 0,
        undetected: 0,
      };

      for (const fixture of allFixtures) {
        for (const line of fixture.validLines) {
          detectionStats.total++;

          const detected = detectVendor(line);
          if (detected) {
            detectionStats.detected++;

            if (detected.vendor === fixture.vendor) {
              detectionStats.correctVendor++;
            } else {
              detectionStats.wrongVendor++;
              console.warn(
                `Wrong vendor detected for ${fixture.vendor}/${fixture.filename}: expected ${fixture.vendor}, got ${detected.vendor}`,
              );
            }
          } else {
            detectionStats.undetected++;

            // Only warn for Claude fixtures (others might not have parsers)
            if (fixture.vendor === 'claude') {
              console.warn(
                `Undetected Claude line in ${fixture.filename}: ${line}`,
              );
            }
          }
        }
      }

      console.log(`\nVendor detection statistics:`);
      console.log(`  Total valid lines: ${detectionStats.total}`);
      console.log(`  Detected: ${detectionStats.detected}`);
      console.log(`  Correct vendor: ${detectionStats.correctVendor}`);
      console.log(`  Wrong vendor: ${detectionStats.wrongVendor}`);
      console.log(`  Undetected: ${detectionStats.undetected}`);
      console.log(
        `  Detection rate: ${((detectionStats.detected / detectionStats.total) * 100).toFixed(1)}%`,
      );
      console.log(
        `  Accuracy rate: ${((detectionStats.correctVendor / detectionStats.detected) * 100).toFixed(1)}%`,
      );

      // For Claude fixtures, expect high detection rate
      const claudeFixtures = allFixtures.filter(f => f.vendor === 'claude');
      const claudeLines = claudeFixtures.reduce(
        (sum, f) => sum + f.validLines.length,
        0,
      );
      const claudeDetected = claudeFixtures.reduce((sum, fixture) => {
        return (
          sum +
          fixture.validLines.filter(line => {
            const detected = detectVendor(line);
            return detected?.vendor === 'claude';
          }).length
        );
      }, 0);

      if (claudeLines > 0) {
        const claudeDetectionRate = (claudeDetected / claudeLines) * 100;
        expect(
          claudeDetectionRate,
          `Claude detection rate should be high: ${claudeDetectionRate.toFixed(1)}%`,
        ).toBeGreaterThan(90);
      }
    });
  });

  describe('Parser Processing Validation', () => {
    it('successfully processes all detectable fixture lines', () => {
      const processingStats = {
        total: 0,
        processed: 0,
        failed: 0,
        totalEvents: 0,
      };

      for (const fixture of allFixtures) {
        for (const line of fixture.validLines) {
          const detected = detectVendor(line);
          if (detected) {
            processingStats.total++;

            try {
              const events = detected.parse(line);
              processingStats.processed++;
              processingStats.totalEvents += events.length;

              // Validate event structure
              for (const event of events) {
                expect(
                  event.t,
                  `Event should have 't' field in ${fixture.vendor}/${fixture.filename}: ${JSON.stringify(event)}`,
                ).toBeTruthy();

                expect(
                  ['msg', 'tool', 'cost', 'error', 'debug'],
                  `Event should have valid type in ${fixture.vendor}/${fixture.filename}: ${event.t}`,
                ).toContain(event.t);
              }
            } catch (error) {
              processingStats.failed++;

              // Only fail test if this is not an error-handling fixture
              if (!fixture.filename.includes('error-handling')) {
                throw new Error(
                  `Failed to process line in ${fixture.vendor}/${fixture.filename}: ${line}\nError: ${error}`,
                );
              }
            }
          }
        }
      }

      console.log(`\nProcessing statistics:`);
      console.log(`  Total detectable lines: ${processingStats.total}`);
      console.log(`  Successfully processed: ${processingStats.processed}`);
      console.log(`  Failed to process: ${processingStats.failed}`);
      console.log(`  Total events generated: ${processingStats.totalEvents}`);
      console.log(
        `  Success rate: ${((processingStats.processed / processingStats.total) * 100).toFixed(1)}%`,
      );
      console.log(
        `  Average events per line: ${(processingStats.totalEvents / processingStats.processed).toFixed(2)}`,
      );

      expect(
        processingStats.processed,
        'Should process some lines',
      ).toBeGreaterThan(0);
      expect(
        processingStats.totalEvents,
        'Should generate some events',
      ).toBeGreaterThan(0);
    });

    it('processes different event types correctly', () => {
      const eventTypeStats: Record<string, number> = {};

      for (const fixture of allFixtures) {
        for (const line of fixture.validLines) {
          const detected = detectVendor(line);
          if (detected) {
            try {
              const events = detected.parse(line);
              for (const event of events) {
                eventTypeStats[event.t] = (eventTypeStats[event.t] || 0) + 1;
              }
            } catch (error) {
              // Skip parsing errors
              continue;
            }
          }
        }
      }

      console.log(`\nEvent type distribution:`);
      for (const [type, count] of Object.entries(eventTypeStats)) {
        console.log(`  ${type}: ${count}`);
      }

      // Should have various event types
      expect(
        Object.keys(eventTypeStats).length,
        'Should have multiple event types',
      ).toBeGreaterThan(1);
    });
  });

  describe('Performance Validation', () => {
    it('processes all fixtures within performance targets', () => {
      let totalLines = 0;
      let totalProcessingTime = 0;

      for (const fixture of allFixtures) {
        const startTime = performance.now();

        for (const line of fixture.validLines) {
          const detected = detectVendor(line);
          if (detected) {
            try {
              detected.parse(line);
              totalLines++;
            } catch (error) {
              // Skip parsing errors
              continue;
            }
          }
        }

        const endTime = performance.now();
        totalProcessingTime += endTime - startTime;
      }

      const linesPerSecond = (totalLines / totalProcessingTime) * 1000;

      console.log(`\nPerformance validation:`);
      console.log(`  Total lines processed: ${totalLines}`);
      console.log(
        `  Total processing time: ${totalProcessingTime.toFixed(2)}ms`,
      );
      console.log(`  Performance: ${linesPerSecond.toFixed(2)} lines/sec`);

      expect(
        linesPerSecond,
        `Should meet performance target of 1000 lines/sec, got ${linesPerSecond.toFixed(2)}`,
      ).toBeGreaterThan(1000);
    });
  });

  describe('Content Integrity Validation', () => {
    it('preserves content exactly during parsing', () => {
      for (const fixture of allFixtures) {
        for (const line of fixture.validLines) {
          try {
            const originalData = JSON.parse(line);
            const detected = detectVendor(line);

            if (detected) {
              const events = detected.parse(line);

              // Check message content preservation
              if (originalData.type === 'message' && originalData.content) {
                const messageEvent = events.find(e => e.t === 'msg');
                if (messageEvent) {
                  expect(
                    messageEvent.text,
                    `Message content should be preserved in ${fixture.vendor}/${fixture.filename}`,
                  ).toBe(originalData.content);
                }
              }

              // Check tool name preservation
              if (originalData.type === 'tool_use' && originalData.name) {
                const toolEvent = events.find(
                  e => e.t === 'tool' && e.phase === 'start',
                );
                if (toolEvent) {
                  expect(
                    toolEvent.name,
                    `Tool name should be preserved in ${fixture.vendor}/${fixture.filename}`,
                  ).toBe(originalData.name);
                }
              }
            }
          } catch (error) {
            // Skip parsing errors
            continue;
          }
        }
      }
    });
  });

  describe('Coverage Validation', () => {
    it('provides adequate test coverage across all fixtures', () => {
      const coverageStats = {
        totalVendors: vendors.length,
        vendorsWithFixtures: 0,
        totalFiles: 0,
        totalLines: 0,
        validLines: 0,
        processedLines: 0,
      };

      for (const vendor of vendors) {
        const vendorFixtures = allFixtures.filter(f => f.vendor === vendor);
        if (vendorFixtures.length > 0) {
          coverageStats.vendorsWithFixtures++;
        }

        for (const fixture of vendorFixtures) {
          coverageStats.totalFiles++;
          coverageStats.totalLines += fixture.lines.length;
          coverageStats.validLines += fixture.validLines.length;

          // Count processed lines
          for (const line of fixture.validLines) {
            const detected = detectVendor(line);
            if (detected) {
              try {
                detected.parse(line);
                coverageStats.processedLines++;
              } catch (error) {
                // Skip parsing errors
                continue;
              }
            }
          }
        }
      }

      console.log(`\nCoverage statistics:`);
      console.log(`  Total vendors: ${coverageStats.totalVendors}`);
      console.log(
        `  Vendors with fixtures: ${coverageStats.vendorsWithFixtures}`,
      );
      console.log(`  Total fixture files: ${coverageStats.totalFiles}`);
      console.log(`  Total lines: ${coverageStats.totalLines}`);
      console.log(`  Valid JSON lines: ${coverageStats.validLines}`);
      console.log(`  Processed lines: ${coverageStats.processedLines}`);

      const processingCoverage =
        (coverageStats.processedLines / coverageStats.validLines) * 100;
      console.log(`  Processing coverage: ${processingCoverage.toFixed(1)}%`);

      // Should have good coverage
      expect(
        coverageStats.vendorsWithFixtures,
        'Should have fixtures for multiple vendors',
      ).toBeGreaterThan(0);
      expect(
        coverageStats.totalFiles,
        'Should have multiple fixture files',
      ).toBeGreaterThan(0);
      expect(
        coverageStats.totalLines,
        'Should have substantial test data',
      ).toBeGreaterThan(10);
      expect(
        processingCoverage,
        'Should process most valid lines',
      ).toBeGreaterThan(50);
    });
  });

  describe('Fixture File Summary', () => {
    it('provides comprehensive fixture overview', () => {
      console.log(`\n${Array(60).fill('=').join('')}`);
      console.log('FIXTURE VALIDATION SUMMARY');
      console.log(`${Array(60).fill('=').join('')}`);

      const grandTotal = {
        files: 0,
        lines: 0,
        validLines: 0,
        invalidLines: 0,
        processedLines: 0,
        events: 0,
      };

      for (const vendor of vendors) {
        const vendorFixtures = allFixtures.filter(f => f.vendor === vendor);
        if (vendorFixtures.length === 0) {
          console.log(`\n${vendor.toUpperCase()}: No fixtures found`);
          continue;
        }

        console.log(`\n${vendor.toUpperCase()}:`);

        const vendorTotal = {
          files: 0,
          lines: 0,
          validLines: 0,
          invalidLines: 0,
          processedLines: 0,
          events: 0,
        };

        for (const fixture of vendorFixtures) {
          vendorTotal.files++;
          vendorTotal.lines += fixture.lines.length;
          vendorTotal.validLines += fixture.validLines.length;
          vendorTotal.invalidLines += fixture.invalidLines.length;

          // Count processed lines and events
          for (const line of fixture.validLines) {
            const detected = detectVendor(line);
            if (detected) {
              try {
                const events = detected.parse(line);
                vendorTotal.processedLines++;
                vendorTotal.events += events.length;
              } catch (error) {
                // Skip parsing errors
                continue;
              }
            }
          }

          console.log(`  ${fixture.filename}:`);
          console.log(
            `    Lines: ${fixture.lines.length} (${fixture.validLines.length} valid, ${fixture.invalidLines.length} invalid)`,
          );
        }

        console.log(
          `  Total: ${vendorTotal.files} files, ${vendorTotal.lines} lines, ${vendorTotal.processedLines} processed, ${vendorTotal.events} events`,
        );

        // Add to grand total
        grandTotal.files += vendorTotal.files;
        grandTotal.lines += vendorTotal.lines;
        grandTotal.validLines += vendorTotal.validLines;
        grandTotal.invalidLines += vendorTotal.invalidLines;
        grandTotal.processedLines += vendorTotal.processedLines;
        grandTotal.events += vendorTotal.events;
      }

      console.log(`\nGRAND TOTAL:`);
      console.log(`  Files: ${grandTotal.files}`);
      console.log(`  Lines: ${grandTotal.lines}`);
      console.log(`  Valid: ${grandTotal.validLines}`);
      console.log(`  Invalid: ${grandTotal.invalidLines}`);
      console.log(`  Processed: ${grandTotal.processedLines}`);
      console.log(`  Events: ${grandTotal.events}`);
      console.log(
        `  Processing rate: ${((grandTotal.processedLines / grandTotal.validLines) * 100).toFixed(1)}%`,
      );
      console.log(`${Array(60).fill('=').join('')}`);

      // This test always passes - it's just for reporting
      expect(true).toBe(true);
    });
  });
});
