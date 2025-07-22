import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AmpParser } from '../../src/parsers/amp.js';
import { AgentEvent } from '../../src/types.js';

describe('AmpParser with real fixtures', () => {
  const parser = new AmpParser();
  const fixturesDir = join(process.cwd(), 'tests', 'fixtures', 'amp');

  function parseFixture(filename: string): AgentEvent[] {
    const filepath = join(fixturesDir, filename);
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');

    return lines.flatMap(line => parser.parse(line));
  }

  describe('simple-task.jsonl', () => {
    it('should parse simple task execution', () => {
      const events = parseFixture('simple-task.jsonl');

      expect(events).toHaveLength(4);

      // Start event
      expect(events[0]).toEqual({
        t: 'tool',
        name: 'compile',
        phase: 'start',
      });

      // Output events
      expect(events[1]).toEqual({
        t: 'tool',
        name: 'compile',
        phase: 'stdout',
        text: 'Compiling project...',
      });

      expect(events[2]).toEqual({
        t: 'tool',
        name: 'compile',
        phase: 'stdout',
        text: 'Build successful',
      });

      // End event
      expect(events[3]).toEqual({
        t: 'tool',
        name: 'compile',
        phase: 'end',
        exitCode: 0,
      });
    });
  });

  describe('build-process.jsonl', () => {
    it('should parse complex build process', () => {
      const events = parseFixture('build-process.jsonl');

      // Count event types
      const startEvents = events.filter(
        e => e.t === 'tool' && e.phase === 'start',
      );
      const outputEvents = events.filter(
        e => e.t === 'tool' && (e.phase === 'stdout' || e.phase === 'stderr'),
      );
      const endEvents = events.filter(e => e.t === 'tool' && e.phase === 'end');

      // Verify we have complete sequences
      expect(startEvents.length).toBeGreaterThan(0);
      expect(outputEvents.length).toBeGreaterThan(0);
      expect(endEvents.length).toBeGreaterThan(0);

      // Verify all start events have corresponding end events
      const taskNames = new Set(startEvents.map(e => e.name));
      const endedTasks = new Set(endEvents.map(e => e.name));

      for (const taskName of taskNames) {
        expect(endedTasks.has(taskName)).toBe(true);
      }
    });
  });

  describe('test-execution.jsonl', () => {
    it('should parse test execution with mixed output types', () => {
      const events = parseFixture('test-execution.jsonl');

      // Find stderr events
      const stderrEvents = events.filter(
        e => e.t === 'tool' && e.phase === 'stderr',
      );
      const stdoutEvents = events.filter(
        e => e.t === 'tool' && e.phase === 'stdout',
      );

      // Verify we have both stdout and stderr
      expect(stdoutEvents.length).toBeGreaterThan(0);
      expect(stderrEvents.length).toBeGreaterThan(0);

      // Verify exit codes
      const endEvents = events.filter(e => e.t === 'tool' && e.phase === 'end');
      expect(endEvents.length).toBeGreaterThan(0);

      // All tests in this fixture passed
      const exitCodes = endEvents.map(e => e.exitCode);
      expect(exitCodes).toContain(0);
    });
  });

  describe('all fixtures', () => {
    it('should detect all fixture lines as Amp format', () => {
      const fixtures = [
        'simple-task.jsonl',
        'build-process.jsonl',
        'test-execution.jsonl',
      ];

      for (const filename of fixtures) {
        const filepath = join(fixturesDir, filename);
        const content = readFileSync(filepath, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          expect(parser.detect(line)).toBe(true);
        }
      }
    });

    it('should parse all fixture lines without errors', () => {
      const fixtures = [
        'simple-task.jsonl',
        'build-process.jsonl',
        'test-execution.jsonl',
      ];

      for (const filename of fixtures) {
        const filepath = join(fixturesDir, filename);
        const content = readFileSync(filepath, 'utf-8');
        const lines = content.trim().split('\n');

        for (const line of lines) {
          expect(() => parser.parse(line)).not.toThrow();
        }
      }
    });
  });
});
