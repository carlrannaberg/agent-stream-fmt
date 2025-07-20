/**
 * JSON renderer implementation
 *
 * Outputs events as JSON, either as individual JSON lines or pretty-printed.
 * This renderer is useful for processing output programmatically or for
 * debugging purposes.
 */

import type { AgentEvent } from '../types.js';
import type { Renderer, RenderOptions, RenderContext } from './types.js';

/**
 * JSON renderer that outputs events as JSON strings
 *
 * Provides raw JSON output of AgentEvents, useful for programmatic
 * processing, logging, or integration with other tools. Supports
 * both compact and pretty-printed output.
 *
 * @example
 * ```typescript
 * // Compact JSON output
 * const renderer = new JsonRenderer({
 *   pretty: false
 * });
 *
 * // Pretty-printed JSON
 * const prettyRenderer = new JsonRenderer({
 *   pretty: true
 * });
 *
 * // Stream to JSONL file
 * const output = fs.createWriteStream('events.jsonl');
 * for (const event of events) {
 *   const json = renderer.render(event);
 *   if (json) output.write(json);
 * }
 * ```
 *
 * @category Renderers
 * @since 0.1.0
 */
export class JsonRenderer implements Renderer {
  private readonly options: RenderOptions;
  private readonly context: RenderContext;
  private readonly prettyPrint: boolean;

  constructor(options: Partial<RenderOptions> = {}) {
    this.options = {
      format: 'json',
      ...options,
    };

    this.context = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now(),
    };

    // Enable pretty printing if compact mode is disabled
    this.prettyPrint = !this.options.compactMode;
  }

  /**
   * Render a single event to JSON
   */
  render(event: AgentEvent): string {
    // Apply filtering based on options
    if (this.shouldHideEvent(event)) {
      return '';
    }

    // Update context
    this.updateContext(event);

    // Add timestamp if requested
    const eventWithMetadata = this.options.showTimestamps
      ? { ...event, timestamp: new Date().toISOString() }
      : event;

    // Format as JSON
    if (this.prettyPrint) {
      return JSON.stringify(eventWithMetadata, null, 2) + '\n';
    } else {
      return JSON.stringify(eventWithMetadata) + '\n';
    }
  }

  /**
   * Render multiple events as a JSON array
   */
  renderBatch(events: AgentEvent[]): string {
    // Filter events
    const filteredEvents = events.filter(event => !this.shouldHideEvent(event));

    if (filteredEvents.length === 0) {
      return '';
    }

    // Update context for all events
    filteredEvents.forEach(event => this.updateContext(event));

    // Add timestamps if requested
    const eventsWithMetadata = this.options.showTimestamps
      ? filteredEvents.map(event => ({
          ...event,
          timestamp: new Date().toISOString(),
        }))
      : filteredEvents;

    // Format as JSON array
    if (this.prettyPrint) {
      return JSON.stringify(eventsWithMetadata, null, 2) + '\n';
    } else {
      // In compact mode, still output as JSONL (one per line) for streaming
      return (
        eventsWithMetadata.map(event => JSON.stringify(event)).join('\n') +
        (eventsWithMetadata.length > 0 ? '\n' : '')
      );
    }
  }

  /**
   * No special flush behavior needed for JSON
   */
  flush(): string {
    return '';
  }

  /**
   * Check if an event should be hidden based on options
   */
  private shouldHideEvent(event: AgentEvent): boolean {
    switch (event.t) {
      case 'tool':
        return this.options.hideTools === true;
      case 'cost':
        return this.options.hideCost === true;
      case 'debug':
        return this.options.hideDebug === true;
      default:
        return false;
    }
  }

  /**
   * Update render context based on event
   */
  private updateContext(event: AgentEvent): void {
    // Track previous event
    this.context.previousEvent = event;

    // Update message count
    if (event.t === 'msg') {
      this.context.messageCount++;
    }

    // Track tool state
    if (event.t === 'tool') {
      if (event.phase === 'start') {
        this.context.toolStack.set(event.name, {
          name: event.name,
          startTime: Date.now(),
          outputLines: [],
          collapsed: false,
        });
      } else if (event.phase === 'end') {
        this.context.toolStack.delete(event.name);
      }
    }
  }
}
