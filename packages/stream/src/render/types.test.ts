import { describe, it, expect } from 'vitest';
import type {
  RenderOptions,
  Renderer,
  RenderContext,
  ToolState,
  RendererFactory,
  RendererRegistry,
} from './types.js';
import type { AgentEvent } from '../types.js';

describe('Render Types', () => {
  it('should allow valid RenderOptions', () => {
    // Minimal options
    const minimal: RenderOptions = {
      format: 'ansi',
    };
    expect(minimal.format).toBe('ansi');

    // Full options
    const full: RenderOptions = {
      format: 'html',
      collapseTools: true,
      hideTools: false,
      hideCost: true,
      hideDebug: true,
      showTimestamps: true,
      compactMode: false,
      colorDisabled: true,
    };
    expect(full.format).toBe('html');
    expect(full.collapseTools).toBe(true);
  });

  it('should enforce format enum values', () => {
    const ansiOpts: RenderOptions = { format: 'ansi' };
    const htmlOpts: RenderOptions = { format: 'html' };
    const jsonOpts: RenderOptions = { format: 'json' };

    expect(ansiOpts.format).toBe('ansi');
    expect(htmlOpts.format).toBe('html');
    expect(jsonOpts.format).toBe('json');

    // TypeScript should prevent invalid formats at compile time
    // This would be a compile error: const _invalidOpts: RenderOptions = { format: 'xml' };
  });

  it('should type check Renderer implementation', () => {
    class TestRenderer implements Renderer {
      render(event: AgentEvent): string {
        return JSON.stringify(event);
      }

      renderBatch(events: AgentEvent[]): string {
        return events.map(e => this.render(e)).join('\n');
      }

      flush(): string {
        return '';
      }
    }

    const renderer = new TestRenderer();
    const event: AgentEvent = { t: 'msg', role: 'user', text: 'Hello' };

    expect(renderer.render(event)).toBe(JSON.stringify(event));
    expect(renderer.renderBatch([event])).toContain('Hello');
    expect(renderer.flush()).toBe('');
  });

  it('should type check RenderContext', () => {
    const context: RenderContext = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now(),
    };

    // Add a tool state
    const toolState: ToolState = {
      name: 'bash',
      startTime: Date.now(),
      outputLines: ['Line 1', 'Line 2'],
      collapsed: false,
    };

    context.toolStack.set('bash', toolState);
    context.messageCount = 5;
    context.previousEvent = { t: 'msg', role: 'assistant', text: 'Response' };

    expect(context.toolStack.get('bash')).toBe(toolState);
    expect(context.messageCount).toBe(5);
    expect(context.previousEvent?.t).toBe('msg');
  });

  it('should type check RendererFactory', () => {
    const factory: RendererFactory = (options: RenderOptions) => {
      return {
        render: (event: AgentEvent) => `[${options.format}] ${event.t}`,
        renderBatch: (events: AgentEvent[]) =>
          events.map(e => `[${options.format}] ${e.t}`).join('\n'),
        flush: () => '',
      };
    };

    const renderer = factory({ format: 'ansi' });
    const event: AgentEvent = { t: 'tool', name: 'ls', phase: 'start' };

    expect(renderer.render(event)).toBe('[ansi] tool');
  });

  it('should type check RendererRegistry', () => {
    const registry: RendererRegistry = {
      ansi: (_options: RenderOptions) => ({
        render: (event: AgentEvent) => `ANSI: ${event.t}`,
        renderBatch: (events: AgentEvent[]) =>
          events.map(e => `ANSI: ${e.t}`).join('\n'),
        flush: () => '',
      }),
      html: (_options: RenderOptions) => ({
        render: (event: AgentEvent) => `<div>${event.t}</div>`,
        renderBatch: (events: AgentEvent[]) =>
          events.map(e => `<div>${e.t}</div>`).join(''),
        flush: () => '</body></html>',
      }),
      json: (_options: RenderOptions) => ({
        render: (event: AgentEvent) => JSON.stringify(event),
        renderBatch: (events: AgentEvent[]) => JSON.stringify(events),
        flush: () => '',
      }),
    };

    // Each factory should produce a valid renderer
    const ansiRenderer = registry.ansi({ format: 'ansi' });
    const htmlRenderer = registry.html({ format: 'html' });
    const jsonRenderer = registry.json({ format: 'json' });

    const event: AgentEvent = { t: 'error', message: 'Test error' };

    expect(ansiRenderer.render(event)).toContain('ANSI');
    expect(htmlRenderer.render(event)).toContain('<div>');
    expect(jsonRenderer.render(event)).toContain('"t":"error"');
  });

  it('should handle optional fields correctly', () => {
    // RenderOptions with only required fields
    const minimalOpts: RenderOptions = { format: 'ansi' };
    expect(minimalOpts.collapseTools).toBeUndefined();
    expect(minimalOpts.hideTools).toBeUndefined();

    // RenderContext with optional previousEvent
    const context: RenderContext = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now(),
    };
    expect(context.previousEvent).toBeUndefined();

    // ToolEvent with optional fields
    const toolEvent: AgentEvent = {
      t: 'tool',
      name: 'git',
      phase: 'start',
      // text and exitCode are optional
    };
    expect((toolEvent as any).text).toBeUndefined();
    expect((toolEvent as any).exitCode).toBeUndefined();
  });
});
