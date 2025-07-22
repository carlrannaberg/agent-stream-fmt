# Claude Code Fixtures

This directory contains JSONL output samples from Claude Code CLI.

## Claude Code JSONL Format

Claude Code uses the `--json` flag to output structured JSONL data. The format typically includes:

- Assistant messages
- Tool use events
- Tool results
- Thinking/reasoning steps
- Error messages

## Common Event Types

Based on our analysis, Claude Code typically emits these event types:

- `message` - Assistant responses
- `tool_use` - Tool invocation events
- `tool_result` - Results from tool execution
- `error` - Error events
- `thinking` - Internal reasoning (if enabled)

## Capture Examples

```bash
# Basic conversation
claude --json "explain how to use git rebase"

# Tool usage
claude --json "create a Python function to calculate fibonacci numbers and test it"

# Error handling
claude --json "debug this error: TypeError: Cannot read property 'x' of undefined"

# Complex multi-step task
claude --json "refactor this code to use TypeScript and add unit tests"
```

## Notes

- Claude Code requires the `--json` flag for JSONL output
- Output is streamed line by line
- Each line is a valid JSON object
- Tool use typically involves paired `tool_use` and `tool_result` events
- Message chunks may be split across multiple events when streaming
