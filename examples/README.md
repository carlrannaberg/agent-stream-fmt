# Agent Stream Formatter Examples

This directory contains comprehensive examples demonstrating all major features of the
agent-stream-fmt library. These examples showcase real-world usage patterns for parsing, formatting,
and integrating AI agent CLI outputs.

## Quick Start

```bash
# Install the library
npm install agent-stream-fmt

# Run a basic example
node examples/basic/stream-api.js

# Try the CLI
echo '{"type":"message","role":"assistant","content":"Hello world"}' | npx agent-stream-fmt
```

## Example Categories

### 📚 [Basic Examples](./basic/)

Essential usage patterns for getting started:

- **[CLI Usage](./basic/cli-usage.md)** - Command-line interface examples for all vendors
- **[Stream API](./basic/stream-api.js)** - Basic streaming API usage and event handling
- **[Filter Events](./basic/filter-events.js)** - Event filtering and selective processing

### 🔧 [Advanced Examples](./advanced/)

Advanced features and customization:

- **[Custom Renderer](./advanced/custom-renderer.js)** - Build your own output renderer
- **[Error Handling](./advanced/error-handling.js)** - Robust error handling patterns
- **[Performance](./advanced/performance.js)** - Performance optimization techniques
- **[Multi-Vendor](./advanced/multi-vendor.js)** - Handle mixed vendor formats

### 🌐 [Integrations](./integrations/)

Real-world integration examples:

- **[Express Server](./integrations/express-server.js)** - Web server with streaming responses
- **[Discord Bot](./integrations/discord-bot.js)** - Discord bot with formatted outputs
- **[Log Analyzer](./integrations/log-analyzer.js)** - Log analysis and reporting tool

### ⚡ [Benchmarks](./benchmarks/)

Performance testing and measurement:

- **[Throughput Test](./benchmarks/throughput-test.js)** - Measure processing throughput
- **[Memory Test](./benchmarks/memory-test.js)** - Monitor memory usage patterns

## Prerequisites

All examples require Node.js 18+ and assume you have the agent-stream-fmt library installed:

```bash
npm install agent-stream-fmt
```

Some integration examples have additional dependencies documented in their respective files.

## Running Examples

Each example is designed to be executable. Most basic and advanced examples can be run directly:

```bash
# Basic examples
node examples/basic/stream-api.js
node examples/basic/filter-events.js

# Advanced examples
node examples/advanced/custom-renderer.js
node examples/advanced/error-handling.js

# Benchmark examples
node examples/benchmarks/throughput-test.js
```

Integration examples may require additional setup (environment variables, external services) as
documented in each file.

## Example Data

Examples use real fixture data from the `tests/fixtures/` directory:

- **Claude fixtures**: Real Claude Code CLI outputs
- **Gemini fixtures**: Real Gemini CLI outputs
- **Amp fixtures**: Real Amp Code CLI outputs

This ensures examples demonstrate actual usage patterns rather than synthetic data.

## Features Demonstrated

### Core Library Features

- ✅ **Streaming processing** - Memory-efficient line-by-line processing
- ✅ **Multi-vendor support** - Claude Code, Gemini CLI, Amp Code
- ✅ **Auto-detection** - Automatic vendor format detection
- ✅ **Event filtering** - Filter by event type, hide tools/costs/debug
- ✅ **Multiple renderers** - ANSI terminal, HTML, JSON output

### Advanced Features

- ✅ **Custom renderers** - Build your own output formatters
- ✅ **Error recovery** - Graceful handling of malformed input
- ✅ **Performance optimization** - High-throughput streaming
- ✅ **Integration patterns** - Web servers, bots, analysis tools

### CLI Features

- ✅ **Format detection** - Auto-detect vendor from input
- ✅ **Output formats** - Terminal (ANSI), HTML, JSON
- ✅ **Filtering options** - Show/hide specific event types
- ✅ **Pipe support** - Standard Unix pipe integration

## Contributing Examples

When adding new examples:

1. **Keep it practical** - Demonstrate real-world usage patterns
2. **Add clear comments** - Explain what each section does
3. **Make it runnable** - Ensure examples execute without modification
4. **Use real data** - Leverage fixtures rather than synthetic data
5. **Document dependencies** - List any external requirements
6. **Follow conventions** - Match existing code style and structure

## Troubleshooting

### Common Issues

**Module not found errors:**

```bash
# Ensure the library is built
npm run build

# Install dependencies
npm install
```

**Permission errors on Unix systems:**

```bash
# Make scripts executable
chmod +x examples/benchmarks/*.js
```

**TypeScript import errors:**

```bash
# Use .js extensions in imports for ESM compatibility
import { streamEvents } from 'agent-stream-fmt';
```

### Getting Help

- Check the [API documentation](../docs/api/)
- Review [test files](../tests/) for usage patterns
- Open an [issue](https://github.com/yourusername/agent-stream-fmt/issues) for bugs

## License

All examples are released under the same MIT license as the main library.
