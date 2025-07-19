import { describe, it, expect } from 'vitest';
import { GeminiParser } from './gemini.js';
import { ParseError } from './types.js';

describe('GeminiParser', () => {
  const parser = new GeminiParser();

  describe('detect', () => {
    it('should detect valid Gemini message events', () => {
      const validLines = [
        '{"type":"user","content":"hello"}',
        '{"type":"assistant","content":"Hello! How can I help?"}',
        '{"type":"metadata","usage":{"input_tokens":10,"output_tokens":25}}'
      ];

      for (const line of validLines) {
        expect(parser.detect(line)).toBe(true);
      }
    });

    it('should not detect invalid or non-Gemini formats', () => {
      const invalidLines = [
        '{"event":"message","data":"hello"}', // Different format
        '{"type":"unknown"}', // Unknown type  
        'invalid json', // Invalid JSON
        '{"no":"type"}', // Missing type
        '{"type":123}', // Type not string
        '{"type":"message","role":"user"}', // Claude format
        '{"phase":"start","task":"test"}' // Amp format
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
    it('should parse user message events correctly', () => {
      const line = '{"type":"user","content":"Hello, Gemini!"}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'msg',
        role: 'user',
        text: 'Hello, Gemini!'
      });
    });

    it('should parse assistant message events correctly', () => {
      const line = '{"type":"assistant","content":"Hello! How can I help you today?"}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: 'Hello! How can I help you today?'
      });
    });

    it('should handle empty content in messages', () => {
      const line = '{"type":"user","content":""}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'msg',
        role: 'user',
        text: ''
      });
    });

    it('should handle missing content in messages', () => {
      const line = '{"type":"assistant"}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: ''
      });
    });

    it('should parse metadata with usage correctly', () => {
      const line = '{"type":"metadata","usage":{"input_tokens":12,"output_tokens":35}}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'cost',
        deltaUsd: (12 * 0.000001) + (35 * 0.000003)
      });
    });

    it('should calculate cost correctly for different token counts', () => {
      const line = '{"type":"metadata","usage":{"input_tokens":1000,"output_tokens":500}}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'cost',
        deltaUsd: (1000 * 0.000001) + (500 * 0.000003)
      });
    });

    it('should handle metadata without usage', () => {
      const line = '{"type":"metadata","other_info":"test"}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(0);
    });

    it('should handle metadata with zero tokens', () => {
      const line = '{"type":"metadata","usage":{"input_tokens":0,"output_tokens":0}}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(0);
    });

    it('should handle metadata with missing token counts', () => {
      const line = '{"type":"metadata","usage":{"input_tokens":10}}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'cost',
        deltaUsd: (10 * 0.000001) + (0 * 0.000003)
      });
    });

    it('should handle metadata with partial token counts', () => {
      const line = '{"type":"metadata","usage":{"output_tokens":25}}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'cost',
        deltaUsd: (0 * 0.000001) + (25 * 0.000003)
      });
    });

    it('should handle unknown event types as debug events', () => {
      const line = '{"type":"unknown","data":"test"}';
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'debug',
        raw: { type: 'unknown', data: 'test' }
      });
    });

    it('should handle complex unknown events as debug events', () => {
      const complexData = {
        type: 'custom_event',
        nested: {
          data: ['item1', 'item2'],
          count: 42
        }
      };
      const line = JSON.stringify(complexData);
      const events = parser.parse(line);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'debug',
        raw: complexData
      });
    });

    it('should throw ParseError for invalid JSON', () => {
      const invalidLine = 'invalid json';
      
      expect(() => parser.parse(invalidLine)).toThrow(ParseError);
      
      try {
        parser.parse(invalidLine);
      } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).vendor).toBe('gemini');
        expect((error as ParseError).line).toBe(invalidLine);
        expect((error as ParseError).message).toBe('Invalid JSON');
      }
    });

    it('should throw ParseError with cause for complex JSON errors', () => {
      const malformedLine = '{"type":"user","content":"unclosed string';
      
      expect(() => parser.parse(malformedLine)).toThrow(ParseError);
      
      try {
        parser.parse(malformedLine);
      } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).vendor).toBe('gemini');
        expect((error as ParseError).line).toBe(malformedLine);
        expect((error as ParseError).cause).toBeDefined();
      }
    });
  });

  describe('metadata', () => {
    it('should have correct vendor and metadata', () => {
      expect(parser.vendor).toBe('gemini');
      expect(parser.metadata).toEqual({
        version: '1.0.0',
        supportedVersions: ['0.10', '0.11'],
        documentationUrl: 'https://docs.google.com/gemini-cli'
      });
    });
  });

  describe('real fixture parsing', () => {
    it('should parse basic content fixture correctly', () => {
      // Test against actual fixture content
      const basicContentLines = [
        '{"type":"user","content":"What is TypeScript?"}',
        '{"type":"assistant","content":"TypeScript is a programming language developed by Microsoft that builds on JavaScript by adding static type definitions."}',
        '{"type":"metadata","usage":{"input_tokens":5,"output_tokens":23}}'
      ];

      const allEvents = [];
      for (const line of basicContentLines) {
        expect(parser.detect(line)).toBe(true);
        const events = parser.parse(line);
        allEvents.push(...events);
      }

      expect(allEvents).toHaveLength(3);
      
      // Check message events
      expect(allEvents[0]).toEqual({
        t: 'msg',
        role: 'user',
        text: 'What is TypeScript?'
      });
      
      expect(allEvents[1]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: 'TypeScript is a programming language developed by Microsoft that builds on JavaScript by adding static type definitions.'
      });
      
      // Check cost event
      expect(allEvents[2]).toEqual({
        t: 'cost',
        deltaUsd: (5 * 0.000001) + (23 * 0.000003)
      });
    });

    it('should parse code generation fixture correctly', () => {
      const codeGenLines = [
        '{"type":"user","content":"Write a hello world function in Python"}',
        '{"type":"assistant","content":"```python\\ndef hello_world():\\n    print(\\"Hello, World!\\")\\n\\nhello_world()\\n```"}',
        '{"type":"metadata","usage":{"input_tokens":9,"output_tokens":19}}'
      ];

      const allEvents = [];
      for (const line of codeGenLines) {
        expect(parser.detect(line)).toBe(true);
        const events = parser.parse(line);
        allEvents.push(...events);
      }

      expect(allEvents).toHaveLength(3);
      
      // Verify the code content is properly parsed
      expect((allEvents[1] as any).text).toContain('def hello_world():');
      expect((allEvents[1] as any).text).toContain('print("Hello, World!")');
      
      // Check cost calculation
      expect(allEvents[2]).toEqual({
        t: 'cost',
        deltaUsd: (9 * 0.000001) + (19 * 0.000003)
      });
    });
  });
});