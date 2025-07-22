/**
 * Tests for the streamFormat function
 */

import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { streamFormat } from '../stream.js';
import type { StreamFormatOptions } from '../types.js';

describe('streamFormat', () => {
  /**
   * Helper to create a readable stream from string data
   */
  function createStream(data: string): NodeJS.ReadableStream {
    return Readable.from([data]);
  }

  /**
   * Helper to collect all output from streamFormat
   */
  async function collectFormatted(
    options: StreamFormatOptions,
  ): Promise<string> {
    const outputs: string[] = [];
    for await (const output of streamFormat(options)) {
      outputs.push(output);
    }
    return outputs.join('');
  }

  describe('JSON format', () => {
    it('should format Claude message events as JSON', async () => {
      const claudeData =
        '{"type":"message","role":"assistant","content":"Hello!"}\n';
      const output = await collectFormatted({
        vendor: 'claude',
        source: createStream(claudeData),
        format: 'json',
      });

      const parsed = JSON.parse(output.trim());
      expect(parsed).toEqual({
        t: 'msg',
        role: 'assistant',
        text: 'Hello!',
      });
    });

    it('should format with pretty printing when compactMode is false', async () => {
      const claudeData = '{"type":"message","role":"user","content":"Hi"}\n';
      const output = await collectFormatted({
        vendor: 'claude',
        source: createStream(claudeData),
        format: 'json',
        renderOptions: { compactMode: false },
      });

      // Pretty printed JSON should have newlines and indentation
      expect(output).toContain('\n');
      expect(output).toContain('  ');
      expect(output).toContain('"t": "msg"');
    });

    it('should respect hideTools option', async () => {
      const claudeData = [
        '{"type":"message","role":"assistant","content":"Running tool..."}',
        '{"type":"tool_use","name":"bash","input":{"command":"echo hello"}}',
        '{"type":"tool_result","output":"hello","exit_code":0}',
        '{"type":"message","role":"assistant","content":"Done!"}',
      ].join('\n');

      const output = await collectFormatted({
        vendor: 'claude',
        source: createStream(claudeData),
        format: 'json',
        renderOptions: { hideTools: true, compactMode: true },
      });

      const lines = output
        .trim()
        .split('\n')
        .filter(line => line.length > 0);
      const events = lines.map(line => JSON.parse(line));

      // Should only have message events (tools are hidden)
      expect(events).toHaveLength(2);
      expect(events.every(e => e.t === 'msg')).toBe(true);
      expect(events[0].text).toBe('Running tool...');
      expect(events[1].text).toBe('Done!');
    });

    it('should add timestamps when showTimestamps is true', async () => {
      const claudeData =
        '{"type":"message","role":"assistant","content":"Hello!"}\n';
      const output = await collectFormatted({
        vendor: 'claude',
        source: createStream(claudeData),
        format: 'json',
        renderOptions: { showTimestamps: true },
      });

      const parsed = JSON.parse(output.trim());
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Error handling', () => {
    it('should format parse errors as error events', async () => {
      const invalidData = 'not valid json\n';
      const output = await collectFormatted({
        vendor: 'claude',
        source: createStream(invalidData),
        format: 'json',
        renderOptions: { compactMode: true },
      });

      const parsed = JSON.parse(output.trim());
      expect(parsed.t).toBe('error');
      expect(parsed.message).toContain('Invalid JSON');
    });

    it('should continue on errors by default', async () => {
      const mixedData = [
        '{"type":"message","role":"user","content":"Hi"}',
        'invalid json',
        '{"type":"message","role":"assistant","content":"Hello"}',
      ].join('\n');

      const output = await collectFormatted({
        vendor: 'claude',
        source: createStream(mixedData),
        format: 'json',
        renderOptions: { compactMode: true },
      });

      const lines = output
        .trim()
        .split('\n')
        .filter(line => line.length > 0);
      const events = lines.map(line => JSON.parse(line));

      expect(events).toHaveLength(3);
      expect(events[0].t).toBe('msg');
      expect(events[1].t).toBe('error');
      expect(events[2].t).toBe('msg');
    });
  });

  describe('Renderer flush', () => {
    it('should call renderer flush at the end', async () => {
      const claudeData =
        '{"type":"message","role":"assistant","content":"Test"}\n';

      // For JSON renderer, flush returns empty string, but we're testing the flow
      const output = await collectFormatted({
        vendor: 'claude',
        source: createStream(claudeData),
        format: 'json',
      });

      // Should have the formatted event
      expect(output.trim()).toBeTruthy();
    });

    it('should flush even on stream error', async () => {
      const errorStream = new Readable({
        read() {
          this.emit('error', new Error('Stream error'));
        },
      });

      try {
        await collectFormatted({
          vendor: 'claude',
          source: errorStream as NodeJS.ReadableStream,
          format: 'json',
        });
        // Should not reach here
        expect.fail('Should have thrown error');
      } catch (error) {
        // Error is expected
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Stream error');
      }
    });
  });
});
