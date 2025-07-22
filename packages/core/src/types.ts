// Core types for Agent-IO packages
// Placeholder implementation - will be extracted from @agent-io/stream in future
// Test change for incremental build verification

export type Vendor = 'auto' | 'claude' | 'gemini' | 'amp';

export type MessageEvent = {
  t: 'msg';
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp?: number;
};
export type ToolEvent = {
  t: 'tool';
  name: string;
  phase: 'start' | 'stdout' | 'stderr' | 'end';
  text?: string;
  exitCode?: number;
};
export type CostEvent = { t: 'cost'; deltaUsd: number };
export type ErrorEvent = { t: 'error'; message: string };
export type DebugEvent = { t: 'debug'; raw: unknown };

export type AgentEvent =
  | MessageEvent
  | ToolEvent
  | CostEvent
  | ErrorEvent
  | DebugEvent;
