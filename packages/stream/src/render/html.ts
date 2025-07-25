/**
 * HTML renderer implementation for AgentEvents
 *
 * This module provides HTML rendering functionality for agent events,
 * generating semantic HTML with appropriate CSS classes for styling.
 * All user content is properly escaped to prevent XSS attacks.
 */

import type { AgentEvent } from '../types.js';
import type { Renderer, RenderContext, RenderOptions } from './types.js';

/**
 * HTML renderer that converts AgentEvents to semantic HTML
 *
 * Generates well-structured HTML with semantic elements and CSS classes
 * for easy styling. All user content is properly escaped to prevent XSS.
 *
 * Features:
 * - Proper HTML escaping for all user content
 * - Semantic structure with CSS classes
 * - Message rendering with role-based styling
 * - Tool execution tracking with phases
 * - Cost and error formatting
 * - Debug information in pre-formatted blocks
 *
 * @example
 * ```typescript
 * // Create standalone HTML document
 * const renderer = new HtmlRenderer({
 *   standalone: true,
 *   theme: 'light',
 *   title: 'AI Agent Session'
 * });
 *
 * // Render to HTML fragments
 * const parts = [];
 * parts.push(renderer.start());
 * for (const event of events) {
 *   const html = renderer.render(event);
 *   if (html) parts.push(html);
 * }
 * parts.push(renderer.end());
 *
 * const document = parts.join('');
 * ```
 *
 * @category Renderers
 * @since 0.1.0
 */
export class HtmlRenderer implements Renderer {
  private context: RenderContext;

  constructor(private options: RenderOptions) {
    this.context = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now(),
    };
  }

  /**
   * Render a single event to HTML
   */
  render(event: AgentEvent): string {
    this.context.previousEvent = event;

    switch (event.t) {
      case 'msg':
        return this.renderMessage(event);
      case 'tool':
        return this.renderTool(event);
      case 'cost':
        return this.renderCost(event);
      case 'error':
        return this.renderError(event);
      case 'debug':
        return this.renderDebug(event);
      default:
        return this.renderUnknown(event);
    }
  }

  /**
   * Render a message event with role-based styling
   */
  private renderMessage(event: AgentEvent & { t: 'msg' }): string {
    this.context.messageCount++;

    // Handle missing role
    const role = event.role || 'unknown';
    const roleClass = `message-${role}`;
    const roleIcon =
      {
        user: '👤',
        assistant: '🤖',
        system: '⚙️',
      }[role] || '❓';

    // Escape HTML first, then apply markdown-like formatting with proper nesting support
    // escapeHtml now handles null/undefined gracefully
    let content = this.escapeHtml(event.text);

    // Store code segments to protect them from other formatting
    const codeSegments: { placeholder: string; content: string }[] = [];
    content = content.replace(/`([^`]+)`/g, (match, code) => {
      const placeholder = `__CODE_${codeSegments.length}__`;
      codeSegments.push({ placeholder, content: `<code>${code}</code>` });
      return placeholder;
    });

    // Handle bold with potential nested content
    content = content.replace(
      /\*\*((?:[^*]|\*(?!\*))+)\*\*/g,
      (_, boldContent) => {
        // Process italic within bold
        const withItalic = boldContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return `<strong>${withItalic}</strong>`;
      },
    );

    // Handle remaining standalone italic (not within bold)
    content = content.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // Restore code segments
    codeSegments.forEach(({ placeholder, content: codeContent }) => {
      content = content.replace(placeholder, codeContent);
    });

    // Finally, convert newlines to <br>
    content = content.replace(/\n/g, '<br>');

    return `<div class="message ${roleClass}">
  <div class="message-header">
    <span class="role-icon">${roleIcon}</span>
    <span class="role-name">${role}</span>
  </div>
  <div class="message-content">${content}</div>
</div>
`;
  }

  /**
   * Extract key parameters from tool input
   */
  private extractToolParams(
    toolName: string,
    inputText: string | undefined,
  ): string {
    if (!inputText) return '';

    try {
      const input = JSON.parse(inputText);

      // Format based on tool name
      switch (toolName.toLowerCase()) {
        case 'write':
        case 'edit':
        case 'multiedit':
          if (input.file_path) {
            return input.file_path;
          }
          break;

        case 'read':
        case 'notebookread':
          if (input.file_path || input.notebook_path) {
            const path = input.file_path || input.notebook_path;
            const preview = input.limit ? ` (${input.limit} lines)` : '';
            return `${path}${preview}`;
          }
          break;

        case 'bash':
          if (input.command) {
            // Truncate long commands
            const cmd =
              input.command.length > 50
                ? input.command.substring(0, 47) + '...'
                : input.command;
            return cmd;
          }
          break;

        case 'glob':
          if (input.pattern) {
            return input.pattern;
          }
          break;

        case 'grep':
          if (input.pattern) {
            const path = input.path ? ` in ${input.path}` : '';
            return `"${input.pattern}"${path}`;
          }
          break;

        case 'ls':
          if (input.path) {
            return input.path;
          }
          break;

        case 'webfetch':
          if (input.url) {
            // Show just the domain for brevity
            try {
              const url = new URL(input.url);
              return url.hostname;
            } catch {
              return input.url;
            }
          }
          break;

        case 'websearch':
          if (input.query) {
            const query =
              input.query.length > 30
                ? input.query.substring(0, 27) + '...'
                : input.query;
            return `"${query}"`;
          }
          break;

        case 'task':
          if (input.description) {
            return input.description;
          }
          break;

        case 'todowrite':
          if (input.todos && Array.isArray(input.todos)) {
            return `${input.todos.length} items`;
          }
          break;
      }

      // Generic fallback - show first meaningful value
      const keys = Object.keys(input);
      if (keys.length > 0) {
        const firstKey = keys[0];
        const value = String(input[firstKey]);
        if (value.length > 40) {
          return `${firstKey}: ${value.substring(0, 37)}...`;
        }
        return `${firstKey}: ${value}`;
      }
    } catch {
      // If JSON parsing fails, return raw text truncated
      if (inputText.length > 50) {
        return inputText.substring(0, 47) + '...';
      }
      return inputText;
    }

    return '';
  }

  /**
   * Render a tool event with proper phase handling
   */
  private renderTool(event: AgentEvent & { t: 'tool' }): string {
    if (this.options.hideTools) return '';

    switch (event.phase) {
      case 'start': {
        // Track the tool in our context (handle null/undefined name)
        const toolName = event.name || 'unknown-tool';
        this.context.toolStack.set(toolName, {
          name: toolName,
          startTime: Date.now(),
          outputLines: [],
          collapsed: this.options.collapseTools || false,
        });

        // Extract and format parameters
        const params = this.extractToolParams(event.name, event.text);
        const paramsHtml = params
          ? `<span class="tool-params">${this.escapeHtml(params)}</span>`
          : '';

        return `<div class="tool-execution" data-tool="${this.escapeHtml(event.name)}">
  <div class="tool-start">
    <span class="tool-icon">🔧</span>
    <span class="tool-name">${this.escapeHtml(event.name)}</span>
    ${paramsHtml}
  </div>
  <div class="tool-output">
`;
      }

      case 'stdout':
      case 'stderr': {
        const outputClass = event.phase === 'stderr' ? 'stderr' : 'stdout';
        const escapedText = this.escapeHtml(event.text || '');

        // Track output for potential collapsing
        if (event.name) {
          const toolState = this.context.toolStack.get(event.name);
          if (toolState && event.text) {
            toolState.outputLines.push(event.text);
          }
        }

        return `    <div class="tool-${outputClass}">${escapedText}</div>
`;
      }

      case 'end': {
        const exitCode = event.exitCode || 0;
        const statusClass = exitCode === 0 ? 'success' : 'error';
        const statusIcon = exitCode === 0 ? '✅' : '❌';
        const statusText =
          exitCode === 0 ? 'completed' : `failed (exit ${exitCode})`;

        // Calculate duration if we have tracking
        let durationHtml = '';
        if (event.name) {
          const toolState = this.context.toolStack.get(event.name);
          if (toolState) {
            const duration = Date.now() - toolState.startTime;
            durationHtml = `<span class="tool-duration">${duration}ms</span>`;
          }
          this.context.toolStack.delete(event.name);
        }

        return `  </div>
  <div class="tool-end ${statusClass}">
    <span class="status-icon">${statusIcon}</span>
    <span class="tool-name">${this.escapeHtml(event.name)}</span>
    <span class="tool-status">${statusText}</span>
    ${durationHtml}
  </div>
</div>
`;
      }

      default:
        return `<div class="tool-${event.phase}">${this.escapeHtml(event.text || '')}</div>
`;
    }
  }

  /**
   * Render a cost event with proper formatting
   */
  private renderCost(event: AgentEvent & { t: 'cost' }): string {
    if (this.options.hideCost) return '';

    const costValue =
      event.deltaUsd == null ||
      isNaN(event.deltaUsd) ||
      !isFinite(event.deltaUsd)
        ? '0.0000'
        : event.deltaUsd < 0
          ? `-$${Math.abs(event.deltaUsd).toFixed(4)}`
          : `$${event.deltaUsd.toFixed(4)}`;

    return `<div class="cost-info">
  <span class="cost-icon">💰</span>
  <span class="cost-amount">${costValue}</span>
</div>
`;
  }

  /**
   * Render an error event with appropriate styling
   */
  private renderError(event: AgentEvent & { t: 'error' }): string {
    return `<div class="error-message">
  <span class="error-icon">🚨</span>
  <span class="error-text">${this.escapeHtml(event.message)}</span>
</div>
`;
  }

  /**
   * Render a debug event in a pre-formatted block
   */
  private renderDebug(event: AgentEvent & { t: 'debug' }): string {
    if (this.options.hideDebug) return '';

    let debugText: string;
    try {
      debugText = JSON.stringify(event.raw, null, 2);
    } catch (error) {
      // Handle circular references or other JSON serialization errors
      if (error instanceof Error && error.message.includes('circular')) {
        debugText = '[Circular Reference]';
      } else {
        debugText = '[Unserializable Object]';
      }
    }

    return `<div class="debug-info">
  <span class="debug-icon">🐛</span>
  <pre class="debug-content">${this.escapeHtml(debugText)}</pre>
</div>
`;
  }

  /**
   * Render an unknown event type (for forward compatibility)
   */
  private renderUnknown(event: AgentEvent): string {
    // Handle potential circular references
    let eventContent: string;
    try {
      eventContent = JSON.stringify(event, null, 2);
    } catch (e) {
      eventContent = `[Non-serializable event of type: ${typeof event === 'object' && event && 't' in event && typeof event.t === 'string' ? event.t : 'unknown'}]`;
    }

    return `<div class="unknown-event">
  <span class="unknown-icon">❓</span>
  <pre class="unknown-content">${this.escapeHtml(eventContent)}</pre>
</div>
`;
  }

  /**
   * Escape HTML entities to prevent XSS
   * Handles null/undefined gracefully
   */
  private escapeHtml(text: string | null | undefined): string {
    // Handle null/undefined
    if (text == null) {
      return '';
    }

    // Convert to string if not already
    const str = String(text);

    // Use global replace to escape ALL occurrences
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Render multiple events in a batch
   */
  renderBatch(events: AgentEvent[]): string {
    return events.map(event => this.render(event)).join('');
  }

  /**
   * Flush any pending state and return final output
   */
  flush(): string {
    // Close any open tool executions
    const openTools = Array.from(this.context.toolStack.values())
      .map(
        tool => `  </div>
  <div class="tool-interrupted">
    <span class="interrupted-icon">⚠️</span>
    <span class="interrupted-text">Tool interrupted: ${this.escapeHtml(tool.name)}</span>
  </div>
</div>
`,
      )
      .join('');

    // Clear the tool stack
    this.context.toolStack.clear();

    return openTools;
  }
}
