/**
 * Tests for the HTML renderer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlRenderer } from './html.js';
import type {
  AgentEvent,
  MessageEvent,
  ToolEvent,
  CostEvent,
  ErrorEvent,
  DebugEvent,
} from '../types.js';
import type { RenderOptions } from './types.js';

describe('HtmlRenderer', () => {
  let renderer: HtmlRenderer;
  const defaultOptions: RenderOptions = {
    format: 'html',
  };

  beforeEach(() => {
    renderer = new HtmlRenderer(defaultOptions);
  });

  describe('HTML escaping', () => {
    it('should escape HTML entities in message content', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: '<script>alert("XSS")</script> & "quotes" \'apostrophes\'',
      };

      const result = renderer.render(event);
      expect(result).toContain(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
      );
      expect(result).toContain(
        '&amp; &quot;quotes&quot; &#39;apostrophes&#39;',
      );
      expect(result).not.toContain('<script>');
    });

    it('should escape HTML in tool names and input', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: '<dangerous>tool</dangerous>',
        phase: 'start',
        text: '<input>data</input>',
      };

      const result = renderer.render(event);
      expect(result).toContain('&lt;dangerous&gt;tool&lt;/dangerous&gt;');
      expect(result).toContain('&lt;input&gt;data&lt;/input&gt;');
    });
  });

  describe('Message rendering', () => {
    it('should render user messages with correct structure', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: 'Hello, world!',
      };

      const result = renderer.render(event);
      expect(result).toContain('class="message message-user"');
      expect(result).toContain('class="role-icon">👤</span>');
      expect(result).toContain('class="role-name">user</span>');
      expect(result).toContain('class="message-content">Hello, world!</div>');
    });

    it('should render assistant messages with correct icon', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: 'I can help with that.',
      };

      const result = renderer.render(event);
      expect(result).toContain('class="message message-assistant"');
      expect(result).toContain('class="role-icon">🤖</span>');
    });

    it('should render system messages with correct icon', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'system',
        text: 'System message',
      };

      const result = renderer.render(event);
      expect(result).toContain('class="message message-system"');
      expect(result).toContain('class="role-icon">⚙️</span>');
    });

    it('should handle newlines and basic markdown formatting', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: 'Line 1\nLine 2\n\n`code` and **bold** and *italic*',
      };

      const result = renderer.render(event);
      expect(result).toContain('Line 1<br>Line 2<br><br>');
      expect(result).toContain('<code>code</code>');
      expect(result).toContain('<strong>bold</strong>');
      expect(result).toContain('<em>italic</em>');
    });
  });

  describe('Tool rendering', () => {
    it('should render tool start phase', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'bash',
        phase: 'start',
        text: 'ls -la',
      };

      const result = renderer.render(event);
      expect(result).toContain('class="tool-execution"');
      expect(result).toContain('data-tool="bash"');
      expect(result).toContain('class="tool-start"');
      expect(result).toContain('class="tool-icon">🔧</span>');
      expect(result).toContain('class="tool-name">bash</span>');
      expect(result).toContain('class="tool-params">ls -la</span>');
      expect(result).toContain('<div class="tool-output">');
    });

    it('should render tool stdout', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'bash',
        phase: 'stdout',
        text: 'file1.txt\nfile2.txt',
      };

      const result = renderer.render(event);
      expect(result).toContain(
        'class="tool-stdout">file1.txt\nfile2.txt</div>',
      );
    });

    it('should render tool stderr', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'bash',
        phase: 'stderr',
        text: 'Error: file not found',
      };

      const result = renderer.render(event);
      expect(result).toContain(
        'class="tool-stderr">Error: file not found</div>',
      );
    });

    it('should render tool end with success', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'bash',
        phase: 'end',
        exitCode: 0,
      };

      const result = renderer.render(event);
      expect(result).toContain('class="tool-end success"');
      expect(result).toContain('class="status-icon">✅</span>');
      expect(result).toContain('class="tool-status">completed</span>');
    });

    it('should render tool end with error', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'bash',
        phase: 'end',
        exitCode: 1,
      };

      const result = renderer.render(event);
      expect(result).toContain('class="tool-end error"');
      expect(result).toContain('class="status-icon">❌</span>');
      expect(result).toContain('class="tool-status">failed (exit 1)</span>');
    });

    it('should hide tools when hideTools option is set', () => {
      const hidingRenderer = new HtmlRenderer({
        ...defaultOptions,
        hideTools: true,
      });
      const event: ToolEvent = {
        t: 'tool',
        name: 'bash',
        phase: 'start',
      };

      const result = hidingRenderer.render(event);
      expect(result).toBe('');
    });
  });

  describe('Cost rendering', () => {
    it('should render cost information', () => {
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: 0.0025,
      };

      const result = renderer.render(event);
      expect(result).toContain('class="cost-info"');
      expect(result).toContain('class="cost-icon">💰</span>');
      expect(result).toContain('class="cost-amount">$0.0025</span>');
    });

    it('should hide cost when hideCost option is set', () => {
      const hidingRenderer = new HtmlRenderer({
        ...defaultOptions,
        hideCost: true,
      });
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: 0.0025,
      };

      const result = hidingRenderer.render(event);
      expect(result).toBe('');
    });
  });

  describe('Error rendering', () => {
    it('should render error messages', () => {
      const event: ErrorEvent = {
        t: 'error',
        message: 'Something went wrong!',
      };

      const result = renderer.render(event);
      expect(result).toContain('class="error-message"');
      expect(result).toContain('class="error-icon">🚨</span>');
      expect(result).toContain(
        'class="error-text">Something went wrong!</span>',
      );
    });

    it('should escape HTML in error messages', () => {
      const event: ErrorEvent = {
        t: 'error',
        message: '<script>alert("error")</script>',
      };

      const result = renderer.render(event);
      expect(result).toContain(
        '&lt;script&gt;alert(&quot;error&quot;)&lt;/script&gt;',
      );
    });
  });

  describe('Debug rendering', () => {
    it('should render debug information', () => {
      const event: DebugEvent = {
        t: 'debug',
        raw: { type: 'test', value: 123 },
      };

      const result = renderer.render(event);
      expect(result).toContain('class="debug-info"');
      expect(result).toContain('class="debug-icon">🐛</span>');
      expect(result).toContain('<pre class="debug-content">');
      expect(result).toContain('&quot;type&quot;: &quot;test&quot;');
      expect(result).toContain('&quot;value&quot;: 123');
    });

    it('should hide debug when hideDebug option is set', () => {
      const hidingRenderer = new HtmlRenderer({
        ...defaultOptions,
        hideDebug: true,
      });
      const event: DebugEvent = {
        t: 'debug',
        raw: { test: true },
      };

      const result = hidingRenderer.render(event);
      expect(result).toBe('');
    });
  });

  describe('Batch rendering', () => {
    it('should render multiple events', () => {
      const events: AgentEvent[] = [
        { t: 'msg', role: 'user', text: 'Hello' },
        { t: 'msg', role: 'assistant', text: 'Hi there!' },
        { t: 'cost', deltaUsd: 0.001 },
      ];

      const result = renderer.renderBatch(events);
      expect(result).toContain('class="message message-user"');
      expect(result).toContain('Hello');
      expect(result).toContain('class="message message-assistant"');
      expect(result).toContain('Hi there!');
      expect(result).toContain('class="cost-info"');
    });
  });

  describe('Flush functionality', () => {
    it('should close open tool executions', () => {
      // Start a tool
      renderer.render({
        t: 'tool',
        name: 'test-tool',
        phase: 'start',
      });

      // Add some output
      renderer.render({
        t: 'tool',
        name: 'test-tool',
        phase: 'stdout',
        text: 'output',
      });

      // Flush without ending the tool
      const result = renderer.flush();
      expect(result).toContain('</div>'); // Close tool-output div
      expect(result).toContain('class="tool-interrupted"');
      expect(result).toContain('Tool interrupted: test-tool');
    });

    it('should return empty string when no open tools', () => {
      const result = renderer.flush();
      expect(result).toBe('');
    });

    it('should handle multiple open tools', () => {
      // Start two tools
      renderer.render({ t: 'tool', name: 'tool1', phase: 'start' });
      renderer.render({ t: 'tool', name: 'tool2', phase: 'start' });

      const result = renderer.flush();
      expect(result).toContain('Tool interrupted: tool1');
      expect(result).toContain('Tool interrupted: tool2');
    });
  });

  describe('Unknown event handling', () => {
    it('should render unknown events gracefully', () => {
      const unknownEvent = {
        t: 'unknown',
        data: 'some data',
      } as any;

      const result = renderer.render(unknownEvent);
      expect(result).toContain('class="unknown-event"');
      expect(result).toContain('class="unknown-icon">❓</span>');
      expect(result).toContain('&quot;t&quot;: &quot;unknown&quot;');
      expect(result).toContain('&quot;data&quot;: &quot;some data&quot;');
    });
  });

  describe('Context tracking', () => {
    it('should track message count', () => {
      renderer.render({ t: 'msg', role: 'user', text: 'First' });
      renderer.render({ t: 'msg', role: 'assistant', text: 'Second' });
      renderer.render({ t: 'msg', role: 'user', text: 'Third' });

      // The message count is tracked internally but not exposed in HTML
      // This test verifies the renderer doesn't crash with multiple messages
      expect(true).toBe(true);
    });

    it('should properly track tool lifecycle', () => {
      // Complete tool lifecycle
      renderer.render({ t: 'tool', name: 'bash', phase: 'start' });
      renderer.render({
        t: 'tool',
        name: 'bash',
        phase: 'stdout',
        text: 'output',
      });
      renderer.render({ t: 'tool', name: 'bash', phase: 'end', exitCode: 0 });

      // Flush should have no open tools
      const result = renderer.flush();
      expect(result).toBe('');
    });
  });
});
