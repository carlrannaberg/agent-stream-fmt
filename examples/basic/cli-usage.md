# CLI Usage Examples

This guide demonstrates command-line interface usage for all supported AI agent vendors.

## Installation

```bash
# Install globally for CLI access
npm install -g agent-stream-fmt

# Or use with npx
npx agent-stream-fmt --help
```

## Basic Usage

### Auto-Detection (Recommended)

The CLI automatically detects the vendor format from input:

```bash
# Claude Code output
claude --json "explain recursion" | agent-stream-fmt

# Gemini CLI output
gemini --jsonl -i task.md | agent-stream-fmt

# Amp Code output
amp-code run build.yml -j | agent-stream-fmt
```

### Explicit Vendor Selection

Specify the vendor when auto-detection isn't working:

```bash
# Force Claude parser
cat claude-session.jsonl | agent-stream-fmt --vendor claude

# Force Gemini parser
cat gemini-output.jsonl | agent-stream-fmt --vendor gemini

# Force Amp parser
cat amp-logs.jsonl | agent-stream-fmt --vendor amp
```

## Output Formats

### Terminal (ANSI) - Default

Beautiful colored output for terminal viewing:

```bash
# Default ANSI output with colors
claude --json "write a hello world script" | agent-stream-fmt

# Explicit ANSI format
claude --json "explain git" | agent-stream-fmt --format ansi
```

### HTML Output

Generate HTML for web display or documentation:

```bash
# HTML output to file
claude --json "create a todo app" | agent-stream-fmt --html > session.html

# Explicit HTML format
gemini --jsonl -i prompt.md | agent-stream-fmt --format html --output report.html
```

### JSON Output

Machine-readable JSON for further processing:

```bash
# JSON output for parsing
amp-code run test.yml -j | agent-stream-fmt --json > events.json

# Pipe to jq for analysis
claude --json "analyze this code" | agent-stream-fmt --json | jq '.[] | select(.t == "tool")'
```

## Filtering Options

### Hide Event Types

```bash
# Hide tool execution details
claude --json "run tests" | agent-stream-fmt --hide-tools

# Hide cost information
gemini --jsonl -i expensive-task.md | agent-stream-fmt --hide-cost

# Hide debug events
amp-code run complex.yml -j | agent-stream-fmt --hide-debug

# Hide multiple types
claude --json "complex task" | agent-stream-fmt --hide-tools --hide-cost --hide-debug
```

### Show Only Specific Types

```bash
# Show only messages and errors
cat session.jsonl | agent-stream-fmt --only msg,error

# Show only tool events
cat debug-session.jsonl | agent-stream-fmt --only tool

# Show only cost events for billing analysis
cat expensive-session.jsonl | agent-stream-fmt --only cost
```

### Tool Output Formatting

```bash
# Collapse tool output sections for overview
claude --json "run complex build" | agent-stream-fmt --collapse-tools

# Combine with filtering for clean output
claude --json "development task" | agent-stream-fmt --collapse-tools --hide-debug
```

## Real-World Examples

### Development Workflow

```bash
# Monitor build process with clean output
amp-code run ci.yml -j | agent-stream-fmt --collapse-tools --hide-debug

# Debug failing tests with full detail
claude --json "fix failing tests" | agent-stream-fmt --only tool,error

# Generate HTML report of coding session
claude --json "implement feature X" | agent-stream-fmt --html > feature-x-development.html
```

### Analysis and Reporting

```bash
# Extract only assistant messages for review
cat long-session.jsonl | agent-stream-fmt --only msg --json | jq '.[] | select(.role == "assistant") | .text'

# Monitor costs across sessions
find logs/ -name "*.jsonl" | xargs cat | agent-stream-fmt --only cost --json | jq '[.[] | .deltaUsd] | add'

# Generate error summary
cat error-session.jsonl | agent-stream-fmt --only error --json | jq '[.[] | .message] | unique'
```

### Integration with Other Tools

```bash
# Combine with watch for live monitoring
watch -n 1 'tail -n 20 live-session.jsonl | agent-stream-fmt --collapse-tools'

# Use with tee to save formatted output
claude --json "document API" | tee raw-session.jsonl | agent-stream-fmt --html > api-docs.html

# Process multiple files
for file in sessions/*.jsonl; do
  echo "Processing $file..."
  agent-stream-fmt < "$file" --html > "reports/$(basename "$file" .jsonl).html"
done
```

## Vendor-Specific Examples

### Claude Code

```bash
# Basic code assistance
claude --json "help me optimize this function" | agent-stream-fmt

# File editing with tool visibility
claude --json -f myfile.py "add error handling" | agent-stream-fmt --collapse-tools

# Complex task with clean output
claude --json "refactor entire module" | agent-stream-fmt --hide-debug --collapse-tools
```

### Gemini CLI

```bash
# Content generation
gemini --jsonl -i prompt.md | agent-stream-fmt --html > content.html

# Code analysis
gemini --jsonl "analyze code quality in src/" | agent-stream-fmt --only msg,error

# Multi-modal tasks
gemini --jsonl -i image.png "describe this diagram" | agent-stream-fmt
```

### Amp Code

```bash
# Build process monitoring
amp-code run build.yml -j | agent-stream-fmt --collapse-tools

# Test execution with error focus
amp-code run test.yml -j | agent-stream-fmt --only tool,error

# Deployment pipeline
amp-code run deploy.yml -j | agent-stream-fmt --hide-debug > deployment.log
```

## Advanced CLI Patterns

### Error Handling

```bash
# Gracefully handle malformed input
cat possibly-corrupt.jsonl | agent-stream-fmt 2>/dev/null || echo "Parse errors encountered"

# Show parse errors explicitly
cat mixed-format.jsonl | agent-stream-fmt --vendor auto 2>&1 | grep -E "(ERROR|WARN)"
```

### Performance Monitoring

```bash
# Time processing large files
time cat large-session.jsonl | agent-stream-fmt > /dev/null

# Monitor memory usage
/usr/bin/time -v agent-stream-fmt < huge-file.jsonl > /dev/null
```

### Customization

```bash
# Set output width for formatting
COLUMNS=120 claude --json "write documentation" | agent-stream-fmt

# Disable colors for piping
NO_COLOR=1 claude --json "analyze data" | agent-stream-fmt | mail -s "Analysis" user@example.com
```

## Troubleshooting

### Common Issues

**No output appearing:**

```bash
# Check if input is valid JSONL
head -1 input.jsonl | jq .

# Try explicit vendor detection
agent-stream-fmt --vendor claude < input.jsonl
```

**Garbled colors in output:**

```bash
# Disable colors
NO_COLOR=1 agent-stream-fmt < input.jsonl

# Use explicit format
agent-stream-fmt --format json < input.jsonl
```

**Memory issues with large files:**

```bash
# Stream process large files
tail -f large-session.jsonl | agent-stream-fmt --collapse-tools
```

### Environment Variables

```bash
# Disable colors
export NO_COLOR=1

# Set debug mode
export DEBUG=agent-stream-fmt:*

# Customize output width
export COLUMNS=80
```

## Performance Tips

1. **Use --collapse-tools** for large tool outputs
2. **Filter early** with --only for faster processing
3. **Pipe to head** to preview large files: `... | agent-stream-fmt | head -50`
4. **Use --json** for machine processing instead of ANSI
5. **Process in chunks** for extremely large files

## Next Steps

- Try the [Stream API examples](./stream-api.js) for programmatic usage
- Explore [filtering examples](./filter-events.js) for advanced event processing
- Check [integration examples](../integrations/) for real-world applications
