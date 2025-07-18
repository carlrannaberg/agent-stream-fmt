/**
 * ANSI renderer for AgentEvents
 * 
 * Renders events with ANSI color codes and formatting for terminal output.
 * Supports role-based colors, tool tracking, and markdown-like formatting.
 */

import kleur from 'kleur';
import type { AgentEvent, ToolEvent } from '../types.js';
import type { Renderer, RenderOptions, RenderContext, ToolState } from './types.js';

/**
 * ANSI terminal renderer implementation
 * 
 * Provides colorful terminal output with icons, formatting, and
 * visual hierarchy for agent events.
 */
export class AnsiRenderer implements Renderer {
  private context: RenderContext;
  
  constructor(private options: RenderOptions) {
    // Enable colors by default unless explicitly disabled
    if (options.colorDisabled) {
      kleur.enabled = false;
    } else if (kleur.enabled === undefined) {
      // Force enable colors if not already set
      kleur.enabled = true;
    }
    
    this.context = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now()
    };
  }
  
  /**
   * Render a single event to ANSI-formatted string
   */
  render(event: AgentEvent): string {
    // Update context
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
        // Handle unknown event types gracefully
        return this.renderUnknown(event);
    }
  }
  
  /**
   * Render a message event with role-based formatting
   */
  private renderMessage(event: AgentEvent & { t: 'msg' }): string {
    this.context.messageCount++;
    
    // Role-based icons
    const roleIcon = {
      'user': '👤',
      'assistant': '🤖',
      'system': '⚙️'
    }[event.role] || '❓';
    
    // Role-based colors
    const roleColor = {
      'user': kleur.bold().cyan,
      'assistant': kleur.bold().green,
      'system': kleur.bold().yellow
    }[event.role] || kleur.bold().white;
    
    const header = roleColor(`${roleIcon} ${event.role}:`);
    const content = this.formatMessageContent(event.text);
    
    // Add extra newline for spacing unless in compact mode
    const spacing = this.options.compactMode ? '\n' : '\n\n';
    
    return `${header}\n${content}${spacing}`;
  }
  
  /**
   * Render a tool event with phase-based formatting
   */
  private renderTool(event: AgentEvent & { t: 'tool' }): string {
    if (this.options.hideTools) return '';
    
    switch (event.phase) {
      case 'start':
        return this.renderToolStart(event as ToolEvent & { phase: 'start' });
      case 'stdout':
      case 'stderr':
        return this.renderToolOutput(event as ToolEvent & { phase: 'stdout' | 'stderr' });
      case 'end':
        return this.renderToolEnd(event as ToolEvent & { phase: 'end' });
      default:
        // Handle unknown phases gracefully
        return kleur.dim().gray(`  │ ${event.phase}: ${event.text || ''}\n`);
    }
  }
  
  /**
   * Render tool start phase
   */
  private renderToolStart(event: ToolEvent & { phase: 'start' }): string {
    // Track tool state
    this.context.toolStack.set(event.name, {
      name: event.name,
      startTime: Date.now(),
      outputLines: [],
      collapsed: this.options.collapseTools || false
    });
    
    const startIcon = kleur.dim().italic('🔧');
    const toolName = kleur.bold().blue(event.name);
    const input = event.text ? kleur.dim(` ${event.text}`) : '';
    
    return `${startIcon} ${toolName}${input}\n`;
  }
  
  /**
   * Render tool output (stdout/stderr)
   */
  private renderToolOutput(event: ToolEvent & { phase: 'stdout' | 'stderr' }): string {
    const toolState = this.context.toolStack.get(event.name);
    if (!toolState) return '';
    
    // If collapsed, store output for later
    if (toolState.collapsed) {
      toolState.outputLines.push(event.text || '');
      return '';
    }
    
    // Different prefix for stderr
    const prefix = event.phase === 'stderr' 
      ? kleur.dim().red('  │ ')
      : kleur.dim().gray('  │ ');
    
    // Handle multi-line output
    const lines = (event.text || '').split('\n');
    return lines.map(line => `${prefix}${line}`).join('\n') + '\n';
  }
  
  /**
   * Render tool end phase
   */
  private renderToolEnd(event: ToolEvent & { phase: 'end' }): string {
    const toolState = this.context.toolStack.get(event.name);
    if (!toolState) return '';
    
    const duration = Date.now() - toolState.startTime;
    const exitCode = event.exitCode || 0;
    
    let result = '';
    
    // If collapsed, show summary
    if (toolState.collapsed && toolState.outputLines.length > 0) {
      const summary = toolState.outputLines.join('\n');
      const truncated = summary.slice(0, 100);
      const suffix = summary.length > 100 ? '...' : '';
      result += kleur.dim().gray(`  └─ ${truncated}${suffix}\n`);
    }
    
    // Status indicator
    const statusIcon = exitCode === 0 ? '✅' : '❌';
    const statusColor = exitCode === 0 ? kleur.green : kleur.red;
    const durationText = kleur.dim().gray(`(${duration}ms)`);
    
    result += `${statusIcon} ${statusColor(event.name)} ${durationText}\n`;
    
    // Clean up tool state
    this.context.toolStack.delete(event.name);
    
    return result;
  }
  
  /**
   * Render a cost event
   */
  private renderCost(event: AgentEvent & { t: 'cost' }): string {
    if (this.options.hideCost) return '';
    
    const costIcon = '💰';
    const costText = kleur.dim().yellow(`$${event.deltaUsd.toFixed(4)}`);
    
    return `${costIcon} ${costText}\n`;
  }
  
  /**
   * Render an error event
   */
  private renderError(event: AgentEvent & { t: 'error' }): string {
    const errorIcon = '🚨';
    const errorText = kleur.bold().red(event.message);
    
    return `${errorIcon} ${errorText}\n`;
  }
  
  /**
   * Render a debug event
   */
  private renderDebug(event: AgentEvent & { t: 'debug' }): string {
    if (this.options.hideDebug) return '';
    
    const debugIcon = kleur.dim().gray('🐛');
    const debugText = kleur.dim().gray(JSON.stringify(event.raw, null, 2));
    
    return `${debugIcon} ${debugText}\n`;
  }
  
  /**
   * Render unknown event types
   */
  private renderUnknown(event: any): string {
    return kleur.dim().gray(`❓ Unknown event type: ${JSON.stringify(event)}\n`);
  }
  
  /**
   * Format message content with markdown-like formatting
   */
  private formatMessageContent(text: string): string {
    const lines = text.split('\n');
    
    return lines.map(line => {
      // Skip code blocks (don't process their content)
      if (line.startsWith('```')) {
        return kleur.dim().gray(line);
      }
      
      // Process inline formatting
      let formatted = line;
      
      // Inline code: `code` → yellow
      formatted = formatted.replace(/`([^`]+)`/g, (_, code) => kleur.yellow(code));
      
      // Bold: **text** → bold
      formatted = formatted.replace(/\*\*([^*]+)\*\*/g, (_, text) => kleur.bold(text));
      
      // Italic: *text* → italic (but not **text**)
      formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, text) => kleur.italic(text));
      
      // Indent message content
      return `  ${formatted}`;
    }).join('\n');
  }
  
  /**
   * Render multiple events in a batch
   */
  renderBatch(events: AgentEvent[]): string {
    return events.map(event => this.render(event)).join('');
  }
  
  /**
   * Flush any pending state
   */
  flush(): string {
    // Handle any pending tool output
    const pendingTools = Array.from(this.context.toolStack.values());
    
    if (pendingTools.length === 0) {
      return '';
    }
    
    // Warn about tools that didn't complete
    const warnings = pendingTools
      .map(tool => `⚠️  ${kleur.yellow('Tool still running:')} ${tool.name}`)
      .join('\n');
      
    return warnings ? warnings + '\n' : '';
  }
}