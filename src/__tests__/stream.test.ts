import { describe, it, expect } from 'vitest';
import { createReadStream } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { streamEvents, collectEvents } from '../stream.js';

describe('Stream events', () => {
  const fixturesDir = join(process.cwd(), 'tests/fixtures');

  describe('fixture processing', () => {
    it('processes Claude basic messages', async () => {
      const stream = createReadStream(
        join(fixturesDir, 'claude/basic-message.jsonl'),
      );

      const events = await collectEvents({
        vendor: 'claude',
        source: stream,
      });

      expect(events).toHaveLength(3);
      expect(events[0]).toMatchObject({
        t: 'msg',
        role: 'user',
      });
      expect(events[2]).toMatchObject({
        t: 'cost',
      });
    });

    it('auto-detects vendor format', async () => {
      const stream = createReadStream(
        join(fixturesDir, 'claude/basic-message.jsonl'),
      );

      const events = await collectEvents({
        vendor: 'auto',
        source: stream,
      });

      expect(events).toHaveLength(3);
      expect(events[0].t).toBe('msg');
    });
  });

  describe('error handling', () => {
    it('continues on parse errors by default', async () => {
      const input = Readable.from([
        '{"type":"message_start"}\n',
        'invalid json\n',
        '{"type":"content_delta","text":"hello"}\n',
      ]);

      const events = await collectEvents({
        vendor: 'claude',
        source: input,
      });

      // Should have: 1 start event, 1 error event, 1 delta event, 1 stop event
      expect(events.length).toBeGreaterThanOrEqual(3);

      const errorEvents = events.filter(e => e.t === 'error');
      expect(errorEvents).toHaveLength(1);
      expect((errorEvents[0] as any).message.toLowerCase()).toContain(
        'invalid json',
      );
    });

    it('stops on error when configured', async () => {
      const input = Readable.from([
        '{"type":"message_start"}\n',
        'invalid json\n',
        '{"type":"content_delta","text":"hello"}\n',
      ]);

      await expect(
        collectEvents({
          vendor: 'claude',
          source: input,
          continueOnError: false,
        }),
      ).rejects.toThrow();
    });

    it('stops after max consecutive errors', async () => {
      const badLines = Array(10).fill('invalid json\n');
      const input = Readable.from(badLines);

      await expect(
        collectEvents({
          vendor: 'claude',
          source: input,
          maxConsecutiveErrors: 5,
        }),
      ).rejects.toThrow('Stopped after 5 consecutive errors');
    });
  });

  describe('debug events', () => {
    it('emits debug events when enabled', async () => {
      const input = Readable.from([
        '{"type":"message_start"}\n',
        'invalid json\n',
      ]);

      const events = await collectEvents({
        vendor: 'auto',
        source: input,
        emitDebugEvents: true,
      });

      const debugEvents = events.filter(e => e.t === 'debug');
      expect(debugEvents.length).toBeGreaterThan(0);

      // Should have vendor detection debug event (only when auto-detecting)
      const detectionEvent = debugEvents.find(e => (e as any).raw?.detected);
      if (detectionEvent) {
        expect((detectionEvent as any).raw.detected).toBeDefined();
      }

      // Should have summary debug event
      const summaryEvent = debugEvents.find(e => (e as any).raw?.summary);
      expect(summaryEvent).toBeDefined();
      expect((summaryEvent as any)?.raw?.summary).toMatchObject({
        totalLines: expect.any(Number),
        successfulLines: expect.any(Number),
        errorLines: expect.any(Number),
        successRate: expect.any(String),
      });
    });
  });

  describe('streaming behavior', () => {
    it('yields events as they are parsed', async () => {
      const input = Readable.from([
        '{"type":"message","role":"user","content":"hello"}\n',
        '{"type":"tool_use","id":"tool_1","name":"test","input":{"foo":"bar"}}\n',
        '{"type":"tool_result","tool_use_id":"tool_1","content":"result"}\n',
        '{"type":"message","role":"assistant","content":"done"}\n',
      ]);

      const events: any[] = [];
      for await (const event of streamEvents({
        vendor: 'claude',
        source: input,
      })) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThanOrEqual(4);

      // Verify we have the expected event types
      const eventTypes = events.map(e => e.t);
      expect(eventTypes).toContain('msg');
      expect(eventTypes).toContain('tool');
    });
  });
});
