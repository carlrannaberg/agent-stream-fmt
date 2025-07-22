import { describe, it, expect } from 'vitest';
import {
  isMessageEvent,
  isToolEvent,
  isCostEvent,
  isErrorEvent,
  isDebugEvent,
  AgentEvent,
  MessageEvent,
  ToolEvent,
  CostEvent,
  ErrorEvent,
  DebugEvent,
} from './types.js';

describe('Type guards', () => {
  it('correctly identifies message events', () => {
    const event: AgentEvent = { t: 'msg', role: 'user', text: 'hello' };
    expect(isMessageEvent(event)).toBe(true);
    expect(isToolEvent(event)).toBe(false);
    expect(isCostEvent(event)).toBe(false);
    expect(isErrorEvent(event)).toBe(false);
    expect(isDebugEvent(event)).toBe(false);
  });

  it('correctly identifies tool events', () => {
    const event: AgentEvent = { t: 'tool', name: 'test-tool', phase: 'start' };
    expect(isToolEvent(event)).toBe(true);
    expect(isMessageEvent(event)).toBe(false);
    expect(isCostEvent(event)).toBe(false);
    expect(isErrorEvent(event)).toBe(false);
    expect(isDebugEvent(event)).toBe(false);
  });

  it('correctly identifies cost events', () => {
    const event: AgentEvent = { t: 'cost', deltaUsd: 0.01 };
    expect(isCostEvent(event)).toBe(true);
    expect(isMessageEvent(event)).toBe(false);
    expect(isToolEvent(event)).toBe(false);
    expect(isErrorEvent(event)).toBe(false);
    expect(isDebugEvent(event)).toBe(false);
  });

  it('correctly identifies error events', () => {
    const event: AgentEvent = { t: 'error', message: 'Something went wrong' };
    expect(isErrorEvent(event)).toBe(true);
    expect(isMessageEvent(event)).toBe(false);
    expect(isToolEvent(event)).toBe(false);
    expect(isCostEvent(event)).toBe(false);
    expect(isDebugEvent(event)).toBe(false);
  });

  it('correctly identifies debug events', () => {
    const event: AgentEvent = { t: 'debug', raw: { unknown: 'data' } };
    expect(isDebugEvent(event)).toBe(true);
    expect(isMessageEvent(event)).toBe(false);
    expect(isToolEvent(event)).toBe(false);
    expect(isCostEvent(event)).toBe(false);
    expect(isErrorEvent(event)).toBe(false);
  });

  it('provides proper type narrowing for message events', () => {
    const event: AgentEvent = {
      t: 'msg',
      role: 'assistant',
      text: 'Hello world',
    };
    if (isMessageEvent(event)) {
      // TypeScript should know these properties exist
      expect(event.role).toBe('assistant');
      expect(event.text).toBe('Hello world');
      expect(event.t).toBe('msg');
    }
  });

  it('provides proper type narrowing for tool events', () => {
    const event: AgentEvent = {
      t: 'tool',
      name: 'bash',
      phase: 'stdout',
      text: 'command output',
      exitCode: 0,
    };
    if (isToolEvent(event)) {
      // TypeScript should know these properties exist
      expect(event.name).toBe('bash');
      expect(event.phase).toBe('stdout');
      expect(event.text).toBe('command output');
      expect(event.exitCode).toBe(0);
    }
  });

  it('provides proper type narrowing for cost events', () => {
    const event: AgentEvent = { t: 'cost', deltaUsd: 0.005 };
    if (isCostEvent(event)) {
      // TypeScript should know these properties exist
      expect(event.deltaUsd).toBe(0.005);
      expect(event.t).toBe('cost');
    }
  });

  it('provides proper type narrowing for error events', () => {
    const event: AgentEvent = { t: 'error', message: 'Parse error' };
    if (isErrorEvent(event)) {
      // TypeScript should know these properties exist
      expect(event.message).toBe('Parse error');
      expect(event.t).toBe('error');
    }
  });

  it('provides proper type narrowing for debug events', () => {
    const debugData = { unknown: 'format', data: [1, 2, 3] };
    const event: AgentEvent = { t: 'debug', raw: debugData };
    if (isDebugEvent(event)) {
      // TypeScript should know these properties exist
      expect(event.raw).toEqual(debugData);
      expect(event.t).toBe('debug');
    }
  });
});

describe('Event types', () => {
  it('allows valid message events', () => {
    const userMessage: MessageEvent = { t: 'msg', role: 'user', text: 'Hello' };
    const assistantMessage: MessageEvent = {
      t: 'msg',
      role: 'assistant',
      text: 'Hi there',
    };
    const systemMessage: MessageEvent = {
      t: 'msg',
      role: 'system',
      text: 'System ready',
    };

    expect(userMessage.t).toBe('msg');
    expect(assistantMessage.role).toBe('assistant');
    expect(systemMessage.text).toBe('System ready');
  });

  it('allows valid tool events', () => {
    const toolStart: ToolEvent = { t: 'tool', name: 'grep', phase: 'start' };
    const toolOutput: ToolEvent = {
      t: 'tool',
      name: 'grep',
      phase: 'stdout',
      text: 'search results',
    };
    const toolError: ToolEvent = {
      t: 'tool',
      name: 'grep',
      phase: 'stderr',
      text: 'error message',
    };
    const toolEnd: ToolEvent = {
      t: 'tool',
      name: 'grep',
      phase: 'end',
      exitCode: 0,
    };

    expect(toolStart.phase).toBe('start');
    expect(toolOutput.text).toBe('search results');
    expect(toolError.phase).toBe('stderr');
    expect(toolEnd.exitCode).toBe(0);
  });

  it('allows valid cost events', () => {
    const cost: CostEvent = { t: 'cost', deltaUsd: 0.025 };
    expect(cost.deltaUsd).toBe(0.025);
  });

  it('allows valid error events', () => {
    const error: ErrorEvent = { t: 'error', message: 'Failed to parse JSON' };
    expect(error.message).toBe('Failed to parse JSON');
  });

  it('allows valid debug events', () => {
    const debug: DebugEvent = {
      t: 'debug',
      raw: { type: 'unknown', payload: 'data' },
    };
    expect((debug.raw as { type: string }).type).toBe('unknown');
  });
});
