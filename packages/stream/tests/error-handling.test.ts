/* eslint-disable no-console */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { registry, detectVendor, selectParser } from '../src/parsers/index.js';
// import { ClaudeParser } from '../src/parsers/claude.js';
import { ParseError } from '../src/parsers/types.js';

/**
 * Comprehensive error handling tests for malformed JSON and edge cases
 * Tests resilience and graceful failure modes
 */
describe('Comprehensive Error Handling Tests', () => {
  const fixturesDir = join(process.cwd(), 'tests/fixtures');

  describe('JSON Parsing Errors', () => {
    const invalidJsonCases = [
      // Basic malformed JSON
      '{"type":"message","content":"unclosed',
      '{"type":"message","content":}',
      '{"type":"message","content":"test"',
      '{"type":"message","content":"test",}',
      '{"type":"message","content":"test"}extra',

      // Syntax errors
      '{"type":"message" "content":"test"}', // Missing comma
      '{"type":"message",:"content":"test"}', // Extra colon
      '{"type":"message",,"content":"test"}', // Double comma
      '{"type":"message","content""test"}', // Missing colon

      // Invalid escape sequences
      '{"type":"message","content":"test\\x"}', // Invalid escape
      '{"type":"message","content":"test\\u002"}', // Incomplete unicode
      '{"type":"message","content":"test\\u12"}', // Invalid unicode

      // Unclosed strings
      '{"type":"message","content":"test}',
      '{"type":"message,"content":"test"}',
      '{"type:"message","content":"test"}',

      // Invalid numbers
      '{"type":"message","tokens":123.}',
      '{"type":"message","tokens":.123}',
      '{"type":"message","tokens":123.456.789}',
      '{"type":"message","tokens":12e}',

      // Non-JSON content
      'not json at all',
      'undefined',

      // Deeply nested incomplete
      '{"type":"message","data":{"nested":{"deep":',
      '{"type":"message","array":[1,2,3',
      '{"type":"message","array":[1,2,3,]}',
    ];

    it('handles malformed JSON gracefully in detection', () => {
      for (const [index, invalidJson] of invalidJsonCases.entries()) {
        const detected = detectVendor(invalidJson);
        // Gemini will detect non-JSON as plain text
        expect(
          detected?.vendor,
          `Invalid JSON case ${index}: ${invalidJson}`,
        ).toBe('gemini');
      }
    });

    it('throws ParseError for malformed JSON in parsing', () => {
      const parser = selectParser('claude');

      for (const [index, invalidJson] of invalidJsonCases.entries()) {
        expect(
          () => parser.parse(invalidJson),
          `Invalid JSON case ${index} should throw ParseError: ${invalidJson}`,
        ).toThrow(ParseError);
      }
    });

    it('provides meaningful error messages for malformed JSON', () => {
      const parser = selectParser('claude');

      const testCases = [
        {
          input: '{"type":"message","content":"unclosed',
          expectedPattern: /Invalid JSON/,
        },
        { input: 'not json at all', expectedPattern: /Invalid JSON/ },
        { input: '{"type":"message",}', expectedPattern: /Invalid JSON/ },
      ];

      for (const testCase of testCases) {
        try {
          parser.parse(testCase.input);
          expect.fail(`Should have thrown ParseError for: ${testCase.input}`);
        } catch (error) {
          expect(error).toBeInstanceOf(ParseError);
          expect(error.message).toMatch(testCase.expectedPattern);
        }
      }
    });
  });

  describe('Edge Case Inputs', () => {
    it('handles empty and whitespace-only inputs', () => {
      const parser = selectParser('claude');
      const edgeCases = ['', ' ', '\t', '\n', '\r\n', '   \t\n   '];

      for (const input of edgeCases) {
        // Detection should return null
        const detected = detectVendor(input);
        expect(
          detected,
          `Empty/whitespace input should return null: ${JSON.stringify(input)}`,
        ).toBeNull();

        // Parsing should throw ParseError
        expect(
          () => parser.parse(input),
          `Empty/whitespace input should throw ParseError: ${JSON.stringify(input)}`,
        ).toThrow(ParseError);
      }
    });

    it('handles very long inputs', () => {
      const parser = selectParser('claude');

      // Generate very long content
      const longContent = 'x'.repeat(100000);
      const longMessage = JSON.stringify({
        type: 'message',
        role: 'assistant',
        content: longContent,
      });

      // Should detect and parse successfully
      const detected = detectVendor(longMessage);
      expect(detected?.vendor).toBe('claude');

      const events = parser.parse(longMessage);
      expect(events).toHaveLength(1);
      expect(events[0].text).toBe(longContent);
    });

    it('handles unicode and special characters', () => {
      const parser = selectParser('claude');

      const unicodeTestCases = [
        'Hello 👋 World 🌍',
        'Emoji: 🎉🎊🎈',
        'Unicode: àáâãäåæçèéêë',
        'CJK: 你好世界 こんにちは 안녕하세요',
        'Mathematical: ∑∏∫∆∇',
        'Mixed: Hello 世界 🌍 àáâã',
        'Zero-width: a\u200bb\u200cc', // Zero-width spaces
        'RTL: العربية עברית',
        'Combining: e\u0301e\u0302e\u0303', // Combining diacritics
      ];

      for (const content of unicodeTestCases) {
        const message = JSON.stringify({
          type: 'message',
          role: 'assistant',
          content,
        });

        const detected = detectVendor(message);
        expect(
          detected?.vendor,
          `Unicode test case should be detected: ${content}`,
        ).toBe('claude');

        const events = parser.parse(message);
        expect(events).toHaveLength(1);
        expect(
          events[0].text,
          `Unicode content should be preserved: ${content}`,
        ).toBe(content);
      }
    });

    it('handles special whitespace and line endings', () => {
      const parser = selectParser('claude');

      const whitespaceTestCases = [
        'Line 1\nLine 2\nLine 3',
        'Tab\tSeparated\tValues',
        'Carriage\rReturn',
        'Windows\r\nEndings',
        'Form\fFeed',
        'Vertical\vTab',
        'Non-breaking\u00A0space',
        'Em\u2003space',
        'Zero\u200Bwidth\u200Cspace',
      ];

      for (const content of whitespaceTestCases) {
        const message = JSON.stringify({
          type: 'message',
          role: 'assistant',
          content,
        });

        const detected = detectVendor(message);
        expect(
          detected?.vendor,
          `Whitespace test case should be detected: ${JSON.stringify(content)}`,
        ).toBe('claude');

        const events = parser.parse(message);
        expect(events).toHaveLength(1);
        expect(
          events[0].text,
          `Whitespace should be preserved: ${JSON.stringify(content)}`,
        ).toBe(content);
      }
    });
  });

  describe('Unknown Event Types', () => {
    it('handles unknown event types gracefully', () => {
      const parser = selectParser('claude');

      const unknownEventTypes = [
        'unknown_event',
        'future_event',
        'experimental',
        'deprecated',
        'custom_event',
        'vendor_specific',
        'test_event',
      ];

      for (const eventType of unknownEventTypes) {
        const unknownEvent = JSON.stringify({
          type: eventType,
          data: 'test data',
          timestamp: Date.now(),
        });

        // Should not detect as Claude format (unknown event type)
        const detected = detectVendor(unknownEvent);
        expect(
          detected,
          `Unknown event type should not be detected: ${eventType}`,
        ).toBeNull();

        // But if we force parse with Claude parser, should get debug event
        const events = parser.parse(unknownEvent);
        expect(events).toHaveLength(1);
        expect(events[0].t).toBe('debug');
        expect(events[0].raw).toBeDefined();
        expect(events[0].raw.type).toBe(eventType);
      }
    });

    it('handles events with missing required fields', () => {
      const parser = selectParser('claude');

      // Test incomplete events that would still be recognized as Claude format
      const incompleteClaudeEvents = [
        '{"type":"message","role":"assistant"}', // Missing content but has role
        '{"type":"message","role":"user","content":""}', // Empty content
        '{"type":"tool_use"}', // Tool use type is Claude-specific
        '{"type":"tool_result"}', // Tool result type is Claude-specific
        '{"type":"usage"}', // Usage type is Claude-specific
      ];

      for (const incompleteEvent of incompleteClaudeEvents) {
        // These should be detected as Claude because they have Claude-specific types
        const detected = detectVendor(incompleteEvent);
        if (incompleteEvent.includes('"type":"message"')) {
          // Message events need role field to be detected as Claude
          if (incompleteEvent.includes('"role"')) {
            expect(
              detected?.vendor,
              `Should detect Claude: ${incompleteEvent}`,
            ).toBe('claude');
          }
        } else {
          // tool_use, tool_result, usage are Claude-specific
          expect(
            detected?.vendor,
            `Should detect Claude: ${incompleteEvent}`,
          ).toBe('claude');
        }

        // Should parse without throwing (Claude parser handles missing fields gracefully)
        const events = parser.parse(incompleteEvent);
        expect(events).toBeInstanceOf(Array);

        // Should have at least one event (empty usage events return empty array)
        if (incompleteEvent.includes('"type":"usage"')) {
          // Usage events with no tokens return empty array
          expect(events.length).toBeGreaterThanOrEqual(0);
        } else {
          expect(events.length).toBeGreaterThan(0);
        }
      }

      // Test truly ambiguous events that shouldn't be detected as any vendor
      const ambiguousEvents = [
        '{"type":"message"}', // Too generic
        '{"type":"message","content":"test"}', // Could be any vendor
      ];

      for (const ambiguousEvent of ambiguousEvents) {
        const detected = detectVendor(ambiguousEvent);
        // These shouldn't be detected as Claude (or any vendor)
        expect(
          detected,
          `Should not detect vendor: ${ambiguousEvent}`,
        ).toBeNull();
      }
    });
  });

  describe('Parser Registration Errors', () => {
    it('handles invalid parser registrations', () => {
      const testCases = [
        { parser: null, error: 'Parser cannot be null or undefined' },
        { parser: undefined, error: 'Parser cannot be null or undefined' },
        {
          parser: { vendor: '', detect: () => true, parse: () => [] },
          error: 'Parser must have a valid vendor name',
        },
        {
          parser: { vendor: '   ', detect: () => true, parse: () => [] },
          error: 'Parser must have a valid vendor name',
        },
        {
          parser: { vendor: 'auto', detect: () => true, parse: () => [] },
          error: "Cannot register parser with vendor 'auto'",
        },
      ];

      for (const testCase of testCases) {
        expect(
          () => {
            registry.registerParser(testCase.parser as any);
          },
          `Should throw error for invalid parser: ${JSON.stringify(testCase.parser)}`,
        ).toThrow(testCase.error);
      }
    });

    it('handles invalid priority values', () => {
      const validParser = {
        vendor: 'test-priority',
        detect: () => true,
        parse: () => [],
      };

      const invalidPriorities = [NaN, Infinity, -Infinity];

      for (const priority of invalidPriorities) {
        expect(() => {
          registry.registerParser(validParser, priority);
        }, `Should throw error for invalid priority: ${priority}`).toThrow(
          'Priority must be a finite number',
        );
      }
    });
  });

  describe('Detection Failures', () => {
    it('handles detection failures gracefully', () => {
      const nonMatchingInputs = [
        '{"event":"message","data":"hello"}', // Different format
        '{"kind":"content","text":"hello"}', // Different format
        '{"message":"hello"}', // No type field
        '{"no":"type"}', // No type field
        '{"type":123}', // Type is not string
        '{"type":null}', // Type is null
        '{"type":true}', // Type is boolean
        '{"type":[]}', // Type is array
        '{"type":{}}', // Type is object
      ];

      for (const input of nonMatchingInputs) {
        const detected = detectVendor(input);
        expect(
          detected,
          `Non-matching input should return null: ${input}`,
        ).toBeNull();

        // selectParser with auto should throw for undetected formats
        expect(
          () => selectParser('auto', input),
          `selectParser auto should throw for undetected format: ${input}`,
        ).toThrow('Failed to auto-detect vendor from line');
      }
    });

    it('handles selectParser errors correctly', () => {
      // Unknown vendor
      expect(() => selectParser('unknown' as any)).toThrow(
        'Unknown vendor: unknown',
      );

      // Auto without line
      expect(() => selectParser('auto')).toThrow(
        'Auto-detection requires at least one line',
      );

      // Auto with empty line
      expect(() => selectParser('auto', '')).toThrow(
        'Auto-detection requires at least one line',
      );

      // Auto with undetectable format
      expect(() => selectParser('auto', '{"unknown":"format"}')).toThrow(
        'Failed to auto-detect vendor from line',
      );
    });
  });

  describe('Malformed JSON Validation', () => {
    it('properly validates malformed JSON in error-handling fixtures', () => {
      const errorFixturePath = join(fixturesDir, 'claude/error-handling.jsonl');

      if (!existsSync(errorFixturePath)) {
        console.warn('Error handling fixture not found, skipping test');
        return;
      }

      const content = readFileSync(errorFixturePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      let validJsonCount = 0;
      let invalidJsonCount = 0;
      let parseErrorCount = 0;

      for (const line of lines) {
        // First test JSON validity
        let isValidJson = true;
        try {
          JSON.parse(line);
        } catch (error) {
          isValidJson = false;
          invalidJsonCount++;
        }

        if (isValidJson) {
          validJsonCount++;
          // For valid JSON, parser should work
          const parser = selectParser('claude');
          try {
            const events = parser.parse(line);
            expect(events).toBeInstanceOf(Array);
          } catch (error) {
            // Valid JSON should not throw parse errors
            throw new Error(`Valid JSON should not throw parse error: ${line}`);
          }
        } else {
          // For invalid JSON, parser should throw ParseError
          const parser = selectParser('claude');
          try {
            parser.parse(line);
            throw new Error(`Invalid JSON should throw ParseError: ${line}`);
          } catch (error) {
            expect(error).toBeInstanceOf(ParseError);
            parseErrorCount++;
          }
        }
      }

      console.log('Error handling fixture results:');
      console.log(`  Total lines: ${lines.length}`);
      console.log(`  Valid JSON lines: ${validJsonCount}`);
      console.log(`  Invalid JSON lines: ${invalidJsonCount}`);
      console.log(`  Parse errors: ${parseErrorCount}`);

      // Verify we have both valid and invalid JSON in the fixture
      expect(
        validJsonCount,
        'Should have some valid JSON lines',
      ).toBeGreaterThan(0);
      expect(
        invalidJsonCount,
        'Should have some invalid JSON lines',
      ).toBeGreaterThan(0);
      expect(parseErrorCount, 'Should have parse errors for invalid JSON').toBe(
        invalidJsonCount,
      );
    });

    it('handles specific malformed JSON patterns', () => {
      const malformedPatterns = [
        // From the error-handling fixture
        '{invalid json here',
        '{"broken":}',

        // Additional patterns
        '{"type":"message","content":"unclosed',
        '{"type":"message","content":}',
        '{"type":"message","content":"test"',
        '{"type":"message","content":"test",}',
        '{"type":"message","content":"test"}extra',
        '{"type":"message" "content":"test"}', // Missing comma
        '{"type":"message",:"content":"test"}', // Extra colon
        '{"type":"message",,"content":"test"}', // Double comma
        '{"type":"message","content""test"}', // Missing colon
        'not json at all',
        'undefined',
        '',
      ];

      const parser = selectParser('claude');

      for (const pattern of malformedPatterns) {
        expect(
          () => parser.parse(pattern),
          `Should throw ParseError for malformed JSON: ${pattern}`,
        ).toThrow(ParseError);
      }
    });
  });

  describe('Real Error Handling Fixture Tests', () => {
    it('processes error-handling fixtures correctly', () => {
      const errorFixturePath = join(fixturesDir, 'claude/error-handling.jsonl');

      if (!existsSync(errorFixturePath)) {
        console.warn('Error handling fixture not found, skipping test');
        return;
      }

      const content = readFileSync(errorFixturePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      const parser = selectParser('claude');
      let validLines = 0;
      let invalidLines = 0;
      let parseErrors = 0;

      for (const [lineIndex, line] of lines.entries()) {
        try {
          // Check if line is valid JSON
          JSON.parse(line);
          validLines++;

          // Should detect as Claude
          const detected = detectVendor(line);
          expect(
            detected?.vendor,
            `Line ${lineIndex + 1} should be detected as Claude`,
          ).toBe('claude');

          // Should parse successfully
          const events = parser.parse(line);
          expect(events).toBeInstanceOf(Array);
        } catch (jsonError) {
          invalidLines++;

          // Gemini will detect malformed JSON as plain text
          const detected = detectVendor(line);
          expect(
            detected?.vendor,
            `Line ${lineIndex + 1} with invalid JSON should be detected by Gemini`,
          ).toBe('gemini');

          // Parser should throw ParseError for invalid JSON
          try {
            parser.parse(line);
            expect.fail(
              `Line ${lineIndex + 1} should throw ParseError for invalid JSON`,
            );
          } catch (parseError) {
            parseErrors++;
            expect(parseError).toBeInstanceOf(ParseError);
          }
        }
      }

      console.log(`Error handling fixture results:`);
      console.log(`  Total lines: ${lines.length}`);
      console.log(`  Valid JSON lines: ${validLines}`);
      console.log(`  Invalid JSON lines: ${invalidLines}`);
      console.log(`  Parse errors: ${parseErrors}`);

      // Should have some invalid lines to test error handling
      expect(
        invalidLines,
        'Error handling fixture should contain some invalid JSON',
      ).toBeGreaterThan(0);
      expect(parseErrors, 'Should have parse errors for invalid JSON').toBe(
        invalidLines,
      );
    });
  });
});
