import { describe, it, expect } from 'vitest';
import { GeminiParser } from './gemini.js';
import type { AgentEvent } from '../types.js';

describe('GeminiParser', () => {
  const parser = new GeminiParser();

  describe('detect', () => {
    it('should detect plain text lines (not JSON)', () => {
      const validLines = [
        'Hello, how can I help you today?',
        'Loaded cached credentials.',
        'TypeScript is a programming language developed by Microsoft.',
        'Here is a simple function:',
        '```python',
        'def hello_world():',
        '    print("Hello, World!")',
        '```',
      ];

      for (const line of validLines) {
        expect(parser.detect(line)).toBe(true);
      }
    });

    it('should not detect JSON lines', () => {
      const jsonLines = [
        '{"type":"user","content":"hello"}',
        '{"type":"assistant","content":"Hello!"}',
        '{"type":"metadata","usage":{"input_tokens":10,"output_tokens":25}}',
        '{"event":"message","data":"hello"}',
        '{"type":"message","role":"user"}',
        '{"phase":"start","task":"test"}',
      ];

      for (const line of jsonLines) {
        expect(parser.detect(line)).toBe(false);
      }
    });

    it('should not detect empty lines', () => {
      expect(parser.detect('')).toBe(false);
      expect(parser.detect('   ')).toBe(false);
      expect(parser.detect('\t')).toBe(false);
      expect(parser.detect('\n')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse regular text as assistant messages', () => {
      const line = 'Hello, how can I help you today?';
      const events = parser.parse(line);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        t: 'msg',
        role: 'assistant',
        text: 'Hello, how can I help you today?',
      });
    });

    it('should filter out system messages', () => {
      const line = 'Loaded cached credentials.';
      const events = parser.parse(line);

      expect(events).toHaveLength(0);
    });

    it('should handle empty lines', () => {
      const events = parser.parse('');
      expect(events).toHaveLength(0);
    });

    it('should handle whitespace-only lines', () => {
      const events = parser.parse('   ');
      expect(events).toHaveLength(0);
    });

    it('should preserve code block content', () => {
      const codeLines = [
        '```python',
        'def hello_world():',
        '    print("Hello, World!")',
        '```',
      ];

      for (const line of codeLines) {
        const events = parser.parse(line);
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'msg',
          role: 'assistant',
          text: line,
        });
      }
    });

    it('should handle multi-line responses', () => {
      const lines = [
        'TypeScript is a programming language developed by Microsoft.',
        'It builds on JavaScript by adding static type definitions.',
        'Types provide a way to describe the shape of an object.',
      ];

      for (const line of lines) {
        const events = parser.parse(line);
        expect(events).toHaveLength(1);
        expect(events[0]).toEqual({
          t: 'msg',
          role: 'assistant',
          text: line,
        });
      }
    });
  });

  describe('metadata', () => {
    it('should have correct vendor and metadata', () => {
      expect(parser.vendor).toBe('gemini');
      expect(parser.metadata).toEqual({
        version: '1.0.0',
        supportedVersions: ['0.1.x'],
        documentationUrl: 'https://github.com/google-gemini/gemini-cli',
      });
    });
  });

  describe('real Gemini CLI output', () => {
    it('should parse typical Gemini CLI session', () => {
      const sessionLines = [
        'Loaded cached credentials.',
        '',
        'Recursion is a programming concept where a function calls itself to solve a problem.',
        '',
        "Here's a simple example in Python:",
        '',
        '```python',
        'def factorial(n):',
        '    if n <= 1:',
        '        return 1',
        '    return n * factorial(n - 1)',
        '```',
        '',
        'The function calls itself with a smaller input until it reaches the base case.',
      ];

      const allEvents: AgentEvent[] = [];
      for (const line of sessionLines) {
        if (parser.detect(line)) {
          const events = parser.parse(line);
          allEvents.push(...events);
        }
      }

      // Should have parsed all non-empty lines except "Loaded cached credentials."
      const expectedMessages = [
        'Recursion is a programming concept where a function calls itself to solve a problem.',
        "Here's a simple example in Python:",
        '```python',
        'def factorial(n):',
        '    if n <= 1:',
        '        return 1',
        '    return n * factorial(n - 1)',
        '```',
        'The function calls itself with a smaller input until it reaches the base case.',
      ];

      expect(allEvents).toHaveLength(expectedMessages.length);

      expectedMessages.forEach((text, index) => {
        expect(allEvents[index]).toEqual({
          t: 'msg',
          role: 'assistant',
          text,
        });
      });
    });
  });
});
