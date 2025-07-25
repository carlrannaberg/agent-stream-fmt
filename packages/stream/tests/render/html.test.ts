/**
 * Tests for the HTML renderer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlRenderer } from '../../src/render/html.js';
import type {
  AgentEvent,
  MessageEvent,
  ToolEvent,
  CostEvent,
  ErrorEvent,
  DebugEvent,
} from '../../src/types.js';
import type { RenderOptions } from '../../src/render/types.js';

describe('HtmlRenderer', () => {
  let renderer: HtmlRenderer;
  const defaultOptions: RenderOptions = {
    format: 'html',
    collapseTools: false,
    hideTools: false,
    hideCost: false,
    hideDebug: false,
  };

  beforeEach(() => {
    renderer = new HtmlRenderer(defaultOptions);
  });

  describe('Message Events', () => {
    it('should render user messages with semantic HTML', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: 'Hello, world!',
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="message message-user">');
      expect(output).toContain('<div class="message-header">');
      expect(output).toContain('<span class="role-icon">👤</span>');
      expect(output).toContain('<span class="role-name">user</span>');
      expect(output).toContain(
        '<div class="message-content">Hello, world!</div>',
      );
    });

    it('should render assistant messages with correct structure', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: 'I can help with that.',
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="message message-assistant">');
      expect(output).toContain('<span class="role-icon">🤖</span>');
      expect(output).toContain('<span class="role-name">assistant</span>');
    });

    it('should render system messages with appropriate styling', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'system',
        text: 'System initialized',
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="message message-system">');
      expect(output).toContain('<span class="role-icon">⚙️</span>');
    });

    it('should escape HTML entities to prevent XSS', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: '<script>alert("xss")</script> & <img src=x onerror="alert(\'xss\')">',
      };

      const output = renderer.render(event);

      expect(output).toContain(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
      expect(output).toContain('&amp;');
      expect(output).not.toContain('<script>');
      // The escaped version will contain "onerror=" as part of the escaped text content
      expect(output).toContain('onerror=&quot;');
    });

    it('should handle markdown-like formatting after escaping', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: 'This is **bold** and *italic* and `code` with <dangerous>',
      };

      const output = renderer.render(event);

      expect(output).toContain('<strong>bold</strong>');
      expect(output).toContain('<em>italic</em>');
      expect(output).toContain('<code>code</code>');
      expect(output).toContain('&lt;dangerous&gt;');
    });

    it('should convert newlines to <br> tags', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: 'Line 1\nLine 2\nLine 3',
      };

      const output = renderer.render(event);

      expect(output).toContain('Line 1<br>Line 2<br>Line 3');
    });

    it('should handle empty text gracefully', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: '',
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="message-content"></div>');
    });
  });

  describe('Tool Events', () => {
    it('should render tool start phase with proper structure', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'npm',
        phase: 'start',
        text: 'install',
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="tool-execution" data-tool="npm">');
      expect(output).toContain('<div class="tool-start">');
      expect(output).toContain('<span class="tool-icon">🔧</span>');
      expect(output).toContain('<span class="tool-name">npm</span>');
      expect(output).toContain('<span class="tool-params">install</span>');
      expect(output).toContain('<div class="tool-output">');
    });

    it('should render tool stdout with proper escaping', () => {
      // First render start
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      const event: ToolEvent = {
        t: 'tool',
        name: 'npm',
        phase: 'stdout',
        text: 'Installing <package>...',
      };

      const output = renderer.render(event);

      expect(output).toContain(
        '<div class="tool-stdout">Installing &lt;package&gt;...</div>',
      );
    });

    it('should render tool stderr with different class', () => {
      // First render start
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      const event: ToolEvent = {
        t: 'tool',
        name: 'npm',
        phase: 'stderr',
        text: 'Warning: deprecated package',
      };

      const output = renderer.render(event);

      expect(output).toContain(
        '<div class="tool-stderr">Warning: deprecated package</div>',
      );
    });

    it('should render tool end with success status', () => {
      // First render start
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      const event: ToolEvent = {
        t: 'tool',
        name: 'npm',
        phase: 'end',
        exitCode: 0,
      };

      const output = renderer.render(event);

      expect(output).toContain('</div>'); // Close tool-output
      expect(output).toContain('<div class="tool-end success">');
      expect(output).toContain('<span class="status-icon">✅</span>');
      expect(output).toContain('<span class="tool-status">completed</span>');
      expect(output).toContain('</div>'); // Close tool-execution
    });

    it('should render tool end with error status', () => {
      // First render start
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      const event: ToolEvent = {
        t: 'tool',
        name: 'npm',
        phase: 'end',
        exitCode: 1,
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="tool-end error">');
      expect(output).toContain('<span class="status-icon">❌</span>');
      expect(output).toContain(
        '<span class="tool-status">failed (exit 1)</span>',
      );
    });

    it('should track tool state across phases', () => {
      const hiddenRenderer = new HtmlRenderer({
        ...defaultOptions,
        collapseTools: true,
      });

      // Start tool
      hiddenRenderer.render({
        t: 'tool',
        name: 'test-tool',
        phase: 'start',
      });

      // Add output
      hiddenRenderer.render({
        t: 'tool',
        name: 'test-tool',
        phase: 'stdout',
        text: 'Output line 1',
      });

      hiddenRenderer.render({
        t: 'tool',
        name: 'test-tool',
        phase: 'stdout',
        text: 'Output line 2',
      });

      // Tool state should be tracked even though collapse is enabled
      const endOutput = hiddenRenderer.render({
        t: 'tool',
        name: 'test-tool',
        phase: 'end',
        exitCode: 0,
      });

      expect(endOutput).toContain('test-tool');
    });

    it('should hide tools when option is set', () => {
      const hiddenRenderer = new HtmlRenderer({
        ...defaultOptions,
        hideTools: true,
      });

      const output = hiddenRenderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      expect(output).toBe('');
    });

    it('should escape tool names to prevent injection', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: '<script>alert("xss")</script>',
        phase: 'start',
      };

      const output = renderer.render(event);

      expect(output).toContain(
        'data-tool="&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"',
      );
      expect(output).not.toContain('<script>');
    });
  });

  describe('Cost Events', () => {
    it('should render cost information with proper formatting', () => {
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: 0.0234,
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="cost-info">');
      expect(output).toContain('<span class="cost-icon">💰</span>');
      expect(output).toContain('<span class="cost-amount">$0.0234</span>');
    });

    it('should format small costs correctly', () => {
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: 0.000123,
      };

      const output = renderer.render(event);

      expect(output).toContain('$0.0001');
    });

    it('should hide cost when option is set', () => {
      const hiddenRenderer = new HtmlRenderer({
        ...defaultOptions,
        hideCost: true,
      });

      const output = hiddenRenderer.render({
        t: 'cost',
        deltaUsd: 0.0234,
      });

      expect(output).toBe('');
    });
  });

  describe('Error Events', () => {
    it('should render errors with appropriate structure', () => {
      const event: ErrorEvent = {
        t: 'error',
        message: 'Something went wrong!',
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="error-message">');
      expect(output).toContain('<span class="error-icon">🚨</span>');
      expect(output).toContain(
        '<span class="error-text">Something went wrong!</span>',
      );
    });

    it('should escape error messages', () => {
      const event: ErrorEvent = {
        t: 'error',
        message: 'Error: <script>alert("xss")</script>',
      };

      const output = renderer.render(event);

      expect(output).toContain(
        'Error: &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
      expect(output).not.toContain('<script>');
    });
  });

  describe('Debug Events', () => {
    it('should render debug information in pre-formatted block', () => {
      const event: DebugEvent = {
        t: 'debug',
        raw: { key: 'value', nested: { data: 123 } },
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="debug-info">');
      expect(output).toContain('<span class="debug-icon">🐛</span>');
      expect(output).toContain('<pre class="debug-content">');
      expect(output).toContain('&quot;key&quot;: &quot;value&quot;');
      expect(output).toContain('&quot;data&quot;: 123');
    });

    it('should escape debug content', () => {
      const event: DebugEvent = {
        t: 'debug',
        raw: { html: '<script>alert("xss")</script>' },
      };

      const output = renderer.render(event);

      expect(output).toContain(
        '&quot;html&quot;: &quot;&lt;script&gt;alert(\\&quot;xss\\&quot;)&lt;/script&gt;&quot;',
      );
      expect(output).not.toContain('<script>');
    });

    it('should hide debug when option is set', () => {
      const hiddenRenderer = new HtmlRenderer({
        ...defaultOptions,
        hideDebug: true,
      });

      const output = hiddenRenderer.render({
        t: 'debug',
        raw: { test: true },
      });

      expect(output).toBe('');
    });

    it('should handle circular references in debug data', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      const event: DebugEvent = {
        t: 'debug',
        raw: circular,
      };

      // Should not throw
      expect(() => renderer.render(event)).not.toThrow();
    });
  });

  describe('Unknown Events', () => {
    it('should render unknown event types gracefully', () => {
      const event: any = {
        t: 'future-event-type',
        data: 'some data',
      };

      const output = renderer.render(event);

      expect(output).toContain('<div class="unknown-event">');
      expect(output).toContain('<span class="unknown-icon">❓</span>');
      expect(output).toContain('<pre class="unknown-content">');
      expect(output).toContain('&quot;t&quot;: &quot;future-event-type&quot;');
    });
  });

  describe('Batch Rendering', () => {
    it('should render multiple events in batch', () => {
      const events: AgentEvent[] = [
        { t: 'msg', role: 'user', text: 'Hello' },
        { t: 'msg', role: 'assistant', text: 'Hi there!' },
        { t: 'cost', deltaUsd: 0.001 },
      ];

      const output = renderer.renderBatch(events);

      expect(output).toContain('message-user');
      expect(output).toContain('message-assistant');
      expect(output).toContain('cost-info');
    });
  });

  describe('Flush', () => {
    it('should return empty string when no pending tools', () => {
      const output = renderer.flush();
      expect(output).toBe('');
    });

    it('should close open tool executions', () => {
      // Start a tool but don't end it
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      const output = renderer.flush();

      expect(output).toContain('</div>'); // Close tool-output
      expect(output).toContain('<div class="tool-interrupted">');
      expect(output).toContain('<span class="interrupted-icon">⚠️</span>');
      expect(output).toContain('Tool interrupted: npm');
      expect(output).toContain('</div>'); // Close tool-execution
    });

    it('should handle multiple open tools', () => {
      // Start multiple tools
      renderer.render({ t: 'tool', name: 'npm', phase: 'start' });
      renderer.render({ t: 'tool', name: 'git', phase: 'start' });

      const output = renderer.flush();

      expect(output).toContain('Tool interrupted: npm');
      expect(output).toContain('Tool interrupted: git');
    });

    it('should clear tool stack after flush', () => {
      renderer.render({ t: 'tool', name: 'npm', phase: 'start' });

      renderer.flush();

      // Second flush should return empty
      const secondFlush = renderer.flush();
      expect(secondFlush).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing text fields gracefully', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: undefined as any,
      };

      // Should not throw
      expect(() => renderer.render(event)).not.toThrow();
    });

    it('should handle very long text without issues', () => {
      const longText = 'a'.repeat(10000);
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: longText,
      };

      const output = renderer.render(event);
      expect(output).toContain('a'.repeat(100)); // Check partial content
    });

    it('should handle complex nested markdown-like formatting', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: '**Bold with *nested italic* and `code`** plus regular text',
      };

      const output = renderer.render(event);

      expect(output).toContain(
        '<strong>Bold with <em>nested italic</em> and <code>code</code></strong>',
      );
    });

    it('should handle special characters in tool names', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'tool-with-special-chars!@#$%',
        phase: 'start',
      };

      const output = renderer.render(event);

      expect(output).toContain('data-tool="tool-with-special-chars!@#$%"');
    });
  });

  describe('Security', () => {
    it('should prevent all common XSS vectors', () => {
      const xssVectors = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)">',
        '<object data="javascript:alert(1)">',
        '<embed src="javascript:alert(1)">',
        '<script>alert(1)</script>',
        '<style>body{background:url("javascript:alert(1)")}</style>',
        '"><script>alert(1)</script>',
        "' onmouseover='alert(1)",
      ];

      xssVectors.forEach(vector => {
        const event: MessageEvent = {
          t: 'msg',
          role: 'user',
          text: vector,
        };

        const output = renderer.render(event);

        // None of these dangerous patterns should appear as actual HTML elements
        expect(output).not.toContain('<img');
        expect(output).not.toContain('<svg');
        expect(output).not.toContain('<iframe');
        expect(output).not.toContain('<object');
        expect(output).not.toContain('<embed');
        expect(output).not.toContain('<script');
        expect(output).not.toContain('<style');

        // For vectors with HTML tags, they should be escaped
        if (vector.includes('<') || vector.includes('>')) {
          expect(output).toContain('&lt;'); // Shows escaping is working
        }
        // The dangerous patterns should not appear as actual HTML
        expect(output).toContain('<div class="message-content">');
      });
    });

    it('should escape HTML attributes properly', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: '" onmouseover="alert(1)" data-evil="',
        phase: 'start',
      };

      const output = renderer.render(event);

      // Should escape quotes in attributes
      expect(output).toContain('data-tool=');
      // The attribute content should be escaped
      expect(output).toContain('&quot; onmouseover=&quot;');
      expect(output).toContain('data-evil=&quot;');
    });

    it('should handle HTML entity attacks', () => {
      const entities = [
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '&#60;script&#62;alert(1)&#60;/script&#62;',
        '&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;',
      ];

      entities.forEach(entity => {
        const event: MessageEvent = {
          t: 'msg',
          role: 'user',
          text: entity,
        };

        const output = renderer.render(event);

        // Should double-escape entities
        expect(output).toContain('&amp;');
        expect(output).not.toContain('<script>');
      });
    });

    it('should handle unicode and emoji correctly', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: 'Unicode: 你好 🌍 𝔘𝔫𝔦𝔠𝔬𝔡𝔢',
      };

      const output = renderer.render(event);

      expect(output).toContain('Unicode: 你好 🌍 𝔘𝔫𝔦𝔠𝔬𝔡𝔢');
    });
  });

  describe('Complex HTML Generation', () => {
    it('should generate well-formed HTML for nested structures', () => {
      // Start multiple tools
      renderer.render({ t: 'tool', name: 'outer', phase: 'start' });
      renderer.render({ t: 'tool', name: 'inner', phase: 'start' });

      // Add content
      renderer.render({
        t: 'tool',
        name: 'outer',
        phase: 'stdout',
        text: 'Outer output',
      });
      renderer.render({
        t: 'tool',
        name: 'inner',
        phase: 'stdout',
        text: 'Inner output',
      });

      // End in correct order
      renderer.render({ t: 'tool', name: 'inner', phase: 'end', exitCode: 0 });
      renderer.render({ t: 'tool', name: 'outer', phase: 'end', exitCode: 0 });

      const flushed = renderer.flush();

      // Should have no unclosed tags
      expect(flushed).toBe('');
    });

    it('should handle very large debug objects', () => {
      const largeObject: any = {};
      for (let i = 0; i < 10; i++) {
        largeObject[`key${i}`] = {
          nested: {
            value: `data${i}`,
            array: [1, 2, 3, 4, 5],
          },
        };
      }

      const event: DebugEvent = {
        t: 'debug',
        raw: largeObject,
      };

      const output = renderer.render(event);

      expect(output).toContain('<pre class="debug-content">');
      expect(output).toContain('key0');
      expect(output).toContain('key9');
    });
  });

  describe('Edge Cases with Missing Data', () => {
    it('should handle all fields being undefined', () => {
      const undefinedEvent: any = {
        t: 'msg',
        role: undefined,
        text: undefined,
      };

      expect(() => renderer.render(undefinedEvent)).not.toThrow();
    });

    it('should handle null values in all event types', () => {
      const nullEvents: any[] = [
        { t: 'msg', role: null, text: null },
        { t: 'tool', name: null, phase: null, text: null },
        { t: 'cost', deltaUsd: null },
        { t: 'error', message: null },
        { t: 'debug', raw: null },
      ];

      nullEvents.forEach(event => {
        expect(() => renderer.render(event)).not.toThrow();
      });
    });

    it('should handle NaN and Infinity in cost events', () => {
      const nanEvent: CostEvent = {
        t: 'cost',
        deltaUsd: NaN,
      };

      const infinityEvent: CostEvent = {
        t: 'cost',
        deltaUsd: Infinity,
      };

      expect(() => renderer.render(nanEvent)).not.toThrow();
      expect(() => renderer.render(infinityEvent)).not.toThrow();
    });
  });

  describe('Tool Lifecycle Edge Cases', () => {
    it('should handle tool events out of order', () => {
      // End before start
      renderer.render({ t: 'tool', name: 'test1', phase: 'end', exitCode: 0 });

      // Output before start
      renderer.render({
        t: 'tool',
        name: 'test2',
        phase: 'stdout',
        text: 'orphan output',
      });

      // Start after output
      renderer.render({ t: 'tool', name: 'test2', phase: 'start' });

      // Multiple starts
      renderer.render({ t: 'tool', name: 'test3', phase: 'start' });
      renderer.render({ t: 'tool', name: 'test3', phase: 'start' });

      // Should handle gracefully
      const flush = renderer.flush();
      expect(flush).toContain('test3');
    });

    it('should handle deeply nested tool output', () => {
      renderer.render({ t: 'tool', name: 'parent', phase: 'start' });

      // Create deeply nested structure in output
      const deeplyNested = '  '.repeat(50) + 'Deeply nested content';
      renderer.render({
        t: 'tool',
        name: 'parent',
        phase: 'stdout',
        text: deeplyNested,
      });

      renderer.render({ t: 'tool', name: 'parent', phase: 'end', exitCode: 0 });

      // Should preserve structure
      expect(renderer.flush()).toBe('');
    });
  });

  describe('Integration with Real Fixtures', () => {
    it('should handle complex mixed event sequences', () => {
      const complexSequence: AgentEvent[] = [
        { t: 'msg', role: 'user', text: 'Start a complex task' },
        {
          t: 'msg',
          role: 'assistant',
          text: "I'll help you with that. Let me run some tools.",
        },
        { t: 'tool', name: 'analyze', phase: 'start', text: 'data.json' },
        {
          t: 'tool',
          name: 'analyze',
          phase: 'stdout',
          text: 'Analyzing file...',
        },
        {
          t: 'tool',
          name: 'process',
          phase: 'start',
          text: '--input data.json',
        },
        {
          t: 'tool',
          name: 'analyze',
          phase: 'stdout',
          text: 'Found 1000 records',
        },
        {
          t: 'tool',
          name: 'process',
          phase: 'stdout',
          text: 'Processing records...',
        },
        { t: 'cost', deltaUsd: 0.0012 },
        { t: 'tool', name: 'analyze', phase: 'end', exitCode: 0 },
        { t: 'error', message: 'Warning: Some records skipped' },
        {
          t: 'tool',
          name: 'process',
          phase: 'stderr',
          text: 'Skipped 5 invalid records',
        },
        { t: 'tool', name: 'process', phase: 'end', exitCode: 0 },
        {
          t: 'msg',
          role: 'assistant',
          text: 'Task completed with minor warnings.',
        },
        { t: 'debug', raw: { processed: 995, skipped: 5, total: 1000 } },
        { t: 'cost', deltaUsd: 0.0008 },
      ];

      complexSequence.forEach(event => {
        const output = renderer.render(event);
        expect(output).toBeTruthy();

        // Check for well-formed HTML
        const openTags = (output.match(/<[^/][^>]*>/g) || []).length;
        const closeTags = (output.match(/<\/[^>]+>/g) || []).length;

        // Most tags should be balanced (some are self-contained)
        expect(Math.abs(openTags - closeTags)).toBeLessThanOrEqual(2);
      });

      expect(renderer.flush()).toBe('');
    });
  });
});
