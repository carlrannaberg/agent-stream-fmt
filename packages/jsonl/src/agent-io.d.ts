declare module '@agent-io/core' {
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

  export function isAgentEvent(obj: any): obj is AgentEvent;
  export function createDebugEvent(data: any): AgentEvent;
}
