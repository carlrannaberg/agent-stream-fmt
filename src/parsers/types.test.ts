import { describe, it, expect } from 'vitest';
import { VendorParser, ParseError, ParserEntry } from './types.js';
import { AgentEvent } from '../types.js';

describe('Parser Types', () => {
  describe('VendorParser interface', () => {
    it('should enforce the correct interface structure', () => {
      const mockParser: VendorParser = {
        vendor: 'test',
        detect: (line: string) => line.includes('test'),
        parse: (line: string): AgentEvent[] => [
          { t: 'msg', role: 'assistant', text: 'test' }
        ],
        metadata: {
          version: '1.0.0',
          supportedVersions: ['1.0.0'],
          documentationUrl: 'https://example.com'
        }
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
        parse: () => []
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
        parse: () => []
      };

      const entry: ParserEntry = {
        parser: mockParser,
        priority: 100
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
          { t: 'debug', raw: { test: 'data' } }
        ]
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