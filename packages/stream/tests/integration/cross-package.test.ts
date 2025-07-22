import { describe, it, expect } from 'vitest';
import { streamEvents } from '@agent-io/stream';
import { createFixture } from '../fixtures';

/**
 * Integration tests for cross-package functionality
 */

describe('Cross-package integration', () => {
  it('should process JSONL through the streaming formatter', async () => {
    // Create test data
    const jsonlData = [
      '{"type":"message","role":"assistant","content":"Hello from integration test"}',
      '{"type":"tool_use","name":"test","action":"start"}',
      '{"type":"usage","input_tokens":100,"output_tokens":50}',
    ].join('\n');

    const fixture = createFixture(jsonlData);
    const events: any[] = [];

    // Process through stream formatter
    for await (const event of streamEvents({
      vendor: 'claude',
      source: fixture.asStream(),
    })) {
      events.push(event);
    }

    // Verify events were parsed correctly
    expect(events.length).toBeGreaterThan(0);

    // Find specific event types
    const msgEvent = events.find(e => e.t === 'msg');
    const toolEvent = events.find(e => e.t === 'tool');
    const costEvent = events.find(e => e.t === 'cost');

    expect(msgEvent).toMatchObject({
      t: 'msg',
      role: 'assistant',
      text: 'Hello from integration test',
    });
    expect(toolEvent).toMatchObject({
      t: 'tool',
      name: 'test',
      phase: 'start',
    });
    expect(costEvent).toMatchObject({
      t: 'cost',
      deltaUsd: expect.any(Number),
    });
  });

  it('should handle errors gracefully across packages', async () => {
    const invalidData = createFixture('{invalid json}\n{"valid":true}');
    const events: any[] = [];
    const errors: any[] = [];

    for await (const event of streamEvents({
      vendor: 'claude',
      source: invalidData.asStream(),
    })) {
      if (event.t === 'error') {
        errors.push(event);
      } else {
        events.push(event);
      }
    }

    // Should have processed the valid line despite the error
    expect(errors.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
  });
});
