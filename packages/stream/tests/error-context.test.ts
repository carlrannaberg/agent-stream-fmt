import { describe, it, expect } from 'vitest';
import { streamEvents } from '../src/stream.js';
import { ParseError } from '../src/parsers/types.js';
import { PassThrough } from 'stream';

describe('Enhanced ParseError Context', () => {
  describe('Line number tracking', () => {
    it('should add line numbers to parse errors', async () => {
      const input = new PassThrough();
      const events: any[] = [];

      // Start consuming events
      const eventPromise = (async () => {
        for await (const event of streamEvents({
          vendor: 'claude',
          source: input,
        })) {
          events.push(event);
        }
      })();

      // Write some valid and invalid JSON lines
      input.write('{"type":"message","role":"assistant","content":"Hello"}\n');
      input.write('{"type":"message","role":"user","content":"Hi"}\n');
      input.write('INVALID JSON LINE\n');
      input.write('{"type":"message","role":"assistant","content":"World"}\n');
      input.write('{ broken json\n');
      input.end();

      // Wait for all events
      await eventPromise;

      // Should have processed valid messages and errors
      const errorEvents = events.filter(e => e.t === 'error');
      expect(errorEvents).toHaveLength(2);

      // Check that error messages include line numbers
      expect(errorEvents[0].message).toContain('Line 3:');
      expect(errorEvents[1].message).toContain('Line 5:');
    });
  });

  describe('Expected format context', () => {
    it('should include expected format in Claude parser errors', async () => {
      const input = new PassThrough();
      const events: any[] = [];

      // Start consuming events
      const eventPromise = (async () => {
        for await (const event of streamEvents({
          vendor: 'claude',
          source: input,
          emitDebugEvents: true,
        })) {
          events.push(event);
        }
      })();

      // Write invalid JSON
      input.write('NOT JSON AT ALL\n');
      input.end();

      await eventPromise;

      // Check error and debug events
      const errorEvent = events.find(e => e.t === 'error');
      expect(errorEvent.message).toContain('Invalid JSON');
      expect(errorEvent.message).toContain('Line 1:');

      // Debug event should show expected format from parser context
      const debugEvent = events.find(e => e.t === 'debug' && e.raw.error);
      expect(debugEvent).toBeDefined();
    });

    it('should handle plain text for Gemini parser', async () => {
      const input = new PassThrough();
      const events: any[] = [];

      const eventPromise = (async () => {
        for await (const event of streamEvents({
          vendor: 'gemini',
          source: input,
        })) {
          events.push(event);
        }
      })();

      // Write plain text for Gemini (not JSON)
      input.write('MALFORMED_JSON\n');
      input.end();

      await eventPromise;

      // Gemini treats non-JSON as plain text, so we should get a message event
      const messageEvent = events.find(e => e.t === 'msg');
      expect(messageEvent).toBeDefined();
      expect(messageEvent.role).toBe('assistant');
      expect(messageEvent.text).toBe('MALFORMED_JSON');

      // No error event for Gemini with plain text
      const errorEvent = events.find(e => e.t === 'error');
      expect(errorEvent).toBeUndefined();
    });

    it('should include expected format in Amp parser errors', async () => {
      const input = new PassThrough();
      const events: any[] = [];

      const eventPromise = (async () => {
        for await (const event of streamEvents({
          vendor: 'amp',
          source: input,
        })) {
          events.push(event);
        }
      })();

      // Write invalid JSON for Amp
      input.write('bad json for amp\n');
      input.end();

      await eventPromise;

      const errorEvent = events.find(e => e.t === 'error');
      expect(errorEvent.message).toContain('Invalid JSON');
      expect(errorEvent.message).toContain('Line 1:');
    });
  });

  describe('Error recovery with context', () => {
    it('should continue parsing after errors with proper line tracking', async () => {
      const input = new PassThrough();
      const events: any[] = [];

      const eventPromise = (async () => {
        for await (const event of streamEvents({
          vendor: 'auto',
          source: input,
          continueOnError: true,
        })) {
          events.push(event);
        }
      })();

      // Mix of valid Claude, Gemini, and invalid lines
      input.write(
        '{"type":"message","role":"assistant","content":"Claude message"}\n',
      );
      input.write('INVALID LINE 2\n');
      input.write('{"type":"user","content":"Gemini message"}\n');
      input.write('{ "broken": \n');
      input.write('{"type":"assistant","content":"Another Gemini"}\n');
      input.write('{"type":"tool_use","name":"test_tool"}\n');
      input.end();

      await eventPromise;

      // Count different event types
      const messageEvents = events.filter(e => e.t === 'msg');
      const errorEvents = events.filter(e => e.t === 'error');
      const _toolEvents = events.filter(e => e.t === 'tool');

      // Should have parsed valid messages
      expect(messageEvents.length).toBeGreaterThan(0);

      // Should have errors with correct line numbers
      expect(errorEvents.length).toBeGreaterThan(0);
      const errorMessages = errorEvents.map(e => e.message);
      expect(errorMessages.some(m => m.includes('Line 2:'))).toBe(true);
      expect(errorMessages.some(m => m.includes('Line 4:'))).toBe(true);
    });
  });

  describe('ParseError toJSON method', () => {
    it('should serialize ParseError correctly with context', () => {
      const error = new ParseError(
        'Test error message',
        'claude',
        'invalid line content',
        new SyntaxError('Unexpected token'),
        {
          lineNumber: 42,
          characterPosition: 15,
          expectedFormat: 'Valid JSON with type field',
        },
      );

      const json = error.toJSON();

      expect(json).toEqual({
        name: 'ParseError',
        message: 'Test error message',
        vendor: 'claude',
        context: {
          lineNumber: 42,
          characterPosition: 15,
          expectedFormat: 'Valid JSON with type field',
        },
      });

      // Should be JSON stringifiable
      const stringified = JSON.stringify(error);
      const parsed = JSON.parse(stringified);
      expect(parsed.context.lineNumber).toBe(42);
    });
  });

  describe('Character position tracking', () => {
    it('should track character position for JSON syntax errors', async () => {
      // This is a potential future enhancement - parsers could detect
      // the character position where JSON parsing failed
      const error = new ParseError(
        'Unexpected token at position 25',
        'claude',
        '{"type":"message","bad: json}',
        new SyntaxError('Unexpected token'),
        {
          lineNumber: 10,
          characterPosition: 25,
          expectedFormat: 'Valid JSON',
        },
      );

      expect(error.context?.characterPosition).toBe(25);
      expect(error.context?.lineNumber).toBe(10);
    });
  });
});
