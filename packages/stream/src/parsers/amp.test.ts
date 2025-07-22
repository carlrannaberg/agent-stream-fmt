import { describe, it, expect } from 'vitest';
import { AmpParser } from './amp.js';
import { ParseError } from './types.js';
import type { ToolEvent } from '../types.js';

describe('AmpParser', () => {
  const parser = new AmpParser();

  describe('detect', () => {
    it('should detect valid Amp events', () => {
      const validLines = [
        '{"phase":"start","task":"build"}',
        '{"phase":"output","task":"test","type":"stdout","content":"Running tests"}',
        '{"phase":"end","task":"deploy","exitCode":0}',
        '{"phase":"start","task":"compile","timestamp":"2024-01-01T10:00:00Z"}',
        '{"phase":"output","task":"run","type":"stderr","content":"Error occurred"}',
      ];

      for (const line of validLines) {
        expect(parser.detect(line)).toBe(true);
      }
    });

    it('should not detect invalid or non-Amp formats', () => {
      const invalidLines = [
        '{"type":"message","role":"user","content":"hello"}', // Claude format
        '{"event":"task_started","name":"build"}', // Different format
        '{"phase":"invalid","task":"build"}', // Invalid phase
        '{"phase":"start"}', // Missing task
        '{"task":"build"}', // Missing phase
        'invalid json', // Invalid JSON
        '{"phase":123,"task":"build"}', // Phase not string
        '{"phase":"start","task":123}', // Task not string
        '{}', // Empty object
      ];

      for (const line of invalidLines) {
        expect(parser.detect(line)).toBe(false);
      }
    });

    it('should be case-sensitive for phase values', () => {
      const invalidCases = [
        '{"phase":"START","task":"build"}',
        '{"phase":"Start","task":"build"}',
        '{"phase":"OUTPUT","task":"test"}',
        '{"phase":"End","task":"deploy"}',
      ];

      for (const line of invalidCases) {
        expect(parser.detect(line)).toBe(false);
      }
    });

    it('should not throw on invalid JSON', () => {
      expect(() => parser.detect('invalid json')).not.toThrow();
      expect(parser.detect('invalid json')).toBe(false);
    });
  });

  describe('parse', () => {
    describe('start phase', () => {
      it('should parse start phase events correctly', () => {
        const line = '{"phase":"start","task":"build"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'build',
          phase: 'start',
        });
      });

      it('should handle missing task name in start phase', () => {
        const line = '{"phase":"start"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown',
          phase: 'start',
        });
      });

      it('should handle null task name in start phase', () => {
        const line = '{"phase":"start","task":null}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown',
          phase: 'start',
        });
      });

      it('should handle empty task name in start phase', () => {
        const line = '{"phase":"start","task":""}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown',
          phase: 'start',
        });
      });
    });

    describe('output phase', () => {
      it('should parse stdout output events correctly', () => {
        const line =
          '{"phase":"output","task":"test","type":"stdout","content":"Test passed"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'test',
          phase: 'stdout',
          text: 'Test passed',
        });
      });

      it('should parse stderr output events correctly', () => {
        const line =
          '{"phase":"output","task":"test","type":"stderr","content":"Warning: deprecated"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'test',
          phase: 'stderr',
          text: 'Warning: deprecated',
        });
      });

      it('should default to stdout when type is missing', () => {
        const line = '{"phase":"output","task":"run","content":"Output text"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'run',
          phase: 'stdout',
          text: 'Output text',
        });
      });

      it('should handle missing content in output phase', () => {
        const line = '{"phase":"output","task":"test","type":"stdout"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'test',
          phase: 'stdout',
          text: '',
        });
      });

      it('should handle null content in output phase', () => {
        const line =
          '{"phase":"output","task":"test","type":"stdout","content":null}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'test',
          phase: 'stdout',
          text: '',
        });
      });

      it('should handle missing task name in output phase', () => {
        const line = '{"phase":"output","type":"stdout","content":"Output"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown',
          phase: 'stdout',
          text: 'Output',
        });
      });
    });

    describe('end phase', () => {
      it('should parse end phase events correctly', () => {
        const line = '{"phase":"end","task":"deploy","exitCode":0}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'deploy',
          phase: 'end',
          exitCode: 0,
        });
      });

      it('should handle non-zero exit codes', () => {
        const line = '{"phase":"end","task":"test","exitCode":1}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'test',
          phase: 'end',
          exitCode: 1,
        });
      });

      it('should default to exit code 0 when missing', () => {
        const line = '{"phase":"end","task":"build"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'build',
          phase: 'end',
          exitCode: 0,
        });
      });

      it('should handle null exit code', () => {
        const line = '{"phase":"end","task":"run","exitCode":null}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'run',
          phase: 'end',
          exitCode: 0,
        });
      });

      it('should handle missing task name in end phase', () => {
        const line = '{"phase":"end","exitCode":127}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown',
          phase: 'end',
          exitCode: 127,
        });
      });
    });

    describe('unknown phases', () => {
      it('should emit debug events for unknown phases', () => {
        const line = '{"phase":"prepare","task":"setup","data":"initializing"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'debug',
          raw: {
            phase: 'prepare',
            task: 'setup',
            data: 'initializing',
          },
        });
      });

      it('should handle null phase as debug event', () => {
        const line = '{"phase":null,"task":"test"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'debug',
          raw: {
            phase: null,
            task: 'test',
          },
        });
      });
    });

    describe('error handling', () => {
      it('should throw ParseError for invalid JSON', () => {
        expect(() => parser.parse('invalid json')).toThrow(ParseError);
      });

      it('should include proper error details in ParseError', () => {
        let error: ParseError | undefined;
        try {
          parser.parse('invalid json');
        } catch (e) {
          error = e as ParseError;
        }

        expect(error).toBeDefined();
        expect(error?.vendor).toBe('amp');
        expect(error?.line).toBe('invalid json');
        expect(error?.message).toBe('Invalid JSON');
      });

      it('should handle complex JSON parse errors', () => {
        const malformedJson = '{"phase":"start","task":"build"';
        expect(() => parser.parse(malformedJson)).toThrow(ParseError);
      });
    });

    describe('edge cases', () => {
      it('should handle non-string task names', () => {
        const line = '{"phase":"start","task":123}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown', // Parser normalizes non-string values to 'unknown'
          phase: 'start',
        });
      });

      it('should handle boolean task names', () => {
        const line = '{"phase":"output","task":true,"content":"test"}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown', // Parser normalizes boolean values to 'unknown'
          phase: 'stdout',
          text: 'test',
        });
      });

      it('should handle array task names', () => {
        const line = '{"phase":"end","task":["task1","task2"],"exitCode":0}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown', // Parser normalizes array values to 'unknown'
          phase: 'end',
          exitCode: 0,
        });
      });

      it('should handle object task names', () => {
        const line = '{"phase":"start","task":{"name":"build"}}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'unknown', // Parser normalizes object values to 'unknown'
          phase: 'start',
        });
      });

      it('should handle non-string content values', () => {
        const line = '{"phase":"output","task":"log","content":123}';
        const events = parser.parse(line);

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'tool',
          name: 'log',
          phase: 'stdout',
          text: '', // Parser normalizes non-string content to empty string
        });
      });
    });
  });

  describe('metadata', () => {
    it('should have correct vendor and metadata', () => {
      expect(parser.vendor).toBe('amp');
      expect(parser.metadata).toEqual({
        version: '1.0.0',
        supportedVersions: ['1.0', '1.1'],
        documentationUrl: 'https://docs.amp-code.com/cli',
      });
    });
  });

  describe('real-world fixtures', () => {
    it('should correctly parse a sequence of tool execution events', () => {
      const lines = [
        '{"phase":"start","task":"compile","timestamp":"2024-01-01T10:00:00Z"}',
        '{"phase":"output","task":"compile","type":"stdout","content":"Compiling project..."}',
        '{"phase":"output","task":"compile","type":"stdout","content":"Build successful"}',
        '{"phase":"end","task":"compile","timestamp":"2024-01-01T10:00:30Z","exitCode":0}',
      ];

      const allEvents = lines.flatMap(line => parser.parse(line));

      expect(allEvents).toHaveLength(4);

      // Verify correct sequencing
      expect(allEvents[0]).toMatchObject({
        t: 'tool',
        phase: 'start',
        name: 'compile',
      });
      expect(allEvents[1]).toMatchObject({
        t: 'tool',
        phase: 'stdout',
        name: 'compile',
        text: 'Compiling project...',
      });
      expect(allEvents[2]).toMatchObject({
        t: 'tool',
        phase: 'stdout',
        name: 'compile',
        text: 'Build successful',
      });
      expect(allEvents[3]).toMatchObject({
        t: 'tool',
        phase: 'end',
        name: 'compile',
        exitCode: 0,
      });
    });

    it('should handle overlapping tool executions', () => {
      const lines = [
        '{"phase":"start","task":"build"}',
        '{"phase":"start","task":"test"}',
        '{"phase":"output","task":"build","type":"stdout","content":"Building..."}',
        '{"phase":"output","task":"test","type":"stdout","content":"Testing..."}',
        '{"phase":"end","task":"build","exitCode":0}',
        '{"phase":"end","task":"test","exitCode":0}',
      ];

      const allEvents = lines.flatMap(line => parser.parse(line));

      expect(allEvents).toHaveLength(6);

      // Verify each tool maintains its own sequence
      const buildEvents = allEvents.filter(
        (e): e is ToolEvent => e.t === 'tool' && e.name === 'build',
      );
      expect(buildEvents).toHaveLength(3);
      expect(buildEvents[0].phase).toBe('start');
      expect(buildEvents[1].phase).toBe('stdout');
      expect(buildEvents[2].phase).toBe('end');

      const testEvents = allEvents.filter(
        (e): e is ToolEvent => e.t === 'tool' && e.name === 'test',
      );
      expect(testEvents).toHaveLength(3);
      expect(testEvents[0].phase).toBe('start');
      expect(testEvents[1].phase).toBe('stdout');
      expect(testEvents[2].phase).toBe('end');
    });
  });
});
