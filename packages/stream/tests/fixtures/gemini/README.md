# Gemini CLI Fixtures

This directory contains JSONL output samples from Gemini CLI.

## Gemini CLI JSONL Format

Gemini CLI uses the `--jsonl` flag to output structured JSONL data. The format may include:

- Content generation events
- Code blocks
- Reasoning steps
- Error messages
- Metadata events

## Common Event Types

Based on our analysis, Gemini CLI typically emits these event types:

- `content` - Generated content
- `code` - Code generation events
- `reasoning` - Reasoning/thinking steps
- `error` - Error events
- `metadata` - Session metadata

## Capture Examples

```bash
# Basic content generation
gemini --jsonl "explain the concept of dependency injection"

# Code generation
gemini --jsonl "write a React component for a todo list"

# Multi-turn conversation
gemini --stream-json -i conversation.txt

# Complex reasoning task
gemini --jsonl "compare and contrast different sorting algorithms"
```

## Notes

- Gemini CLI requires the `--jsonl` or `--stream-json` flag for JSONL output
- Output format may vary between different Gemini CLI versions
- Some versions use `--stream-json` instead of `--jsonl`
- Check your Gemini CLI version with `gemini --version`
- Multi-turn conversations can be provided via input file with `-i` flag
