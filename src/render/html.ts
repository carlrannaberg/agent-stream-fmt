/**
 * HTML renderer implementation for AgentEvents
 * 
 * This module provides HTML rendering functionality for agent events,
 * generating semantic HTML with appropriate CSS classes for styling.
 * All user content is properly escaped to prevent XSS attacks.
 */

import type { AgentEvent } from '../types.js';
import type { Renderer, RenderContext, RenderOptions, ToolState } from './types.js';

/**
 * HTML renderer that converts AgentEvents to semantic HTML
 * 
 * Features:
 * - Proper HTML escaping for all user content
 * - Semantic structure with CSS classes
 * - Message rendering with role-based styling
 * - Tool execution tracking with phases
 * - Cost and error formatting
 * - Debug information in pre-formatted blocks
 */
export class HtmlRenderer implements Renderer {
  private context: RenderContext;

  constructor(private options: RenderOptions) {
    this.context = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now()
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
    
    const roleClass = `message-${event.role}`;
    const roleIcon = {
      'user': '👤',
      'assistant': '🤖',
      'system': '⚙️'
    }[event.role] || '❓';

    // Escape HTML first, then apply basic markdown-like formatting
    const content = this.escapeHtml(event.text)
      .replace(/\n/g, '<br>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return `<div class="message ${roleClass}">
  <div class="message-header">
    <span class="role-icon">${roleIcon}</span>
    <span class="role-name">${event.role}</span>
  </div>
  <div class="message-content">${content}</div>
</div>
`;
  }

  /**
   * Render a tool event with proper phase handling
   */
  private renderTool(event: AgentEvent & { t: 'tool' }): string {
    if (this.options.hideTools) return '';

    switch (event.phase) {
      case 'start':
        // Track the tool in our context
        this.context.toolStack.set(event.name, {
          name: event.name,
          startTime: Date.now(),
          outputLines: [],
          collapsed: this.options.collapseTools || false
        });

        return `<div class="tool-execution" data-tool="${this.escapeHtml(event.name)}">
  <div class="tool-start">
    <span class="tool-icon">🔧</span>
    <span class="tool-name">${this.escapeHtml(event.name)}</span>
    ${event.text ? `<span class="tool-input">${this.escapeHtml(event.text)}</span>` : ''}
  </div>
  <div class="tool-output">
`;

      case 'stdout':
      case 'stderr':
        const outputClass = event.phase === 'stderr' ? 'stderr' : 'stdout';
        const escapedText = this.escapeHtml(event.text || '');
        
        // Track output for potential collapsing
        const toolState = this.context.toolStack.get(event.name);
        if (toolState && event.text) {
          toolState.outputLines.push(event.text);
        }

        return `    <div class="tool-${outputClass}">${escapedText}</div>
`;

      case 'end':
        const statusClass = (event.exitCode || 0) === 0 ? 'success' : 'error';
        const statusIcon = (event.exitCode || 0) === 0 ? '✅' : '❌';

        // Remove from tracking
        this.context.toolStack.delete(event.name);

        return `  </div>
  <div class="tool-end ${statusClass}">
    <span class="status-icon">${statusIcon}</span>
    <span class="tool-name">${this.escapeHtml(event.name)}</span>
    ${event.exitCode !== undefined ? `<span class="exit-code">Exit: ${event.exitCode}</span>` : ''}
  </div>
</div>
`;

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

    return `<div class="cost-info">
  <span class="cost-icon">💰</span>
  <span class="cost-amount">$${event.deltaUsd.toFixed(4)}</span>
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

    return `<div class="debug-info">
  <span class="debug-icon">🐛</span>
  <pre class="debug-content">${this.escapeHtml(JSON.stringify(event.raw, null, 2))}</pre>
</div>
`;
  }

  /**
   * Render an unknown event type (for forward compatibility)
   */
  private renderUnknown(event: AgentEvent): string {
    return `<div class="unknown-event">
  <span class="unknown-icon">❓</span>
  <pre class="unknown-content">${this.escapeHtml(JSON.stringify(event, null, 2))}</pre>
</div>
`;
  }

  /**
   * Escape HTML entities to prevent XSS
   */
  private escapeHtml(text: string): string {
    return text
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
      .map(tool => `  </div>
  <div class="tool-interrupted">
    <span class="interrupted-icon">⚠️</span>
    <span class="interrupted-text">Tool interrupted: ${this.escapeHtml(tool.name)}</span>
  </div>
</div>
`)
      .join('');

    // Clear the tool stack
    this.context.toolStack.clear();

    return openTools;
  }
}