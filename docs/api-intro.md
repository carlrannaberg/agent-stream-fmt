# Agent Stream Formatter API

## Introduction

The Agent Stream Formatter provides a unified API for parsing and rendering JSONL output from
various AI agent CLIs including Claude Code, Gemini CLI, and Amp Code. This library focuses on
streaming efficiency, memory optimization, and beautiful terminal/HTML output.

## Core Concepts

### Streaming Architecture

The library is built on async iterators for efficient streaming:

- **Memory efficient**: Processes unbounded streams with constant memory usage
- **Backpressure aware**: Handles slow consumers gracefully
- **Error resilient**: Continues processing after malformed lines

### Event-Based Model

All agent outputs are normalized into a common event format:

- **Messages**: User, assistant, and system messages
- **Tool Execution**: Tool start, output (stdout/stderr), and completion
- **Cost Tracking**: Token usage and cost estimation
- **Errors**: Structured error reporting
- **Debug Information**: Raw event passthrough for debugging

### Vendor Support

The library automatically detects and parses output from:

- **Claude Code**: Anthropic's official CLI for Claude
- **Gemini CLI**: Google's Gemini command-line interface
- **Amp Code**: Amp's AI coding assistant

## Quick Start

```typescript
import { streamEvents, streamFormat } from 'agent-stream-fmt';

// Parse JSONL events
for await (const event of streamEvents({
  vendor: 'auto',
  source: process.stdin,
})) {
  console.log(event);
}

// Format for terminal output
for await (const line of streamFormat({
  vendor: 'auto',
  format: 'ansi',
  source: process.stdin,
})) {
  process.stdout.write(line);
}
```

## API Categories

### Main API

Core streaming functions for parsing and formatting agent output.

### Types

TypeScript type definitions for events, options, and vendor formats.

### Parsers

Vendor-specific parsers for Claude, Gemini, and Amp output formats.

### Renderers

Output formatters for ANSI terminal, HTML, and JSON rendering.

### Utilities

Helper functions for line reading and stream processing.
