# @agent-io/core

Core types and utilities for Agent-IO packages.

> **⚠️ IMPORTANT: This is a placeholder package**  
> This package is marked as `private` and should not be published to npm. It's reserved for future
> implementation of shared core functionality across Agent-IO packages.

## Installation

```bash
npm install @agent-io/core
# or
yarn add @agent-io/core
# or
pnpm add @agent-io/core
```

## Usage

This package provides the core type definitions and guard functions used across all Agent-IO
packages.

```typescript
import { AgentEvent, isMessageEvent, isToolEvent } from '@agent-io/core';

// Type-safe event handling
function handleEvent(event: AgentEvent) {
  if (isMessageEvent(event)) {
    console.log(`${event.role}: ${event.text}`);
  } else if (isToolEvent(event)) {
    console.log(`Tool ${event.name} ${event.phase}`);
  }
}
```

## API Reference

### Types

#### `AgentEvent`

Union type representing all possible agent events:

```typescript
type AgentEvent = MessageEvent | ToolEvent | CostEvent | ErrorEvent | DebugEvent;
```

#### `MessageEvent`

Represents a message from the user, assistant, or system:

```typescript
interface MessageEvent {
  t: 'msg';
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp?: number;
}
```

#### `ToolEvent`

Represents tool execution lifecycle events:

```typescript
interface ToolEvent {
  t: 'tool';
  name: string;
  phase: 'start' | 'stdout' | 'stderr' | 'end';
  text?: string;
  exitCode?: number;
}
```

#### `CostEvent`

Represents usage cost information:

```typescript
interface CostEvent {
  t: 'cost';
  deltaUsd: number;
}
```

#### `ErrorEvent`

Represents parsing or processing errors:

```typescript
interface ErrorEvent {
  t: 'error';
  message: string;
}
```

#### `DebugEvent`

Represents debug information for unknown formats:

```typescript
interface DebugEvent {
  t: 'debug';
  raw: unknown;
}
```

#### `Vendor`

Supported vendor types:

```typescript
type Vendor = 'auto' | 'claude' | 'gemini' | 'amp';
```

### Type Guards

Type guard functions for safe type narrowing:

#### `isMessageEvent(event: AgentEvent): event is MessageEvent`

```typescript
if (isMessageEvent(event)) {
  // TypeScript knows event is MessageEvent
  console.log(event.role, event.text);
}
```

#### `isToolEvent(event: AgentEvent): event is ToolEvent`

```typescript
if (isToolEvent(event)) {
  // TypeScript knows event is ToolEvent
  console.log(event.name, event.phase);
}
```

#### `isCostEvent(event: AgentEvent): event is CostEvent`

```typescript
if (isCostEvent(event)) {
  // TypeScript knows event is CostEvent
  console.log(`Cost: $${event.deltaUsd}`);
}
```

#### `isErrorEvent(event: AgentEvent): event is ErrorEvent`

```typescript
if (isErrorEvent(event)) {
  // TypeScript knows event is ErrorEvent
  console.error(event.message);
}
```

#### `isDebugEvent(event: AgentEvent): event is DebugEvent`

```typescript
if (isDebugEvent(event)) {
  // TypeScript knows event is DebugEvent
  console.debug(event.raw);
}
```

### Utility Functions

#### `getEventType(event: AgentEvent): string`

Get a human-readable event type name:

```typescript
const typeName = getEventType(event); // 'message', 'tool', 'cost', etc.
```

#### `isValidVendor(vendor: string): vendor is Vendor`

Check if a string is a valid vendor identifier:

```typescript
if (isValidVendor(userInput)) {
  // TypeScript knows userInput is Vendor type
  processVendor(userInput);
}
```

## Examples

### Pattern Matching with Events

```typescript
import { AgentEvent, isMessageEvent, isToolEvent } from '@agent-io/core';

function processEvents(events: AgentEvent[]) {
  const messages = events.filter(isMessageEvent);
  const tools = events.filter(isToolEvent);

  console.log(`Found ${messages.length} messages`);
  console.log(`Found ${tools.length} tool events`);

  // Group tool events by name
  const toolsByName = tools.reduce(
    (acc, event) => {
      if (!acc[event.name]) acc[event.name] = [];
      acc[event.name].push(event);
      return acc;
    },
    {} as Record<string, ToolEvent[]>,
  );
}
```

### Building Type-Safe Event Handlers

```typescript
import { AgentEvent, MessageEvent, ToolEvent } from '@agent-io/core';

class EventHandler {
  private handlers = new Map<AgentEvent['t'], (event: any) => void>();

  onMessage(handler: (event: MessageEvent) => void) {
    this.handlers.set('msg', handler);
  }

  onTool(handler: (event: ToolEvent) => void) {
    this.handlers.set('tool', handler);
  }

  handle(event: AgentEvent) {
    const handler = this.handlers.get(event.t);
    if (handler) {
      handler(event);
    }
  }
}

// Usage
const handler = new EventHandler();

handler.onMessage(event => {
  console.log(`${event.role}: ${event.text}`);
});

handler.onTool(event => {
  if (event.phase === 'start') {
    console.log(`Starting ${event.name}`);
  }
});
```

### Creating Events

```typescript
import { MessageEvent, ToolEvent } from '@agent-io/core';

// Create a message event
const message: MessageEvent = {
  t: 'msg',
  role: 'assistant',
  text: 'Hello! How can I help you today?',
  timestamp: Date.now(),
};

// Create a tool event
const toolStart: ToolEvent = {
  t: 'tool',
  name: 'calculator',
  phase: 'start',
};

const toolOutput: ToolEvent = {
  t: 'tool',
  name: 'calculator',
  phase: 'stdout',
  text: 'Result: 42',
};
```

## TypeScript Support

This package is written in TypeScript and provides full type definitions. It uses strict type
checking and is designed to help you catch errors at compile time.

### Strict Event Discrimination

The `t` field acts as a discriminator for TypeScript's type narrowing:

```typescript
function handleEvent(event: AgentEvent) {
  switch (event.t) {
    case 'msg':
      // TypeScript knows event is MessageEvent
      console.log(event.role);
      break;
    case 'tool':
      // TypeScript knows event is ToolEvent
      console.log(event.name);
      break;
    case 'cost':
      // TypeScript knows event is CostEvent
      console.log(event.deltaUsd);
      break;
  }
}
```

### Exhaustive Checking

Use TypeScript's exhaustive checking to ensure all event types are handled:

```typescript
function assertNever(x: never): never {
  throw new Error('Unexpected event type');
}

function handleAllEvents(event: AgentEvent) {
  switch (event.t) {
    case 'msg':
      handleMessage(event);
      break;
    case 'tool':
      handleTool(event);
      break;
    case 'cost':
      handleCost(event);
      break;
    case 'error':
      handleError(event);
      break;
    case 'debug':
      handleDebug(event);
      break;
    default:
      // TypeScript error if any case is missing
      assertNever(event);
  }
}
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.
