import { describe, it, expect } from 'vitest';
import { ClaudeParser } from './claude.js';
import { ParseError } from './types.js';

describe('ClaudeParser', () => {
  const parser = new ClaudeParser();

  describe('detect', () => {
    it('should detect valid Claude message events', () => {
      const validLines = [
        '{"type":"message","role":"user","content":"hello"}',
        '{"type":"tool_use","id":"tool_123","name":"bash"}',
        '{"type":"tool_result","tool_use_id":"tool_123","content":"output"}',
        '{"type":"usage","input_tokens":12,"output_tokens":35}',
        '{"type":"error","message":"something went wrong"}',
      ];

      for (const line of validLines) {
        expect(parser.detect(line)).toBe(true);
      }
    });

    it('should not detect invalid or non-Claude formats', () => {
      const invalidLines = [
        '{"event":"message","data":"hello"}', // Different format
        '{"type":"unknown"}', // Unknown type
        'invalid json', // Invalid JSON
        '{"no":"type"}', // Missing type
        '{"type":123}', // Type not string
      ];

      for (const line of invalidLines) {
        expect(parser.detect(line)).toBe(false);
      }
    });

    it('should not throw on invalid JSON', () => {
      expect(() => parser.detect('invalid json')).not.toThrow();
      expect(parser.detect('invalid json')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse message events correctly', () => {
      const line =
        '{"type":"message","role":"assistant","content":"Hello, World!"}';
      const events = parser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: 'Hello, World!',
      });
    });

    it('should parse tool_use events correctly', () => {
      const line =
        '{"type":"tool_use","id":"tool_123","name":"bash","input":{"command":"npm test"}}';
      const events = parser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'tool',
        name: 'bash',
        phase: 'start',
        text: JSON.stringify({ command: 'npm test' }, null, 2),
      });
    });

    it('should parse tool_result events correctly', () => {
      const line =
        '{"type":"tool_result","tool_use_id":"tool_123","content":"stdout","output":"Test passed"}';
      const events = parser.parse(line);

      expect(events).toHaveLength(2); // stdout + end
      expect(events[0]).toEqual({
        t: 'tool',
        name: 'tool_123',
        phase: 'stdout',
        text: 'Test passed',
      });
      expect(events[1]).toEqual({
        t: 'tool',
        name: 'tool_123',
        phase: 'end',
        exitCode: 0,
      });
    });

    it('should parse usage events correctly', () => {
      const line =
        '{"type":"usage","input_tokens":12,"output_tokens":35,"total_tokens":47}';
      const events = parser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'cost',
        deltaUsd: 12 * 0.000003 + 35 * 0.000015,
      });
    });

    it('should parse error events correctly', () => {
      const line =
        '{"type":"error","level":"warning","message":"Something went wrong"}';
      const events = parser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'error',
        message: 'Something went wrong',
      });
    });

    it('should handle unknown event types as debug events', () => {
      const line = '{"type":"unknown","data":"test"}';
      const events = parser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'debug',
        raw: { type: 'unknown', data: 'test' },
      });
    });

    it('should throw ParseError for invalid JSON', () => {
      expect(() => parser.parse('invalid json')).toThrow(ParseError);
    });

    it('should handle empty usage events', () => {
      const line = '{"type":"usage","input_tokens":0,"output_tokens":0}';
      const events = parser.parse(line);

      expect(events).toHaveLength(0);
    });

    it('should normalize invalid roles', () => {
      const line = '{"type":"message","role":"invalid","content":"test"}';
      const events = parser.parse(line);

      expect(events[0]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: 'test',
      });
    });

    it('should handle missing fields gracefully', () => {
      const line = '{"type":"message"}';
      const events = parser.parse(line);

      expect(events[0]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: '',
      });
    });
  });

  describe('metadata', () => {
    it('should have correct vendor and metadata', () => {
      expect(parser.vendor).toBe('claude');
      expect(parser.metadata).toEqual({
        version: '1.0.0',
        supportedVersions: ['3.5', '3.6'],
        documentationUrl:
          'https://docs.anthropic.com/claude-code/cli-reference',
      });
    });
  });
});
