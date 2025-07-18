/**
 * Normalized event types emitted by the parser
 */
export type AgentEvent =
  | MessageEvent
  | ToolEvent
  | CostEvent
  | ErrorEvent
  | DebugEvent;

/**
 * Message event representing user, assistant, or system messages
 */
export interface MessageEvent {
  /** Event type discriminator */
  t: 'msg';
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  text: string;
}

/**
 * Tool event representing different phases of tool execution
 */
export interface ToolEvent {
  /** Event type discriminator */
  t: 'tool';
  /** Tool name or identifier */
  name: string;
  /** Current phase of tool execution */
  phase: 'start' | 'stdout' | 'stderr' | 'end';
  /** Tool output text (for stdout/stderr phases) */
  text?: string;
  /** Exit code (for end phase) */
  exitCode?: number;
}

/**
 * Cost event representing usage costs
 */
export interface CostEvent {
  /** Event type discriminator */
  t: 'cost';
  /** Cost delta in USD */
  deltaUsd: number;
}

/**
 * Error event representing parsing or execution errors
 */
export interface ErrorEvent {
  /** Event type discriminator */
  t: 'error';
  /** Error message */
  message: string;
}

/**
 * Debug event for unknown or debug data
 */
export interface DebugEvent {
  /** Event type discriminator */
  t: 'debug';
  /** Raw data for debugging */
  raw: any;
}

/**
 * Supported vendor identifiers
 */
export type Vendor = 'auto' | 'claude' | 'gemini' | 'amp';

/**
 * Options for streaming events
 */
export interface StreamEventOptions {
  /** Vendor to use for parsing */
  vendor: Vendor;
  /** Input stream source */
  source: NodeJS.ReadableStream;
}

/**
 * Options for streaming with formatting
 */
export interface StreamFormatOptions extends StreamEventOptions {
  /** Output format (default: 'ansi') */
  format?: 'ansi' | 'html' | 'json';
  /** Renderer-specific options */
  renderOptions?: Partial<import('./render/types.js').RenderOptions>;
}

/**
 * Options for formatting output
 */
export interface FmtOptions {
  /** Group tool phases into collapsible blocks */
  collapseTools?: boolean;
  
  /** Completely hide tool events */
  hideTools?: boolean;
  
  /** Hide cost information */
  hideCost?: boolean;
  
  /** Output format: true = ANSI, false = plain, 'html' = HTML */
  ansi?: boolean | 'html';
  
  /** Callback for every parsed event (before filtering) */
  onEvent?: (ev: AgentEvent) => void;
  
  /** Batch size for write operations (performance tuning) */
  chunkSize?: number;
}

/**
 * Type guards for event discrimination
 */

/**
 * Check if an event is a MessageEvent
 * @param e - Event to check
 * @returns True if event is a MessageEvent
 */
export const isMessageEvent = (e: AgentEvent): e is MessageEvent => e.t === 'msg';

/**
 * Check if an event is a ToolEvent
 * @param e - Event to check
 * @returns True if event is a ToolEvent
 */
export const isToolEvent = (e: AgentEvent): e is ToolEvent => e.t === 'tool';

/**
 * Check if an event is a CostEvent
 * @param e - Event to check
 * @returns True if event is a CostEvent
 */
export const isCostEvent = (e: AgentEvent): e is CostEvent => e.t === 'cost';

/**
 * Check if an event is an ErrorEvent
 * @param e - Event to check
 * @returns True if event is an ErrorEvent
 */
export const isErrorEvent = (e: AgentEvent): e is ErrorEvent => e.t === 'error';

/**
 * Check if an event is a DebugEvent
 * @param e - Event to check
 * @returns True if event is a DebugEvent
 */
export const isDebugEvent = (e: AgentEvent): e is DebugEvent => e.t === 'debug';