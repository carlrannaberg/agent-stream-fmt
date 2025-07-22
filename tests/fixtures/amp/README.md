# Amp Code Fixtures

This directory contains JSONL output samples from Amp Code CLI.

## Amp Code JSONL Format

Amp Code uses the `-j` flag or `--output jsonl` to output structured JSONL data. The format
typically includes:

- Task execution events
- Build process updates
- Test results
- Command outputs
- Error events

## Common Event Types

Based on our analysis, Amp Code typically emits these event types:

- `task` - Task execution events
- `output` - Command/process output
- `status` - Status updates
- `error` - Error events
- `result` - Final results

## Capture Examples

```bash
# Simple task execution
amp-code run hello-world.yml -j

# Build process with JSONL output
amp-code run build-app.yml --output jsonl

# Test execution
amp-code run test-suite.yml -j

# Complex workflow
amp-code run deploy-pipeline.yml --output jsonl
```

## Notes

- Amp Code requires the `-j` flag or `--output jsonl` for JSONL output
- YAML files define the tasks to be executed
- Output includes real-time updates as tasks progress
- Each line represents a discrete event in the execution pipeline
- Error events include stack traces and debugging information
