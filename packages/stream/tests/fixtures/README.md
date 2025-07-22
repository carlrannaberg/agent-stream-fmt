# Test Fixtures

This directory contains JSONL output samples from various AI agent CLIs. These fixtures are
essential for developing and testing the parsing and formatting logic.

## Directory Structure

- `claude/` - Claude Code JSONL outputs
- `gemini/` - Gemini CLI JSONL outputs
- `amp/` - Amp Code JSONL outputs

## Capturing New Fixtures

### Manual Capture

You can manually capture fixtures using the following commands:

```bash
# Claude Code examples
claude --json "write a hello world function in Python" > tests/fixtures/claude/basic-message.jsonl
claude --json "run the tests and fix any failures" > tests/fixtures/claude/tool-use.jsonl

# Gemini CLI examples (if available)
gemini --jsonl "explain how recursion works" > tests/fixtures/gemini/basic-content.txt
gemini --jsonl "write a sorting algorithm" > tests/fixtures/gemini/code-generation.txt

# Amp Code examples (if available)
amp-code run hello-world.yml -j > tests/fixtures/amp/simple-task.jsonl
amp-code run build-app.yml --output jsonl > tests/fixtures/amp/build-process.jsonl
```

### Automated Capture

Use the capture script to automatically generate fixtures:

```bash
npm run fixtures:capture
```

This will run predefined test cases and save the outputs to the appropriate directories.

## Analyzing Fixtures

To analyze the captured fixtures and understand the schema:

```bash
npm run fixtures:analyze
```

This generates a report in `SCHEMA_ANALYSIS.md` with:

- Event type frequencies
- Unique JSON keys found
- Sample events for each type
- Parsing errors (if any)

## Validating Fixtures

To ensure all fixtures are valid JSONL:

```bash
npm run fixtures:validate
```

## Adding New Fixtures

When adding new fixtures:

1. Use descriptive filenames that indicate the scenario
2. Ensure no sensitive data (API keys, personal info) is included
3. Try to capture diverse scenarios including:
   - Basic operations
   - Tool/command execution
   - Error scenarios
   - Multi-turn conversations
   - Streaming responses

## Fixture Naming Convention

- `basic-*.jsonl` - Simple, single-turn interactions
- `tool-*.jsonl` - Fixtures involving tool/command execution
- `error-*.jsonl` - Error scenarios and handling
- `streaming-*.jsonl` - Streaming response examples
- `complex-*.jsonl` - Multi-turn or complex scenarios

## Notes

- All fixtures should be valid JSONL (one JSON object per line)
- Keep fixture files reasonably sized (< 1MB preferred)
- Commit fixtures to git for version tracking
- Review fixtures before committing to ensure no sensitive data
