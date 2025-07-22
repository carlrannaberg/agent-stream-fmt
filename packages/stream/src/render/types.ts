/**
 * Type definitions for the rendering system
 *
 * This module defines all the core types used by the rendering engine,
 * including options, interfaces, and state management types.
 */

import type { AgentEvent } from '../types.js';

/**
 * Configuration options for rendering AgentEvents
 *
 * These options control how events are formatted and what information
 * is included in the output.
 */
export interface RenderOptions {
  /**
   * Output format to use
   * - 'ansi': Terminal output with ANSI color codes
   * - 'html': HTML output with semantic structure
   * - 'json': JSON representation of events
   */
  format: 'ansi' | 'html' | 'json';

  /**
   * Collapse tool output into expandable sections
   * When enabled, tool stdout/stderr is grouped and can be toggled
   * @default false
   */
  collapseTools?: boolean;

  /**
   * Completely hide tool execution events
   * When enabled, all tool-related events are filtered out
   * @default false
   */
  hideTools?: boolean;

  /**
   * Hide cost information from output
   * When enabled, cost events are not rendered
   * @default false
   */
  hideCost?: boolean;

  /**
   * Hide debug events from output
   * When enabled, debug events are not rendered
   * @default false
   */
  hideDebug?: boolean;

  /**
   * Show timestamps for each event
   * When enabled, each event includes its timestamp
   * @default false
   */
  showTimestamps?: boolean;

  /**
   * Enable compact mode with minimal formatting
   * Reduces whitespace and decorations for denser output
   * @default false
   */
  compactMode?: boolean;

  /**
   * Disable color output (ANSI format only)
   * Useful for environments that don't support ANSI codes
   * @default false
   */
  colorDisabled?: boolean;
}

/**
 * Core renderer interface that all renderers must implement
 *
 * Renderers are responsible for converting AgentEvents into
 * formatted strings according to their specific format.
 */
export interface Renderer {
  /**
   * Render a single event to a formatted string
   *
   * @param event - The AgentEvent to render
   * @returns Formatted string representation of the event
   */
  render(event: AgentEvent): string;

  /**
   * Render multiple events in a batch
   *
   * This method enables optimizations for rendering multiple
   * events together, such as grouping or aggregating output.
   *
   * @param events - Array of AgentEvents to render
   * @returns Formatted string representation of all events
   */
  renderBatch(events: AgentEvent[]): string;

  /**
   * Flush any pending state and return final output
   *
   * Called at the end of a stream to ensure all buffered
   * content is rendered. May return empty string if no
   * pending content exists.
   *
   * @returns Any remaining formatted output
   */
  flush(): string;
}

/**
 * Context maintained across rendering operations
 *
 * This context tracks state that may be needed to properly
 * render events in relation to each other.
 */
export interface RenderContext {
  /**
   * The previous event that was rendered
   * Used for context-aware formatting decisions
   */
  previousEvent?: AgentEvent;

  /**
   * Map of active tool executions by tool name
   * Tracks the state of tools that have started but not ended
   */
  toolStack: Map<string, ToolState>;

  /**
   * Count of message events rendered
   * Used for numbering or tracking conversation flow
   */
  messageCount: number;

  /**
   * Timestamp when rendering started
   * Used for calculating relative timestamps
   */
  renderStartTime: number;
}

/**
 * State information for an active tool execution
 *
 * Tracks the lifecycle and output of a tool from start to end.
 */
export interface ToolState {
  /**
   * Name or identifier of the tool
   */
  name: string;

  /**
   * Timestamp when the tool started executing
   */
  startTime: number;

  /**
   * Accumulated output lines from stdout/stderr
   * Preserved for rendering when tool completes
   */
  outputLines: string[];

  /**
   * Whether this tool's output should be collapsed
   * Can be set based on output size or user preference
   */
  collapsed: boolean;
}

/**
 * Factory function type for creating renderer instances
 *
 * @param options - Render options to configure the renderer
 * @returns A new renderer instance
 */
export type RendererFactory = (options: RenderOptions) => Renderer;

/**
 * Registry of available renderer factories by format
 */
export interface RendererRegistry {
  ansi: RendererFactory;
  html: RendererFactory;
  json: RendererFactory;
}
