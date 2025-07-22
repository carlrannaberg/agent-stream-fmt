// JSONL parser types
// Placeholder implementation - will be extracted from @agent-io/stream in future

import type { AgentEvent, Vendor } from '@agent-io/core';

export interface VendorParser {
  vendor: Vendor;
  parse(line: string): AgentEvent[];
}

export interface ParseOptions {
  vendor?: Vendor;
  strict?: boolean;
}
