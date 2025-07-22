import { describe, it, expect } from 'vitest';
import {
  isAgentEvent,
  isMessageEvent,
  isToolEvent,
  isCostEvent,
  isErrorEvent,
} from './guards.js';

describe('Type guards', () => {
  describe('isAgentEvent', () => {
    it('should return true for valid agent events', () => {
      expect(isAgentEvent({ t: 'msg', role: 'user', text: 'Hello' })).toBe(
        true,
      );
      expect(isAgentEvent({ t: 'tool', name: 'bash', phase: 'start' })).toBe(
        true,
      );
      expect(isAgentEvent({ t: 'cost', deltaUsd: 0.01 })).toBe(true);
      expect(isAgentEvent({ t: 'error', message: 'Error' })).toBe(true);
    });

    it('should return false for invalid events', () => {
      expect(isAgentEvent(null)).toBe(false);
      expect(isAgentEvent(undefined)).toBe(false);
      expect(isAgentEvent({})).toBe(false);
      expect(isAgentEvent({ t: 'invalid' })).toBe(false);
      expect(isAgentEvent({ type: 'msg' })).toBe(false);
    });
  });

  describe('isMessageEvent', () => {
    it('should validate message events correctly', () => {
      expect(isMessageEvent({ t: 'msg', role: 'user', text: 'Hello' })).toBe(
        true,
      );
      expect(isMessageEvent({ t: 'msg', role: 'assistant', text: '' })).toBe(
        true,
      );
      expect(
        isMessageEvent({ t: 'msg', role: 'system', text: 'System message' }),
      ).toBe(true);
    });

    it('should reject invalid message events', () => {
      expect(isMessageEvent({ t: 'msg' })).toBe(false);
      expect(isMessageEvent({ t: 'msg', role: 'invalid', text: 'Hello' })).toBe(
        false,
      );
      expect(isMessageEvent({ t: 'msg', role: 'user' })).toBe(false);
      expect(isMessageEvent({ t: 'tool', name: 'bash', phase: 'start' })).toBe(
        false,
      );
    });
  });

  describe('isToolEvent', () => {
    it('should validate tool events correctly', () => {
      expect(isToolEvent({ t: 'tool', name: 'bash', phase: 'start' })).toBe(
        true,
      );
      expect(
        isToolEvent({
          t: 'tool',
          name: 'python',
          phase: 'stdout',
          text: 'output',
        }),
      ).toBe(true);
      expect(
        isToolEvent({ t: 'tool', name: 'node', phase: 'end', exitCode: 0 }),
      ).toBe(true);
    });

    it('should reject invalid tool events', () => {
      expect(isToolEvent({ t: 'tool' })).toBe(false);
      expect(isToolEvent({ t: 'tool', name: 'bash' })).toBe(false);
      expect(isToolEvent({ t: 'tool', phase: 'start' })).toBe(false);
      expect(isToolEvent({ t: 'msg', role: 'user', text: 'Hello' })).toBe(
        false,
      );
    });
  });

  describe('isCostEvent', () => {
    it('should validate cost events correctly', () => {
      expect(isCostEvent({ t: 'cost', deltaUsd: 0.01 })).toBe(true);
      expect(isCostEvent({ t: 'cost', deltaUsd: 0 })).toBe(true);
      expect(isCostEvent({ t: 'cost', deltaUsd: -0.01 })).toBe(true);
    });

    it('should reject invalid cost events', () => {
      expect(isCostEvent({ t: 'cost' })).toBe(false);
      expect(isCostEvent({ t: 'cost', deltaUsd: 'invalid' })).toBe(false);
      expect(isCostEvent({ t: 'cost', deltaUsd: null })).toBe(false);
      expect(isCostEvent({ t: 'msg', role: 'user', text: 'Hello' })).toBe(
        false,
      );
    });
  });

  describe('isErrorEvent', () => {
    it('should validate error events correctly', () => {
      expect(
        isErrorEvent({ t: 'error', message: 'Something went wrong' }),
      ).toBe(true);
      expect(isErrorEvent({ t: 'error', message: '' })).toBe(true);
    });

    it('should reject invalid error events', () => {
      expect(isErrorEvent({ t: 'error' })).toBe(false);
      expect(isErrorEvent({ t: 'error', message: 123 })).toBe(false);
      expect(isErrorEvent({ t: 'msg', role: 'user', text: 'Hello' })).toBe(
        false,
      );
    });
  });
});
