import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { registry, detectVendor, selectParser } from './index.js';

describe('Parser Registry Integration Tests', () => {
  const fixturesDir = join(process.cwd(), 'tests/fixtures');

  describe('Claude fixtures', () => {
    it('detects and parses basic-message.jsonl', () => {
      const fixturePath = join(fixturesDir, 'claude/basic-message.jsonl');
      const content = readFileSync(fixturePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        // Test detection
        const detected = detectVendor(line);
        expect(detected).toBeTruthy();
        expect(detected?.vendor).toBe('claude');

        // Test parsing
        const events = detected!.parse(line);
        expect(events.length).toBeGreaterThan(0);

        // Verify no error events
        expect(events.every(e => e.t !== 'error')).toBe(true);
      }
    });

    it('detects and parses tool-use.jsonl', () => {
      const fixturePath = join(fixturesDir, 'claude/tool-use.jsonl');
      const content = readFileSync(fixturePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        // Test detection
        const detected = detectVendor(line);
        expect(detected).toBeTruthy();
        expect(detected?.vendor).toBe('claude');

        // Test parsing
        const events = detected!.parse(line);
        expect(events.length).toBeGreaterThan(0);
      }
    });

    it('works with selectParser auto-detection', () => {
      const fixturePath = join(fixturesDir, 'claude/basic-message.jsonl');
      const content = readFileSync(fixturePath, 'utf-8');
      const firstLine = content.split('\n')[0];

      // Test auto-detection
      const parser = selectParser('auto', firstLine);
      expect(parser.vendor).toBe('claude');

      // Test parsing
      const events = parser.parse(firstLine);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].t).toBe('msg');
    });
  });

  describe('Non-Claude fixtures', () => {
    it('does not detect Gemini format as Claude', () => {
      const fixturePath = join(fixturesDir, 'gemini/basic-content.txt');
      const content = readFileSync(fixturePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        const detected = detectVendor(line);
        // Should not detect as Claude (might be null if no other parsers registered)
        if (detected) {
          expect(detected.vendor).not.toBe('claude');
        }
      }
    });

    it('does not detect Amp format as Claude', () => {
      const fixturePath = join(fixturesDir, 'amp/simple-task.jsonl');
      const content = readFileSync(fixturePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        const detected = detectVendor(line);
        // Should not detect as Claude (might be null if no other parsers registered)
        if (detected) {
          expect(detected.vendor).not.toBe('claude');
        }
      }
    });
  });

  describe('Registry functionality', () => {
    it('has Claude parser registered by default', () => {
      expect(registry.hasParser('claude')).toBe(true);
      expect(registry.listParsers()).toContain('claude');
    });

    it('can retrieve Claude parser directly', () => {
      const parser = registry.getParser('claude');
      expect(parser).toBeTruthy();
      expect(parser?.vendor).toBe('claude');
    });

    it('priority system works correctly', () => {
      // Claude should be registered with priority 100
      const fixturePath = join(fixturesDir, 'claude/basic-message.jsonl');
      const content = readFileSync(fixturePath, 'utf-8');
      const firstLine = content.split('\n')[0];

      const detected = detectVendor(firstLine);
      expect(detected?.vendor).toBe('claude');
    });
  });

  describe('Error handling', () => {
    it('handles malformed JSON gracefully during detection', () => {
      const malformedLine = '{"type":"message","content":"unclosed';
      const detected = detectVendor(malformedLine);
      // Gemini parser will detect non-JSON lines as plain text
      expect(detected?.vendor).toBe('gemini');
    });

    it('handles empty lines gracefully', () => {
      const detected = detectVendor('');
      expect(detected).toBeNull();
    });

    it('handles non-JSON lines gracefully', () => {
      const nonJsonLine = 'this is not json';
      const detected = detectVendor(nonJsonLine);
      // Gemini parser will detect non-JSON lines as plain text
      expect(detected?.vendor).toBe('gemini');
    });

    it('selectParser throws appropriate errors', () => {
      expect(() => {
        selectParser('unknown' as any);
      }).toThrow('Unknown vendor: unknown');

      expect(() => {
        selectParser('auto');
      }).toThrow('Auto-detection requires at least one line');

      // Use a non-JSON string that Gemini will detect
      const parser = selectParser('auto', 'Hello, this is plain text');
      expect(parser.vendor).toBe('gemini');
    });
  });
});
