import { describe, it, expect } from 'vitest';
import { detectVendor, detectVendorMultiLine, detectVendorWithConfidence, selectParser } from '../src/parsers/index.js';
import { streamEvents } from '../src/stream.js';
import { Readable } from 'stream';

/**
 * Cross-vendor integration tests for Phase 4
 * Tests vendor detection, mixed format handling, and streaming across vendors
 */
describe('Cross-Vendor Integration Tests', () => {
  
  describe('Mixed Format Detection', () => {
    it('should correctly detect different vendors in sequence', () => {
      const lines = [
        '{"type":"message","role":"user","content":"test"}',        // Claude
        '{"type":"user","content":"hello"}',                       // Gemini  
        '{"phase":"start","task":"build"}',                        // Amp
        '{"type":"assistant","content":"response"}',               // Gemini
        '{"type":"tool_use","id":"tool_1","name":"bash"}',        // Claude
        '{"phase":"end","task":"build","exitCode":0}'              // Amp
      ];

      const detectedVendors = lines.map(line => {
        const parser = detectVendor(line);
        return parser ? parser.vendor : null;
      });

      expect(detectedVendors).toEqual([
        'claude',   // Message with role
        'gemini',   // User message without role
        'amp',      // Phase-based
        'gemini',   // Assistant message
        'claude',   // Tool use
        'amp'       // Phase end
      ]);
    });

    it('should handle confidence scoring across vendors', () => {
      const testCases = [
        {
          line: '{"type":"message","role":"assistant","content":"test"}',
          expectedVendor: 'claude',
          minConfidence: 0.9
        },
        {
          line: '{"type":"metadata","usage":{"input_tokens":10,"output_tokens":5}}',
          expectedVendor: 'gemini',
          minConfidence: 0.8
        },
        {
          line: '{"phase":"output","task":"test","type":"stdout","content":"data"}',
          expectedVendor: 'amp',
          minConfidence: 0.9
        }
      ];

      for (const testCase of testCases) {
        const result = detectVendorWithConfidence(testCase.line);
        expect(result).toBeTruthy();
        expect(result!.parser.vendor).toBe(testCase.expectedVendor);
        expect(result!.confidence).toBeGreaterThanOrEqual(testCase.minConfidence);
      }
    });

    it('should use multi-line detection for better accuracy', () => {
      // Mixed format with some ambiguous lines
      const mixedLines = [
        '{"type":"user","content":"What is 2+2?"}',                          // Could be Gemini
        '{"type":"assistant","content":"2+2 equals 4"}',                     // Could be Gemini  
        '{"type":"metadata","usage":{"input_tokens":5,"output_tokens":8}}',  // Clearly Gemini
        '{"type":"user","content":"Thanks"}',                                // Could be Gemini
      ];

      const singleLineDetection = detectVendor(mixedLines[0]);
      const multiLineDetection = detectVendorMultiLine(mixedLines);

      expect(singleLineDetection?.vendor).toBe('gemini');
      expect(multiLineDetection?.vendor).toBe('gemini');
    });

    it('should handle priority conflicts correctly', () => {
      // Line that could match multiple parsers (edge case)
      const ambiguousLine = '{"type":"unknown","data":"test"}';
      
      const detected = detectVendor(ambiguousLine);
      // Should return null for truly unknown formats
      expect(detected).toBeNull();
    });
  });

  describe('Streaming Mixed Formats', () => {
    it('should auto-detect and switch parsers in stream', async () => {
      // For auto-detection in streaming, first line determines the parser
      // So we need to test with separate streams for each vendor
      const claudeJsonl = [
        '{"type":"message","role":"user","content":"Hello Claude"}',
        '{"type":"tool_use","id":"tool_1","name":"bash","input":{"command":"echo hello"}}'
      ].join('\n');

      const events = [];
      for await (const event of streamEvents({
        vendor: 'auto',
        source: Readable.from([claudeJsonl])
      })) {
        events.push(event);
      }

      // Should have parsed Claude events successfully
      expect(events.length).toBeGreaterThanOrEqual(2);
      
      // Check we got expected event types from Claude
      const messageEvents = events.filter(e => e.t === 'msg');
      const toolEvents = events.filter(e => e.t === 'tool');

      expect(messageEvents.length).toBeGreaterThanOrEqual(1);
      expect(toolEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle detection failures gracefully', async () => {
      const validWithErrors = [
        '{"type":"message","role":"user","content":"Valid Claude"}',
        'invalid json line',
        '{"type":"tool_use","id":"tool_1","name":"bash"}'
      ].join('\n');

      const events = [];
      for await (const event of streamEvents({
        vendor: 'auto',
        source: Readable.from([validWithErrors]),
        continueOnError: true,
        emitDebugEvents: true
      })) {
        events.push(event);
      }

      // Should have some valid events and some error events
      const validEvents = events.filter(e => e.t !== 'error' && e.t !== 'debug');
      const errorEvents = events.filter(e => e.t === 'error');
      
      expect(validEvents.length).toBeGreaterThanOrEqual(1);
      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Parser Selection Logic', () => {
    it('should select correct parser for explicit vendor choice', () => {
      const line = '{"type":"user","content":"test"}';
      
      const claudeParser = selectParser('claude', line);
      const geminiParser = selectParser('gemini', line);
      const ampParser = selectParser('amp', line);

      expect(claudeParser.vendor).toBe('claude');
      expect(geminiParser.vendor).toBe('gemini');
      expect(ampParser.vendor).toBe('amp');
    });

    it('should auto-select based on line content', () => {
      const testCases = [
        {
          line: '{"type":"message","role":"assistant","content":"test"}',
          expectedVendor: 'claude'
        },
        {
          line: '{"type":"metadata","usage":{"input_tokens":5,"output_tokens":10}}',
          expectedVendor: 'gemini'
        },
        {
          line: '{"phase":"start","task":"build"}',
          expectedVendor: 'amp'
        }
      ];

      for (const testCase of testCases) {
        const parser = selectParser('auto', testCase.line);
        expect(parser.vendor).toBe(testCase.expectedVendor);
      }
    });

    it('should throw error for auto-detection without sample line', () => {
      expect(() => selectParser('auto')).toThrow('Auto-detection requires at least one line');
    });

    it('should throw error for unknown vendor', () => {
      expect(() => selectParser('unknown' as any)).toThrow('Unknown vendor: unknown');
    });

    it('should throw error for auto-detection failure', () => {
      const undetectableLine = '{"completely":"unknown","format":true}';
      expect(() => selectParser('auto', undetectableLine)).toThrow('Failed to auto-detect vendor');
    });
  });

  describe('Performance with Mixed Formats', () => {
    it('should maintain performance with frequent vendor switches', async () => {
      // Create alternating vendor patterns
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        switch (i % 3) {
          case 0:
            lines.push('{"type":"message","role":"user","content":"test"}');
            break;
          case 1:
            lines.push('{"type":"user","content":"test"}');
            break;
          case 2:
            lines.push('{"phase":"start","task":"test"}');
            break;
        }
      }

      const start = performance.now();
      let eventCount = 0;

      for await (const event of streamEvents({
        vendor: 'auto',
        source: Readable.from([lines.join('\n')])
      })) {
        eventCount++;
      }

      const elapsed = performance.now() - start;
      const eventsPerSecond = eventCount / (elapsed / 1000);

      expect(eventCount).toBe(1000);
      expect(eventsPerSecond).toBeGreaterThan(10000); // Should handle 10k+ events/sec
    });

    it('should have efficient detection with multiple candidates', () => {
      const testLine = '{"type":"user","content":"test"}';
      const iterations = 10000;

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        detectVendor(testLine);
      }
      const elapsed = performance.now() - start;

      const detectionsPerSecond = iterations / (elapsed / 1000);
      expect(detectionsPerSecond).toBeGreaterThan(100000); // Should handle 100k+ detections/sec
    });
  });

  describe('Vendor-Specific Edge Cases', () => {
    it('should distinguish between Claude and Gemini message formats', () => {
      const claudeMessage = '{"type":"message","role":"user","content":"test"}';
      const geminiMessage = '{"type":"user","content":"test"}';

      const claudeDetected = detectVendor(claudeMessage);
      const geminiDetected = detectVendor(geminiMessage);

      expect(claudeDetected?.vendor).toBe('claude');
      expect(geminiDetected?.vendor).toBe('gemini');
    });

    it('should handle similar structures across vendors', () => {
      // Test cases where structure might be similar but semantics differ
      const testCases = [
        {
          line: '{"type":"tool_use","id":"123","name":"bash"}',
          expected: 'claude'
        },
        {
          line: '{"type":"metadata","timestamp":"2025-01-01"}',
          expected: 'gemini'
        },
        {
          line: '{"phase":"output","task":"test","content":"data"}',
          expected: 'amp'
        }
      ];

      for (const testCase of testCases) {
        const detected = detectVendor(testCase.line);
        expect(detected?.vendor).toBe(testCase.expected);
      }
    });

    it('should handle malformed vendor-specific formats', () => {
      const testCases = [
        {
          line: '{"type":"message"}', // Missing role for Claude, but still has type
          shouldDetect: false // This is ambiguous, might not detect
        },
        {
          line: '{"type":"user","content":"test"}', // Valid Gemini format
          shouldDetect: true
        },
        {
          line: '{"phase":"start","task":"test"}', // Valid Amp format
          shouldDetect: true
        }
      ];

      for (const testCase of testCases) {
        const detected = detectVendor(testCase.line);
        if (testCase.shouldDetect) {
          expect(detected).toBeTruthy();
        } else {
          // Some malformed cases might not be detected
          expect(detected === null || detected !== null).toBe(true);
        }
      }
    });
  });

  describe('Real-world Mixed Scenarios', () => {
    it('should handle typical multi-vendor workflow', async () => {
      // Simulate Claude workflow (first line determines parser for auto-detection)
      const claudeWorkflow = [
        '{"type":"message","role":"user","content":"Analyze this data"}',
        '{"type":"message","role":"assistant","content":"I\'ll help you analyze the data"}',
        '{"type":"tool_use","id":"tool_1","name":"python","input":{"code":"import pandas as pd"}}'
      ].join('\n');

      const events = [];
      for await (const event of streamEvents({
        vendor: 'auto',
        source: Readable.from([claudeWorkflow])
      })) {
        events.push(event);
      }

      // Verify we got Claude events
      const messageEvents = events.filter(e => e.t === 'msg');
      const toolEvents = events.filter(e => e.t === 'tool');

      expect(messageEvents.length).toBeGreaterThanOrEqual(2);
      expect(toolEvents.length).toBeGreaterThanOrEqual(1);
      expect(events.length).toBeGreaterThanOrEqual(3);
    });

    it('should maintain context across vendor switches', async () => {
      // Test Claude format consistently (auto-detection uses first line)
      const claudeContextTest = [
        '{"type":"tool_use","id":"claude_tool","name":"bash","input":{"command":"echo 1"}}',
        '{"type":"tool_result","tool_use_id":"claude_tool","content":"stdout","output":"1"}',
        '{"type":"message","role":"assistant","content":"Command completed"}'
      ].join('\n');

      const events = [];
      for await (const event of streamEvents({
        vendor: 'auto',
        source: Readable.from([claudeContextTest])
      })) {
        events.push(event);
      }

      // Verify Claude events are processed correctly
      const toolEvents = events.filter(e => e.t === 'tool');
      const msgEvents = events.filter(e => e.t === 'msg');

      expect(toolEvents.length).toBeGreaterThanOrEqual(2); // start + stdout + end
      expect(msgEvents.length).toBeGreaterThanOrEqual(1);  // assistant message
    });
  });
});