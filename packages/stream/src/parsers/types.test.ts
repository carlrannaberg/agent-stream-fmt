import { describe, it, expect } from 'vitest';
import { VendorParser, ParseError, ParserEntry } from './types.js';
import { AgentEvent } from '../types.js';

describe('Parser Types', () => {
  describe('VendorParser interface', () => {
    it('should enforce the correct interface structure', () => {
      const mockParser: VendorParser = {
        vendor: 'test',
        detect: (line: string) => line.includes('test'),
        parse: (_line: string): AgentEvent[] => [
          { t: 'msg', role: 'assistant', text: 'test' },
        ],
        metadata: {
          version: '1.0.0',
          supportedVersions: ['1.0.0'],
          documentationUrl: 'https://example.com',
        },
      };

      expect(mockParser.vendor).toBe('test');
      expect(mockParser.detect('test line')).toBe(true);
      expect(mockParser.detect('other line')).toBe(false);
      expect(mockParser.parse('test').length).toBe(1);
      expect(mockParser.metadata?.version).toBe('1.0.0');
    });

    it('should work with minimal required properties', () => {
      const minimalParser: VendorParser = {
        vendor: 'minimal',
        detect: () => true,
        parse: () => [],
      };

      expect(minimalParser.vendor).toBe('minimal');
      expect(minimalParser.detect('anything')).toBe(true);
      expect(minimalParser.parse('anything')).toEqual([]);
      expect(minimalParser.metadata).toBeUndefined();
    });
  });

  describe('ParserEntry interface', () => {
    it('should properly structure parser entries', () => {
      const mockParser: VendorParser = {
        vendor: 'test',
        detect: () => true,
        parse: () => [],
      };

      const entry: ParserEntry = {
        parser: mockParser,
        priority: 100,
      };

      expect(entry.parser).toBe(mockParser);
      expect(entry.priority).toBe(100);
      expect(entry.parser.vendor).toBe('test');
    });
  });

  describe('ParseError class', () => {
    it('should create error with all properties', () => {
      const cause = new Error('underlying error');
      const error = new ParseError('Test error', 'claude', 'test line', cause);

      expect(error.name).toBe('ParseError');
      expect(error.message).toBe('Test error');
      expect(error.vendor).toBe('claude');
      expect(error.line).toBe('test line');
      expect(error.cause).toBe(cause);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ParseError).toBe(true);
    });

    it('should work without cause', () => {
      const error = new ParseError('Test error', 'claude', 'test line');

      expect(error.name).toBe('ParseError');
      expect(error.message).toBe('Test error');
      expect(error.vendor).toBe('claude');
      expect(error.line).toBe('test line');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with context information', () => {
      const context = {
        lineNumber: 42,
        characterPosition: 15,
        expectedFormat: 'JSON object with "type" field',
      };
      const error = new ParseError(
        'Test error',
        'gemini',
        'invalid line',
        undefined,
        context,
      );

      expect(error.context).toEqual(context);
      expect(error.context?.lineNumber).toBe(42);
      expect(error.context?.characterPosition).toBe(15);
      expect(error.context?.expectedFormat).toBe(
        'JSON object with "type" field',
      );
    });

    it('should create error with partial context', () => {
      const context = {
        lineNumber: 10,
      };
      const error = new ParseError(
        'Test error',
        'amp',
        'bad line',
        undefined,
        context,
      );

      expect(error.context).toEqual(context);
      expect(error.context?.lineNumber).toBe(10);
      expect(error.context?.characterPosition).toBeUndefined();
      expect(error.context?.expectedFormat).toBeUndefined();
    });

    it('should serialize to JSON correctly', () => {
      const context = {
        lineNumber: 5,
        characterPosition: 20,
        expectedFormat: 'Valid JSONL',
      };
      const error = new ParseError(
        'Parse failed',
        'claude',
        'malformed line',
        undefined,
        context,
      );
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'ParseError',
        message: 'Parse failed',
        vendor: 'claude',
        context: context,
      });
    });

    it('should serialize to JSON without context', () => {
      const error = new ParseError('Parse failed', 'gemini', 'bad line');
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'ParseError',
        message: 'Parse failed',
        vendor: 'gemini',
        context: undefined,
      });
    });

    it('should be JSON stringifiable', () => {
      const error = new ParseError('Test error', 'amp', 'line', undefined, {
        lineNumber: 100,
      });

      const jsonString = JSON.stringify(error);
      const parsed = JSON.parse(jsonString);

      expect(parsed.name).toBe('ParseError');
      expect(parsed.message).toBe('Test error');
      expect(parsed.vendor).toBe('amp');
      expect(parsed.context.lineNumber).toBe(100);
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new ParseError('Test error', 'claude', 'test line');
      }).toThrow('Test error');

      try {
        throw new ParseError('Test error', 'claude', 'test line');
      } catch (error) {
        expect(error instanceof ParseError).toBe(true);
        if (error instanceof ParseError) {
          expect(error.vendor).toBe('claude');
          expect(error.line).toBe('test line');
        }
      }
    });

    it('should work with all parameters including cause and context', () => {
      const cause = new SyntaxError('Invalid JSON');
      const context = {
        lineNumber: 25,
        characterPosition: 42,
        expectedFormat: 'Object with "method" field',
      };
      const error = new ParseError(
        'Failed to parse Gemini output',
        'gemini',
        '{"bad": json',
        cause,
        context,
      );

      expect(error.message).toBe('Failed to parse Gemini output');
      expect(error.vendor).toBe('gemini');
      expect(error.line).toBe('{"bad": json');
      expect(error.cause).toBe(cause);
      expect(error.context).toEqual(context);
      expect(error.name).toBe('ParseError');
    });
  });

  describe('Type compatibility', () => {
    it('should work with AgentEvent types', () => {
      const parser: VendorParser = {
        vendor: 'test',
        detect: () => true,
        parse: (): AgentEvent[] => [
          { t: 'msg', role: 'user', text: 'hello' },
          { t: 'tool', name: 'test', phase: 'start' },
          { t: 'cost', deltaUsd: 0.01 },
          { t: 'error', message: 'test error' },
          { t: 'debug', raw: { test: 'data' } },
        ],
      };

      const events = parser.parse('test');
      expect(events.length).toBe(5);
      expect(events[0].t).toBe('msg');
      expect(events[1].t).toBe('tool');
      expect(events[2].t).toBe('cost');
      expect(events[3].t).toBe('error');
      expect(events[4].t).toBe('debug');
    });
  });
});
