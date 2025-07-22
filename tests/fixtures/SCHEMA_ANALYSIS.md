# JSONL Schema Analysis Report

Generated on: 2025-07-17T06:30:50.682Z

## CLAUDE

### basic-message.jsonl

- Lines: 3
- Parse errors: 0

**Event Types:**

- `message`: 2 occurrences
- `usage`: 1 occurrences

**Unique Keys (6 total):** `content`, `input_tokens`, `output_tokens`, `role`, `total_tokens`,
`type`

**Sample Events:**

_message:_

```json
{
  "type": "message",
  "role": "user",
  "content": "write a hello world function"
}
```

_usage:_

```json
{
  "type": "usage",
  "input_tokens": 12,
  "output_tokens": 35,
  "total_tokens": 47
}
```

### complex-session.jsonl

- Lines: 9
- Parse errors: 0

**Event Types:**

- `message`: 4 occurrences
- `tool_use`: 2 occurrences
- `tool_result`: 2 occurrences
- `usage`: 1 occurrences

**Unique Keys (12 total):** `content`, `id`, `input`, `input.content`, `input.path`, `input_tokens`,
`name`, `output_tokens`, `role`, `tool_use_id`, `total_tokens`, `type`

**Sample Events:**

_message:_

```json
{
  "type": "message",
  "role": "user",
  "content": "I need to create a REST API with user authentication"
}
```

_tool_use:_

```json
{
  "type": "tool_use",
  "id": "tool_1",
  "name": "create_file",
  "input": {
    "path": "server.js",
    "content": "const express = require('express');"
  }
}
```

_tool_result:_

```json
{
  "type": "tool_result",
  "tool_use_id": "tool_1",
  "content": "File created successfully"
}
```

_usage:_

```json
{
  "type": "usage",
  "input_tokens": 125,
  "output_tokens": 245,
  "total_tokens": 370
}
```

### error-handling.jsonl

- Lines: 5
- Parse errors: 2

**Event Types:**

- `message`: 2 occurrences
- `error`: 1 occurrences

**Unique Keys (5 total):** `content`, `level`, `message`, `role`, `type`

**Sample Events:**

_message:_

```json
{
  "type": "message",
  "role": "user",
  "content": "explain this error: TypeError: Cannot read property 'x' of undefined"
}
```

_error:_

```json
{
  "type": "error",
  "level": "warning",
  "message": "Parsing error detected"
}
```

**Parse Errors:**

- Line 2: Expected property name or '}' in JSON at position 1 (line 1 column 2)
- Line 5: Unexpected token '}', "{"broken":}" is not valid JSON

### tool-use.jsonl

- Lines: 5
- Parse errors: 0

**Event Types:**

- `message`: 2 occurrences
- `tool_use`: 1 occurrences
- `tool_result`: 1 occurrences
- `usage`: 1 occurrences

**Unique Keys (12 total):** `content`, `id`, `input`, `input.command`, `input_tokens`, `name`,
`output`, `output_tokens`, `role`, `tool_use_id`, `total_tokens`, `type`

**Sample Events:**

_message:_

```json
{
  "type": "message",
  "role": "user",
  "content": "run npm test and show results"
}
```

_tool_use:_

```json
{
  "type": "tool_use",
  "id": "tool_123",
  "name": "bash",
  "input": {
    "command": "npm test"
  }
}
```

_tool_result:_

```json
{
  "type": "tool_result",
  "tool_use_id": "tool_123",
  "content": "stdout",
  "output": "Test Suites: 3 passed, 3 total\nTests: 15 passed, 15 total\nTime: 2.341s"
}
```

_usage:_

```json
{
  "type": "usage",
  "input_tokens": 18,
  "output_tokens": 52,
  "total_tokens": 70
}
```

## GEMINI

### basic-content.jsonl

- Lines: 0
- Parse errors: 0

**Event Types:**

**Unique Keys (0 total):** ``

**Sample Events:**

### code-generation.jsonl

- Lines: 0
- Parse errors: 0

**Event Types:**

**Unique Keys (0 total):** ``

**Sample Events:**

## AMP

### build-process.jsonl

- Lines: 0
- Parse errors: 0

**Event Types:**

**Unique Keys (0 total):** ``

**Sample Events:**

### simple-task.jsonl

- Lines: 0
- Parse errors: 0

**Event Types:**

**Unique Keys (0 total):** ``

**Sample Events:**

### test-execution.jsonl

- Lines: 0
- Parse errors: 0

**Event Types:**

**Unique Keys (0 total):** ``

**Sample Events:**

## Summary

- Total fixture files: 9
- Total lines analyzed: 22
- Total parse errors: 2

**All Event Types Across Vendors:**

- `message`: 10 total occurrences
- `usage`: 3 total occurrences
- `tool_use`: 3 total occurrences
- `tool_result`: 3 total occurrences
- `error`: 1 total occurrences
