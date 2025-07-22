// Type guard functions for Agent-IO types

import type {
  AgentEvent,
  MessageEvent,
  ToolEvent,
  CostEvent,
  ErrorEvent,
  DebugEvent,
} from './types.js';

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;
  if (!('t' in obj) || typeof obj.t !== 'string') {
    return false;
  }

  return ['msg', 'tool', 'cost', 'error', 'debug'].includes(obj.t);
}

export function isMessageEvent(value: unknown): value is MessageEvent {
  if (!isAgentEvent(value)) {
    return false;
  }

  if (value.t !== 'msg') {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    'role' in event &&
    typeof event.role === 'string' &&
    ['user', 'assistant', 'system'].includes(event.role) &&
    'text' in event &&
    typeof event.text === 'string'
  );
}

export function isToolEvent(value: unknown): value is ToolEvent {
  if (!isAgentEvent(value)) {
    return false;
  }

  if (value.t !== 'tool') {
    return false;
  }

  const event = value as Record<string, unknown>;
  return (
    'name' in event &&
    typeof event.name === 'string' &&
    'phase' in event &&
    typeof event.phase === 'string' &&
    ['start', 'stdout', 'stderr', 'end'].includes(event.phase)
  );
}

export function isCostEvent(value: unknown): value is CostEvent {
  if (!isAgentEvent(value)) {
    return false;
  }

  if (value.t !== 'cost') {
    return false;
  }

  const event = value as Record<string, unknown>;
  return 'deltaUsd' in event && typeof event.deltaUsd === 'number';
}

export function isErrorEvent(value: unknown): value is ErrorEvent {
  if (!isAgentEvent(value)) {
    return false;
  }

  if (value.t !== 'error') {
    return false;
  }

  const event = value as Record<string, unknown>;
  return 'message' in event && typeof event.message === 'string';
}

export function isDebugEvent(value: unknown): value is DebugEvent {
  if (!isAgentEvent(value)) {
    return false;
  }

  return value.t === 'debug';
}
