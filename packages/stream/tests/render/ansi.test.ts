/**
 * Tests for the ANSI renderer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnsiRenderer } from '../../src/render/ansi.js';
import type {
  AgentEvent,
  MessageEvent,
  ToolEvent,
  CostEvent,
  ErrorEvent,
  DebugEvent,
} from '../../src/types.js';
import type { RenderOptions } from '../../src/render/types.js';

// Helper to strip ANSI codes for testing
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

describe('AnsiRenderer', () => {
  let renderer: AnsiRenderer;
  const defaultOptions: RenderOptions = {
    format: 'ansi',
    collapseTools: false,
    hideTools: false,
    hideCost: false,
    hideDebug: false,
  };

  beforeEach(() => {
    renderer = new AnsiRenderer(defaultOptions);
  });

  describe('Message Events', () => {
    it('should render user messages with correct icon and color', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: 'Hello, world!',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('👤 user:');
      expect(stripped).toContain('  Hello, world!');
      expect(output).toContain('\u001b['); // Has ANSI codes
    });

    it('should render assistant messages with correct icon and color', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: 'I can help with that.',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('🤖 assistant:');
      expect(stripped).toContain('  I can help with that.');
    });

    it('should render system messages with correct icon and color', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'system',
        text: 'System initialized',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('⚙️ system:');
      expect(stripped).toContain('  System initialized');
    });

    it('should format markdown-like content', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: 'This is **bold** and *italic* and `code`',
      };

      const output = renderer.render(event);

      // Check that formatting codes are applied
      expect(output).toContain('\u001b[1m'); // Bold
      expect(output).toContain('\u001b[3m'); // Italic
      expect(output).toContain('\u001b[33m'); // Yellow for code
    });

    it('should handle multi-line messages', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: 'Line 1\nLine 2\nLine 3',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('  Line 1\n  Line 2\n  Line 3');
    });
  });

  describe('Tool Events', () => {
    it('should render tool start phase', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'npm',
        phase: 'start',
        text: 'install',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('🔧 npm');
    });

    it('should render tool stdout', () => {
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
        text: 'Installing dependencies...',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('  │ Installing dependencies...');
    });

    it('should render tool stderr differently', () => {
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
        text: 'Warning: peer dependency',
      };

      const output = renderer.render(event);

      // Should have red color for stderr
      expect(output).toContain('\u001b[31m'); // Red
      expect(stripAnsi(output)).toContain('  │ Warning: peer dependency');
    });

    it('should render tool end with success', () => {
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
      const stripped = stripAnsi(output);

      expect(stripped).toContain('✅ npm');
      expect(stripped).toMatch(/\d+ms/); // Duration
    });

    it('should render tool end with failure', () => {
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
      const stripped = stripAnsi(output);

      expect(stripped).toContain('❌ npm');
    });

    it('should collapse tool output when option is set', () => {
      const collapsedRenderer = new AnsiRenderer({
        ...defaultOptions,
        collapseTools: true,
      });

      // Start tool
      collapsedRenderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      // Output should be stored, not rendered
      const stdoutOutput = collapsedRenderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'stdout',
        text: 'Line 1\nLine 2\nLine 3',
      });

      expect(stdoutOutput).toBe('');

      // End should show summary
      const endOutput = collapsedRenderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'end',
        exitCode: 0,
      });

      const stripped = stripAnsi(endOutput);
      expect(stripped).toContain('└─');
      expect(stripped).toContain('Line 1');
    });

    it('should hide tools when option is set', () => {
      const hiddenRenderer = new AnsiRenderer({
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
  });

  describe('Cost Events', () => {
    it('should render cost information', () => {
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: 0.0234,
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('💰 $0.0234');
    });

    it('should hide cost when option is set', () => {
      const hiddenRenderer = new AnsiRenderer({
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
    it('should render errors with bold red text', () => {
      const event: ErrorEvent = {
        t: 'error',
        message: 'Something went wrong!',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('🚨 Something went wrong!');
      expect(output).toContain('\u001b[1m'); // Bold
      expect(output).toContain('\u001b[31m'); // Red
    });
  });

  describe('Debug Events', () => {
    it('should render debug information', () => {
      const event: DebugEvent = {
        t: 'debug',
        raw: { key: 'value', nested: { data: 123 } },
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('🐛');
      expect(stripped).toContain('"key": "value"');
      expect(stripped).toContain('"data": 123');
    });

    it('should hide debug when option is set', () => {
      const hiddenRenderer = new AnsiRenderer({
        ...defaultOptions,
        hideDebug: true,
      });

      const output = hiddenRenderer.render({
        t: 'debug',
        raw: { test: true },
      });

      expect(output).toBe('');
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
      const stripped = stripAnsi(output);

      expect(stripped).toContain('👤 user:');
      expect(stripped).toContain('🤖 assistant:');
      expect(stripped).toContain('💰 $0.0010');
    });
  });

  describe('Flush', () => {
    it('should return empty string when no pending tools', () => {
      const output = renderer.flush();
      expect(output).toBe('');
    });

    it('should warn about pending tools', () => {
      // Start a tool but don't end it
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'start',
      });

      const output = renderer.flush();
      const stripped = stripAnsi(output);

      expect(stripped).toContain('⚠️  Tool still running: npm');
    });
  });

  describe('Color Disabled', () => {
    it('should not include ANSI codes when colors are disabled', () => {
      const noColorRenderer = new AnsiRenderer({
        ...defaultOptions,
        colorDisabled: true,
      });

      const output = noColorRenderer.render({
        t: 'msg',
        role: 'user',
        text: 'Hello',
      });

      // Should not contain any ANSI escape codes
      expect(output).not.toContain('\u001b[');
      expect(output).toContain('👤 user:');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages gracefully', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: '',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('👤 user:');
      expect(stripped).toContain('  '); // Empty content with indent
    });

    it('should handle missing tool name gracefully', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: '',
        phase: 'start',
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('🔧');
    });

    it('should handle very long tool output lines', () => {
      renderer.render({ t: 'tool', name: 'test', phase: 'start' });

      const longLine = 'a'.repeat(1000);
      const event: ToolEvent = {
        t: 'tool',
        name: 'test',
        phase: 'stdout',
        text: longLine,
      };

      const output = renderer.render(event);
      expect(output).toContain(longLine);
    });

    it('should handle tool output with special characters', () => {
      renderer.render({ t: 'tool', name: 'test', phase: 'start' });

      const event: ToolEvent = {
        t: 'tool',
        name: 'test',
        phase: 'stdout',
        text: 'Special chars: \t\n\r\b\f',
      };

      const output = renderer.render(event);
      expect(output).toBeTruthy();
    });

    it('should handle undefined text in tool events', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'test',
        phase: 'stdout',
        text: undefined,
      };

      // Should not throw
      expect(() => renderer.render(event)).not.toThrow();
    });

    it('should handle messages with only whitespace', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: '   \n\t   ',
      };

      const output = renderer.render(event);
      expect(output).toContain('🤖 assistant:');
    });

    it('should handle rapid tool state changes', () => {
      // Start multiple tools
      renderer.render({ t: 'tool', name: 'tool1', phase: 'start' });
      renderer.render({ t: 'tool', name: 'tool2', phase: 'start' });

      // End them out of order
      renderer.render({ t: 'tool', name: 'tool2', phase: 'end', exitCode: 0 });
      renderer.render({ t: 'tool', name: 'tool1', phase: 'end', exitCode: 0 });

      // Should handle gracefully
      const flush = renderer.flush();
      expect(flush).toBe('');
    });

    it('should handle missing exitCode in tool end', () => {
      renderer.render({ t: 'tool', name: 'test', phase: 'start' });

      const event: ToolEvent = {
        t: 'tool',
        name: 'test',
        phase: 'end',
        // No exitCode
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      // Should still show completion
      expect(stripped).toMatch(/test.*\d+ms/);
    });
  });

  describe('Complex Formatting', () => {
    it('should handle nested markdown-like formatting', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: '**Bold with *nested italic* text** and `inline code`',
      };

      const output = renderer.render(event);

      // Should have multiple formatting codes
      // eslint-disable-next-line no-control-regex
      const formatCodes = output.match(/\u001b\[\d+m/g);
      expect(formatCodes).toBeTruthy();
      expect(formatCodes!.length).toBeGreaterThan(4);
    });

    it('should handle code blocks', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: '```\nfunction hello() {\n  console.log("world");\n}\n```',
      };

      const output = renderer.render(event);
      expect(output).toContain('function hello()');
      expect(output).toContain('\u001b[2m'); // Dim for code blocks
    });

    it('should handle mixed formatting in tool output', () => {
      renderer.render({ t: 'tool', name: 'test', phase: 'start' });

      const event: ToolEvent = {
        t: 'tool',
        name: 'test',
        phase: 'stdout',
        text: 'Output with **bold** and `code`',
      };

      const output = renderer.render(event);

      // Tool output should not have markdown formatting applied
      expect(output).toContain('**bold**');
      expect(output).toContain('`code`');
    });
  });

  describe('Tool Context Tracking', () => {
    it('should track multiple concurrent tools', () => {
      // Start 5 tools
      for (let i = 0; i < 5; i++) {
        renderer.render({ t: 'tool', name: `tool${i}`, phase: 'start' });
      }

      // Add output to each
      for (let i = 0; i < 5; i++) {
        renderer.render({
          t: 'tool',
          name: `tool${i}`,
          phase: 'stdout',
          text: `Output from tool ${i}`,
        });
      }

      // End them all
      for (let i = 0; i < 5; i++) {
        const output = renderer.render({
          t: 'tool',
          name: `tool${i}`,
          phase: 'end',
          exitCode: 0,
        });

        expect(output).toContain('✅');
        expect(output).toContain(`tool${i}`);
      }

      // No tools should be pending
      expect(renderer.flush()).toBe('');
    });

    it('should handle tool output before tool start gracefully', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'unknown-tool',
        phase: 'stdout',
        text: 'Output without start',
      };

      // Should not throw
      expect(() => renderer.render(event)).not.toThrow();
    });

    it('should handle tool end without start gracefully', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'unknown-tool',
        phase: 'end',
        exitCode: 0,
      };

      // Should not throw
      expect(() => renderer.render(event)).not.toThrow();
    });
  });

  describe('Unknown Event Types', () => {
    it('should handle unknown event types gracefully', () => {
      const unknownEvent: any = {
        t: 'future-event-type',
        data: 'some data',
      };

      const output = renderer.render(unknownEvent);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('❓ Unknown event type:');
      expect(stripped).toContain('future-event-type');
    });
  });

  describe('Cost Formatting', () => {
    it('should format very small costs correctly', () => {
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: 0.000001,
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('$0.0000');
    });

    it('should format large costs correctly', () => {
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: 123.456789,
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('$123.4568');
    });

    it('should handle negative costs', () => {
      const event: CostEvent = {
        t: 'cost',
        deltaUsd: -0.5,
      };

      const output = renderer.render(event);
      const stripped = stripAnsi(output);

      expect(stripped).toContain('-$0.5000');
    });
  });

  describe('Integration with Real Fixtures', () => {
    it('should handle real Claude fixture data', () => {
      // Simulate events from Claude fixture
      const events: AgentEvent[] = [
        {
          t: 'msg',
          role: 'user',
          text: 'Can you help me write a Python function?',
        },
        {
          t: 'msg',
          role: 'assistant',
          text: "I'd be happy to help! What kind of function do you need?",
        },
        { t: 'tool', name: 'python', phase: 'start', text: 'def example():' },
        {
          t: 'tool',
          name: 'python',
          phase: 'stdout',
          text: 'Function created successfully',
        },
        { t: 'tool', name: 'python', phase: 'end', exitCode: 0 },
        { t: 'cost', deltaUsd: 0.0023 },
      ];

      events.forEach(event => {
        const output = renderer.render(event);
        expect(output).toBeTruthy();
      });

      // Should have no pending operations
      expect(renderer.flush()).toBe('');
    });
  });

  describe('Advanced Edge Cases', () => {
    it('should handle null and undefined values gracefully', () => {
      // Test with null text
      const nullEvent: any = {
        t: 'msg',
        role: 'user',
        text: null,
      };
      expect(() => renderer.render(nullEvent)).not.toThrow();

      // Test with undefined role
      const undefinedRoleEvent: any = {
        t: 'msg',
        role: undefined,
        text: 'Test message',
      };
      expect(() => renderer.render(undefinedRoleEvent)).not.toThrow();
    });

    it('should handle circular references in debug events', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;

      const event: DebugEvent = {
        t: 'debug',
        raw: circular,
      };

      expect(() => renderer.render(event)).not.toThrow();
      const output = renderer.render(event);
      expect(output).toContain('🐛');
    });

    it('should handle extremely long single-line text', () => {
      const longText = 'x'.repeat(50000);
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: longText,
      };

      const output = renderer.render(event);
      expect(output).toContain('x'.repeat(100)); // Check partial content
      expect(output.length).toBeGreaterThan(49000); // Most content preserved
    });

    it('should handle control characters in text', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: 'Text with \x00null\x01 and \x1bescape\x08 chars',
      };

      expect(() => renderer.render(event)).not.toThrow();
    });

    it('should handle malformed markdown gracefully', () => {
      const event: MessageEvent = {
        t: 'msg',
        role: 'assistant',
        text: '**Unclosed bold and *mixed formatting` with backticks',
      };

      const output = renderer.render(event);
      expect(output).toBeTruthy();
      expect(output).toContain('🤖');
    });
  });

  describe('Complex Tool Scenarios', () => {
    it('should handle interleaved tool executions', () => {
      // Start tool 1
      renderer.render({ t: 'tool', name: 'npm', phase: 'start' });
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'stdout',
        text: 'npm output 1',
      });

      // Start tool 2 before tool 1 ends
      renderer.render({ t: 'tool', name: 'git', phase: 'start' });
      renderer.render({
        t: 'tool',
        name: 'git',
        phase: 'stdout',
        text: 'git output',
      });

      // More output from tool 1
      renderer.render({
        t: 'tool',
        name: 'npm',
        phase: 'stdout',
        text: 'npm output 2',
      });

      // End tools in reverse order
      renderer.render({ t: 'tool', name: 'git', phase: 'end', exitCode: 0 });
      renderer.render({ t: 'tool', name: 'npm', phase: 'end', exitCode: 1 });

      expect(renderer.flush()).toBe('');
    });

    it('should handle tools with very long output in collapsed mode', () => {
      const collapsedRenderer = new AnsiRenderer({
        ...defaultOptions,
        collapseTools: true,
      });

      collapsedRenderer.render({ t: 'tool', name: 'build', phase: 'start' });

      // Generate 10 lines of output
      for (let i = 0; i < 10; i++) {
        collapsedRenderer.render({
          t: 'tool',
          name: 'build',
          phase: 'stdout',
          text: `Build output line ${i}: Processing files and dependencies...`,
        });
      }

      const endOutput = collapsedRenderer.render({
        t: 'tool',
        name: 'build',
        phase: 'end',
        exitCode: 0,
      });

      const stripped = stripAnsi(endOutput);
      expect(stripped).toContain('✅ build');
      expect(stripped).toContain('(10 lines)');
    });

    it('should handle tool errors with stderr', () => {
      renderer.render({ t: 'tool', name: 'test', phase: 'start' });

      // Mix stdout and stderr
      renderer.render({
        t: 'tool',
        name: 'test',
        phase: 'stdout',
        text: 'Normal output',
      });
      renderer.render({
        t: 'tool',
        name: 'test',
        phase: 'stderr',
        text: 'Error: Command failed',
      });
      renderer.render({
        t: 'tool',
        name: 'test',
        phase: 'stderr',
        text: 'Stack trace follows...',
      });

      const endOutput = renderer.render({
        t: 'tool',
        name: 'test',
        phase: 'end',
        exitCode: 1,
      });

      expect(endOutput).toContain('❌');
    });
  });

  describe('ANSI Code Injection Prevention', () => {
    it('should not allow ANSI code injection through user text', () => {
      const maliciousText = 'Normal text \x1b[31mRED\x1b[0m more text';
      const event: MessageEvent = {
        t: 'msg',
        role: 'user',
        text: maliciousText,
      };

      const output = renderer.render(event);

      // The literal escape sequence should be rendered, not interpreted
      expect(output).toContain('\\x1b[31m');
    });

    it('should sanitize tool names that contain ANSI codes', () => {
      const event: ToolEvent = {
        t: 'tool',
        name: 'tool\x1b[31mRED',
        phase: 'start',
      };

      const output = renderer.render(event);
      expect(output).toContain('tool\\x1b[31mRED');
    });
  });

  describe('State Recovery', () => {
    it('should recover from inconsistent tool states', () => {
      // End a tool that was never started
      renderer.render({
        t: 'tool',
        name: 'phantom',
        phase: 'end',
        exitCode: 0,
      });

      // Output for a tool that was never started
      renderer.render({
        t: 'tool',
        name: 'ghost',
        phase: 'stdout',
        text: 'Output',
      });

      // Start a tool twice
      renderer.render({ t: 'tool', name: 'duplicate', phase: 'start' });
      renderer.render({ t: 'tool', name: 'duplicate', phase: 'start' });

      // Should still function normally
      renderer.render({ t: 'msg', role: 'user', text: 'Normal message' });

      // Cleanup should work
      renderer.render({
        t: 'tool',
        name: 'duplicate',
        phase: 'end',
        exitCode: 0,
      });

      expect(renderer.flush()).toBe('');
    });
  });
});
