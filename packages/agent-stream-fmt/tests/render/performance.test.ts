/**
 * Performance tests for the rendering engine
 */

/* eslint-disable no-console */
import { describe, it, expect, beforeEach } from 'vitest';
import { AnsiRenderer } from '../../src/render/ansi.js';
import { HtmlRenderer } from '../../src/render/html.js';
import type { AgentEvent, MessageEvent, ToolEvent } from '../../src/types.js';
import type { RenderOptions } from '../../src/render/types.js';
import { performance } from 'perf_hooks';

// Helper to generate test events
function generateTestEvents(count: number): AgentEvent[] {
  const events: AgentEvent[] = [];

  for (let i = 0; i < count; i++) {
    const eventType = i % 5;

    switch (eventType) {
      case 0:
        events.push({
          t: 'msg',
          role: i % 2 === 0 ? 'user' : 'assistant',
          text: `Message ${i}: This is a test message with some content that represents typical chat interaction.`,
        });
        break;

      case 1:
        events.push({
          t: 'tool',
          name: `tool-${i}`,
          phase: 'start',
          text: 'run command',
        });
        break;

      case 2:
        events.push({
          t: 'tool',
          name: `tool-${i - 1}`,
          phase: 'stdout',
          text: `Output line ${i}: Processing data and generating results...`,
        });
        break;

      case 3:
        events.push({
          t: 'tool',
          name: `tool-${i - 2}`,
          phase: 'end',
          exitCode: 0,
        });
        break;

      case 4:
        events.push({
          t: 'cost',
          deltaUsd: 0.0001 * (i % 10),
        });
        break;
    }
  }

  return events;
}

// Helper to generate complex message with formatting
function generateComplexMessage(size: 'small' | 'medium' | 'large'): string {
  const baseText = 'This is **bold** and *italic* and `code` text. ';
  const repeat = size === 'small' ? 1 : size === 'medium' ? 10 : 100;
  return baseText.repeat(repeat);
}

describe('Rendering Performance', () => {
  const defaultOptions: RenderOptions = {
    format: 'ansi',
    collapseTools: false,
    hideTools: false,
    hideCost: false,
    hideDebug: false,
  };

  describe('ANSI Renderer Performance', () => {
    let renderer: AnsiRenderer;

    beforeEach(() => {
      renderer = new AnsiRenderer(defaultOptions);
    });

    it('should maintain 50k+ events/second throughput', async () => {
      const events = generateTestEvents(50000);

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(`ANSI Renderer: ${eventsPerSecond.toFixed(0)} events/second`);

      expect(eventsPerSecond).toBeGreaterThan(50000);
    });

    it('should handle batch rendering efficiently', () => {
      const events = generateTestEvents(10000);

      const start = performance.now();
      renderer.renderBatch(events);
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(`ANSI Batch: ${eventsPerSecond.toFixed(0)} events/second`);

      expect(eventsPerSecond).toBeGreaterThan(100000); // Batch should be faster
    });

    it('should maintain performance with complex formatting', () => {
      const events: MessageEvent[] = [];
      for (let i = 0; i < 10000; i++) {
        events.push({
          t: 'msg',
          role: 'assistant',
          text: generateComplexMessage('medium'),
        });
      }

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(`ANSI Complex: ${eventsPerSecond.toFixed(0)} events/second`);

      expect(eventsPerSecond).toBeGreaterThan(10000); // Lower threshold for complex formatting
    });

    it('should not degrade with tool tracking', () => {
      const events: ToolEvent[] = [];

      // Generate interleaved tool events
      for (let i = 0; i < 1000; i++) {
        events.push({ t: 'tool', name: `tool-${i}`, phase: 'start' });
        for (let j = 0; j < 10; j++) {
          events.push({
            t: 'tool',
            name: `tool-${i}`,
            phase: 'stdout',
            text: `Output line ${j}`,
          });
        }
        events.push({
          t: 'tool',
          name: `tool-${i}`,
          phase: 'end',
          exitCode: 0,
        });
      }

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(
        `ANSI Tool Tracking: ${eventsPerSecond.toFixed(0)} events/second`,
      );

      expect(eventsPerSecond).toBeGreaterThan(50000);
    });

    it('should handle collapsed tools efficiently', () => {
      const collapsedRenderer = new AnsiRenderer({
        ...defaultOptions,
        collapseTools: true,
      });

      const events = generateTestEvents(10000);

      const start = performance.now();
      for (const event of events) {
        collapsedRenderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(
        `ANSI Collapsed: ${eventsPerSecond.toFixed(0)} events/second`,
      );

      expect(eventsPerSecond).toBeGreaterThan(50000);
    });
  });

  describe('HTML Renderer Performance', () => {
    let renderer: HtmlRenderer;

    beforeEach(() => {
      renderer = new HtmlRenderer({ ...defaultOptions, format: 'html' });
    });

    it('should maintain 50k+ events/second throughput', () => {
      const events = generateTestEvents(50000);

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(`HTML Renderer: ${eventsPerSecond.toFixed(0)} events/second`);

      expect(eventsPerSecond).toBeGreaterThan(50000);
    });

    it('should handle HTML escaping without significant overhead', () => {
      const events: MessageEvent[] = [];
      for (let i = 0; i < 10000; i++) {
        events.push({
          t: 'msg',
          role: 'user',
          text: 'Text with <special> & "characters" that need \'escaping\'',
        });
      }

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(`HTML Escaping: ${eventsPerSecond.toFixed(0)} events/second`);

      expect(eventsPerSecond).toBeGreaterThan(30000);
    });
  });

  describe('Memory Usage', () => {
    it('should maintain constant memory for streaming (ANSI)', () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const batchSize = 1000;
      const iterations = 100;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memStart = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const events = generateTestEvents(batchSize);
        for (const event of events) {
          renderer.render(event);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memEnd = process.memoryUsage().heapUsed;
      const memDelta = memEnd - memStart;
      const memDeltaMB = memDelta / (1024 * 1024);

      console.log(
        `Memory delta: ${memDeltaMB.toFixed(2)} MB for ${iterations * batchSize} events`,
      );

      // Should use less than 20MB for 100k events
      expect(memDeltaMB).toBeLessThan(20);
    });

    it('should not leak memory with tool tracking', () => {
      const renderer = new AnsiRenderer(defaultOptions);

      // Start many tools but only end some
      for (let i = 0; i < 1000; i++) {
        renderer.render({ t: 'tool', name: `tool-${i}`, phase: 'start' });

        // Only end half the tools
        if (i % 2 === 0) {
          renderer.render({
            t: 'tool',
            name: `tool-${i}`,
            phase: 'end',
            exitCode: 0,
          });
        }
      }

      // Flush should clean up
      renderer.flush();

      // Process more events
      for (let i = 0; i < 1000; i++) {
        renderer.render({ t: 'msg', role: 'user', text: `Message ${i}` });
      }

      // Memory should be reasonable
      const mem = process.memoryUsage().heapUsed / (1024 * 1024);
      expect(mem).toBeLessThan(100); // Less than 100MB
    });
  });

  describe('Latency', () => {
    it('should have low latency for first output', () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const event: MessageEvent = { t: 'msg', role: 'user', text: 'Hello' };

      const start = performance.now();
      const output = renderer.render(event);
      const elapsed = performance.now() - start;

      expect(output).toBeTruthy();
      expect(elapsed).toBeLessThan(10); // Less than 10ms
      console.log(`First render latency: ${elapsed.toFixed(2)}ms`);
    });

    it('should maintain low latency under load', () => {
      const renderer = new AnsiRenderer(defaultOptions);

      // Warm up
      for (let i = 0; i < 1000; i++) {
        renderer.render({ t: 'msg', role: 'user', text: 'Warmup' });
      }

      // Measure individual render times
      const latencies: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        renderer.render({ t: 'msg', role: 'user', text: `Message ${i}` });
        const elapsed = performance.now() - start;
        latencies.push(elapsed);
      }

      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      console.log(
        `Render latencies - P50: ${p50.toFixed(3)}ms, P95: ${p95.toFixed(3)}ms, P99: ${p99.toFixed(3)}ms`,
      );

      expect(p50).toBeLessThan(0.1); // P50 < 0.1ms
      expect(p95).toBeLessThan(1); // P95 < 1ms
      expect(p99).toBeLessThan(5); // P99 < 5ms
    });
  });

  describe('Edge Cases Performance', () => {
    it('should handle very long lines efficiently', () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const longText = 'a'.repeat(10000); // 10KB line

      const events: MessageEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        events.push({ t: 'msg', role: 'user', text: longText });
      }

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(`Long lines: ${eventsPerSecond.toFixed(0)} events/second`);

      expect(eventsPerSecond).toBeGreaterThan(1000); // Lower threshold for very long lines
    });

    it('should handle rapid tool switches efficiently', () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const events: ToolEvent[] = [];

      // Rapidly switch between many tools
      for (let i = 0; i < 10000; i++) {
        const toolId = i % 100; // 100 different tools
        events.push({
          t: 'tool',
          name: `tool-${toolId}`,
          phase: i % 3 === 0 ? 'start' : i % 3 === 1 ? 'stdout' : 'end',
          text: i % 3 === 1 ? 'output' : undefined,
          exitCode: i % 3 === 2 ? 0 : undefined,
        });
      }

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(
        `Rapid tool switches: ${eventsPerSecond.toFixed(0)} events/second`,
      );

      expect(eventsPerSecond).toBeGreaterThan(30000);
    });

    it('should handle mixed event types efficiently', () => {
      const renderer = new AnsiRenderer(defaultOptions);

      // Generate a realistic mixed workload
      const events: AgentEvent[] = [];
      for (let i = 0; i < 10000; i++) {
        if (i % 100 === 0) {
          events.push({ t: 'cost', deltaUsd: 0.001 });
        } else if (i % 50 === 0) {
          events.push({ t: 'error', message: 'An error occurred' });
        } else if (i % 20 === 0) {
          events.push({ t: 'debug', raw: { data: 'debug info' } });
        } else if (i % 10 < 3) {
          events.push({
            t: 'tool',
            name: 'tool',
            phase: ['start', 'stdout', 'end'][i % 3] as any,
            text: i % 3 === 1 ? 'output' : undefined,
            exitCode: i % 3 === 2 ? 0 : undefined,
          });
        } else {
          events.push({
            t: 'msg',
            role: i % 2 === 0 ? 'user' : 'assistant',
            text: 'Message content',
          });
        }
      }

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(
        `Mixed workload: ${eventsPerSecond.toFixed(0)} events/second`,
      );

      expect(eventsPerSecond).toBeGreaterThan(50000);
    });
  });

  describe('Comparative Performance', () => {
    it('should have similar performance between ANSI and HTML renderers', () => {
      const events = generateTestEvents(10000);

      const ansiRenderer = new AnsiRenderer(defaultOptions);
      const htmlRenderer = new HtmlRenderer({
        ...defaultOptions,
        format: 'html',
      });

      // Measure ANSI
      const ansiStart = performance.now();
      for (const event of events) {
        ansiRenderer.render(event);
      }
      const ansiElapsed = performance.now() - ansiStart;

      // Measure HTML
      const htmlStart = performance.now();
      for (const event of events) {
        htmlRenderer.render(event);
      }
      const htmlElapsed = performance.now() - htmlStart;

      const ansiEventsPerSec = (events.length * 1000) / ansiElapsed;
      const htmlEventsPerSec = (events.length * 1000) / htmlElapsed;

      console.log(`ANSI: ${ansiEventsPerSec.toFixed(0)} events/sec`);
      console.log(`HTML: ${htmlEventsPerSec.toFixed(0)} events/sec`);
      console.log(
        `Ratio: ${(ansiEventsPerSec / htmlEventsPerSec).toFixed(2)}x`,
      );

      // HTML should be within 2x of ANSI performance
      expect(htmlEventsPerSec).toBeGreaterThan(ansiEventsPerSec * 0.5);
    });
  });

  describe('Streaming Performance', () => {
    it('should maintain performance with continuous streaming', async () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const duration = 1000; // 1 second test
      let eventCount = 0;

      const start = performance.now();
      while (performance.now() - start < duration) {
        renderer.render({
          t: 'msg',
          role: eventCount % 2 === 0 ? 'user' : 'assistant',
          text: `Streaming message ${eventCount}`,
        });
        eventCount++;
      }

      const elapsed = performance.now() - start;
      const eventsPerSecond = (eventCount * 1000) / elapsed;

      console.log(
        `Streaming: ${eventsPerSecond.toFixed(0)} events/second over ${elapsed.toFixed(0)}ms`,
      );
      expect(eventsPerSecond).toBeGreaterThan(50000);
    });

    it('should handle backpressure gracefully', async () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const events = generateTestEvents(100000);

      // Simulate async processing with delays
      const processWithBackpressure = async () => {
        const batchSize = 1000;
        const start = performance.now();

        for (let i = 0; i < events.length; i += batchSize) {
          const batch = events.slice(i, i + batchSize);

          // Process batch
          for (const event of batch) {
            renderer.render(event);
          }

          // Simulate backpressure - yield to event loop
          if (i % 10000 === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }

        const elapsed = performance.now() - start;
        return (events.length * 1000) / elapsed;
      };

      const eventsPerSecond = await processWithBackpressure();
      console.log(
        `With backpressure: ${eventsPerSecond.toFixed(0)} events/second`,
      );

      expect(eventsPerSecond).toBeGreaterThan(40000);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle Claude-style conversation efficiently', () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const events: AgentEvent[] = [];

      // Simulate a typical Claude conversation
      for (let i = 0; i < 100; i++) {
        // User message
        events.push({
          t: 'msg',
          role: 'user',
          text: `Question ${i}: Can you help me with a complex programming task?`,
        });

        // Assistant thinking
        events.push({
          t: 'msg',
          role: 'assistant',
          text: `I'll help you with that. Let me analyze the requirements...`,
        });

        // Tool usage
        events.push({
          t: 'tool',
          name: 'analyze_code',
          phase: 'start',
          text: 'repository.py',
        });
        for (let j = 0; j < 20; j++) {
          events.push({
            t: 'tool',
            name: 'analyze_code',
            phase: 'stdout',
            text: `Analyzing line ${j * 10}-${(j + 1) * 10}...`,
          });
        }
        events.push({
          t: 'tool',
          name: 'analyze_code',
          phase: 'end',
          exitCode: 0,
        });

        // More assistant response
        events.push({
          t: 'msg',
          role: 'assistant',
          text: `Based on my analysis, here's what I found...`.repeat(10),
        });

        // Cost tracking
        events.push({ t: 'cost', deltaUsd: 0.0023 });
      }

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(
        `Claude-style conversation: ${eventsPerSecond.toFixed(0)} events/second`,
      );

      expect(eventsPerSecond).toBeGreaterThan(30000);
    });

    it('should handle build tool output efficiently', () => {
      const renderer = new AnsiRenderer(defaultOptions);
      const events: AgentEvent[] = [];

      // Simulate a build process with lots of output
      events.push({
        t: 'tool',
        name: 'npm',
        phase: 'start',
        text: 'run build',
      });

      // Lots of build output
      for (let i = 0; i < 5000; i++) {
        if (i % 100 === 0) {
          events.push({
            t: 'tool',
            name: 'npm',
            phase: 'stdout',
            text: `[${i}/5000] Building module...`,
          });
        } else if (i % 50 === 0) {
          events.push({
            t: 'tool',
            name: 'npm',
            phase: 'stderr',
            text: `Warning: Deprecated API usage in module ${i}`,
          });
        } else {
          events.push({
            t: 'tool',
            name: 'npm',
            phase: 'stdout',
            text: `  Processing file_${i}.js`,
          });
        }
      }

      events.push({ t: 'tool', name: 'npm', phase: 'end', exitCode: 0 });

      const start = performance.now();
      for (const event of events) {
        renderer.render(event);
      }
      const elapsed = performance.now() - start;

      const eventsPerSecond = (events.length * 1000) / elapsed;
      console.log(`Build output: ${eventsPerSecond.toFixed(0)} events/second`);

      expect(eventsPerSecond).toBeGreaterThan(50000);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not leak memory with exception handling', () => {
      const renderer = new AnsiRenderer(defaultOptions);

      // Create events that might cause exceptions
      const problematicEvents: any[] = [
        { t: 'msg', role: null, text: null },
        { t: 'tool', name: undefined, phase: 'invalid' },
        { t: 'cost', deltaUsd: 'not a number' },
        { t: 'debug', raw: undefined },
        { t: 'unknown', data: { circular: null } },
      ];

      // Make circular reference
      problematicEvents[4].data.circular = problematicEvents[4].data;

      // Process many times
      for (let i = 0; i < 10000; i++) {
        for (const event of problematicEvents) {
          try {
            renderer.render(event);
          } catch (e) {
            // Errors should be handled gracefully
          }
        }
      }

      // Should not crash or leak significant memory
      const mem = process.memoryUsage().heapUsed / (1024 * 1024);
      expect(mem).toBeLessThan(200); // Less than 200MB
    });

    it('should clean up tool state to prevent memory growth', () => {
      const renderer = new AnsiRenderer(defaultOptions);

      // Repeatedly start and end tools
      for (let cycle = 0; cycle < 100; cycle++) {
        // Start 100 tools
        for (let i = 0; i < 100; i++) {
          renderer.render({
            t: 'tool',
            name: `tool-${cycle}-${i}`,
            phase: 'start',
          });

          // Add some output
          for (let j = 0; j < 10; j++) {
            renderer.render({
              t: 'tool',
              name: `tool-${cycle}-${i}`,
              phase: 'stdout',
              text: `Output line ${j}`,
            });
          }
        }

        // End all tools
        for (let i = 0; i < 100; i++) {
          renderer.render({
            t: 'tool',
            name: `tool-${cycle}-${i}`,
            phase: 'end',
            exitCode: 0,
          });
        }
      }

      // Flush any remaining state
      renderer.flush();

      // Memory should be reasonable after processing 10k tools
      const mem = process.memoryUsage().heapUsed / (1024 * 1024);
      expect(mem).toBeLessThan(100); // Less than 100MB (realistic for 10k tools)
    });
  });

  describe('Startup Performance', () => {
    it('should have fast initialization time', () => {
      const start = performance.now();

      // Create multiple renderers
      for (let i = 0; i < 100; i++) {
        new AnsiRenderer(defaultOptions);
        new HtmlRenderer({ ...defaultOptions, format: 'html' });
      }

      const elapsed = performance.now() - start;
      console.log(
        `Initialization time for 200 renderers: ${elapsed.toFixed(2)}ms`,
      );

      // Should initialize 200 renderers in under 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it('should render first event quickly after initialization', () => {
      const latencies: number[] = [];

      for (let i = 0; i < 100; i++) {
        const renderer = new AnsiRenderer(defaultOptions);

        const start = performance.now();
        renderer.render({ t: 'msg', role: 'user', text: 'First message' });
        const elapsed = performance.now() - start;

        latencies.push(elapsed);
      }

      const avgLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
      console.log(`Average first render latency: ${avgLatency.toFixed(3)}ms`);

      expect(avgLatency).toBeLessThan(1); // Less than 1ms average
    });
  });
});
