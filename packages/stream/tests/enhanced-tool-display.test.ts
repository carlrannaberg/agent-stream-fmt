/**
 * Tests for enhanced tool display features
 */

import { describe, expect, it } from 'vitest';
import { AnsiRenderer } from '../src/render/ansi.js';
import { HtmlRenderer } from '../src/render/html.js';
import type { ToolEvent } from '../src/types.js';

describe('Enhanced Tool Display', () => {
  describe('ANSI Renderer', () => {
    it('should display tool parameters for Write tool', () => {
      const renderer = new AnsiRenderer({});
      const event: ToolEvent = {
        t: 'tool',
        name: 'Write',
        phase: 'start',
        text: JSON.stringify(
          { file_path: 'hello.js', content: 'console.log("Hello");' },
          null,
          2,
        ),
      };

      const output = renderer.render(event);
      expect(output).toContain('Write');
      expect(output).toContain('→ hello.js');
      expect(output).not.toContain('content'); // Should not show full JSON
    });

    it('should display tool parameters for Bash tool', () => {
      const renderer = new AnsiRenderer({});
      const event: ToolEvent = {
        t: 'tool',
        name: 'Bash',
        phase: 'start',
        text: JSON.stringify({ command: 'npm test --coverage' }, null, 2),
      };

      const output = renderer.render(event);
      expect(output).toContain('Bash');
      expect(output).toContain('→ npm test --coverage');
    });

    it('should truncate long Bash commands', () => {
      const renderer = new AnsiRenderer({});
      const longCommand = 'echo ' + 'x'.repeat(60);
      const event: ToolEvent = {
        t: 'tool',
        name: 'Bash',
        phase: 'start',
        text: JSON.stringify({ command: longCommand }, null, 2),
      };

      const output = renderer.render(event);
      expect(output).toContain('...');
      expect(output.length).toBeLessThan(150); // Reasonable length
    });

    it('should display tool parameters for Read with limit', () => {
      const renderer = new AnsiRenderer({});
      const event: ToolEvent = {
        t: 'tool',
        name: 'Read',
        phase: 'start',
        text: JSON.stringify({ file_path: 'package.json', limit: 50 }, null, 2),
      };

      const output = renderer.render(event);
      expect(output).toContain('Read');
      expect(output).toContain('→ package.json (50 lines)');
    });

    it('should display tool parameters for Grep', () => {
      const renderer = new AnsiRenderer({});
      const event: ToolEvent = {
        t: 'tool',
        name: 'Grep',
        phase: 'start',
        text: JSON.stringify({ pattern: 'TODO', path: 'src/' }, null, 2),
      };

      const output = renderer.render(event);
      expect(output).toContain('Grep');
      expect(output).toContain('→ "TODO" in src/');
    });

    it('should display completion status with duration', () => {
      const renderer = new AnsiRenderer({});

      // Start event
      renderer.render({
        t: 'tool',
        name: 'Test',
        phase: 'start',
      });

      // Simulate some delay
      const delay = 100;
      const startTime = Date.now();
      while (Date.now() - startTime < delay) {
        // Wait
      }

      // End event
      const output = renderer.render({
        t: 'tool',
        name: 'Test',
        phase: 'end',
        exitCode: 0,
      });

      expect(output).toContain('✅');
      expect(output).toContain('Test');
      expect(output).toContain('completed');
      expect(output).toMatch(/\d+ms/); // Should show duration
    });

    it('should display failure status with exit code', () => {
      const renderer = new AnsiRenderer({});

      // Start event
      renderer.render({
        t: 'tool',
        name: 'FailingTool',
        phase: 'start',
      });

      // End event with failure
      const output = renderer.render({
        t: 'tool',
        name: 'FailingTool',
        phase: 'end',
        exitCode: 1,
      });

      expect(output).toContain('❌');
      expect(output).toContain('FailingTool');
      expect(output).toContain('failed (exit 1)');
    });
  });

  describe('HTML Renderer', () => {
    it('should display tool parameters in HTML', () => {
      const renderer = new HtmlRenderer({});
      const event: ToolEvent = {
        t: 'tool',
        name: 'Write',
        phase: 'start',
        text: JSON.stringify(
          { file_path: 'hello.js', content: 'console.log("Hello");' },
          null,
          2,
        ),
      };

      const output = renderer.render(event);
      expect(output).toContain('class="tool-name">Write</span>');
      expect(output).toContain('class="tool-params">hello.js</span>');
    });

    it('should display duration in HTML end event', () => {
      const renderer = new HtmlRenderer({});

      // Start event
      renderer.render({
        t: 'tool',
        name: 'TestTool',
        phase: 'start',
      });

      // End event
      const output = renderer.render({
        t: 'tool',
        name: 'TestTool',
        phase: 'end',
        exitCode: 0,
      });

      expect(output).toContain('✅');
      expect(output).toContain('class="tool-status">completed</span>');
      expect(output).toContain('class="tool-duration">');
      expect(output).toMatch(/\d+ms/);
    });
  });
});
