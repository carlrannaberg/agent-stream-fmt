// JSONL parser registry and auto-detection
// Placeholder implementation

import type { VendorParser, ParseOptions } from './types.js';
import type { AgentEvent } from '@agent-io/core';

export function createParser(_options: ParseOptions): VendorParser {
  // Placeholder implementation
  throw new Error(
    'Parser functionality will be extracted from @agent-io/stream package in future releases',
  );
}

export function parseJsonlLine(
  _line: string,
  _options?: ParseOptions,
): AgentEvent[] {
  // Placeholder implementation
  throw new Error(
    'Parse functionality will be extracted from @agent-io/stream package in future releases',
  );
}
