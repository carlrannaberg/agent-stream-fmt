# @agent-io/invoke

CLI functionality and utilities for AI agent CLIs.

## Installation

```bash
npm install @agent-io/invoke
# or
yarn add @agent-io/invoke
# or
pnpm add @agent-io/invoke
```

## Usage

This package provides CLI building blocks and utilities for creating AI agent command-line
interfaces.

```typescript
import { createCLI, CommandBuilder } from '@agent-io/invoke';

// Build a CLI with streaming support
const cli = createCLI({
  name: 'my-agent',
  version: '1.0.0',
  description: 'AI agent with streaming output',
});

cli
  .command('chat [message]')
  .description('Start a chat session')
  .option('-f, --format <type>', 'Output format', 'ansi')
  .option('--stream', 'Enable streaming output', true)
  .action(async (message, options) => {
    // Handle chat command
  });

cli.parse(process.argv);
```

## API Reference

### CLI Builder

#### `createCLI(options: CLIOptions): CLI`

Create a new CLI instance with streaming capabilities:

```typescript
interface CLIOptions {
  name: string;
  version: string;
  description?: string;
  streamDefaults?: {
    vendor?: 'auto' | 'claude' | 'gemini' | 'amp';
    format?: 'ansi' | 'html' | 'json';
  };
}
```

#### `CLI` Methods

```typescript
interface CLI {
  // Add a command
  command(name: string): CommandBuilder;

  // Add global option
  option(flags: string, description: string, defaultValue?: any): CLI;

  // Set custom help
  help(text: string): CLI;

  // Parse arguments
  parse(argv: string[]): void;

  // Get parsed options
  opts(): Record<string, any>;
}
```

### Command Builder

#### `CommandBuilder` Methods

```typescript
interface CommandBuilder {
  // Set command description
  description(text: string): CommandBuilder;

  // Add command option
  option(flags: string, description: string, defaultValue?: any): CommandBuilder;

  // Set command action
  action(handler: CommandHandler): CommandBuilder;

  // Add argument
  argument(name: string, description?: string): CommandBuilder;

  // Set streaming options
  stream(options: StreamOptions): CommandBuilder;
}

type CommandHandler = (
  ...args: any[],
  options: Record<string, any>,
  command: Command,
) => void | Promise<void>;
```

### Streaming Integration

#### `withStreaming(handler: StreamHandler): CommandHandler`

Wrap a command handler with streaming support:

```typescript
import { withStreaming } from '@agent-io/invoke';
import { streamEvents } from '@agent-io/stream';

const chatHandler = withStreaming(async ({ args, options, stream }) => {
  const response = await callAIAgent(args[0]);

  // Stream the response
  for await (const event of streamEvents({
    vendor: options.vendor || 'auto',
    source: response.stream,
  })) {
    await stream.write(event);
  }
});

cli
  .command('chat <message>')
  .option('-v, --vendor <type>', 'AI vendor', 'auto')
  .action(chatHandler);
```

### Output Formatting

#### `formatOutput(options: FormatOptions): OutputFormatter`

Create an output formatter:

```typescript
interface FormatOptions {
  format: 'ansi' | 'html' | 'json' | 'plain';
  colors?: boolean;
  timestamps?: boolean;
  compact?: boolean;
}

const formatter = formatOutput({
  format: 'ansi',
  colors: true,
  timestamps: false,
});

// Use formatter
const output = formatter.format(event);
console.log(output);
```

### Progress Indicators

#### `createProgress(options?: ProgressOptions): Progress`

Create progress indicators for long-running operations:

```typescript
interface ProgressOptions {
  format?: 'spinner' | 'bar' | 'dots';
  message?: string;
  total?: number;
}

const progress = createProgress({
  format: 'spinner',
  message: 'Processing...',
});

progress.start();
// Do work...
progress.update('Almost done...');
progress.stop('Complete!');
```

## Examples

### Basic CLI Application

```typescript
import { createCLI } from '@agent-io/invoke';

const cli = createCLI({
  name: 'agent-cli',
  version: '1.0.0',
  description: 'AI agent command-line interface',
});

// Global options
cli
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-color', 'Disable colored output')
  .option('-o, --output <file>', 'Output file');

// Chat command
cli
  .command('chat <message>')
  .description('Send a message to the AI agent')
  .option('-m, --model <name>', 'Model to use', 'gpt-4')
  .option('-t, --temperature <value>', 'Temperature setting', '0.7')
  .action(async (message, options) => {
    console.log(`Chatting with ${options.model}...`);
    console.log(`Message: ${message}`);
    // Implementation...
  });

// Stream command with formatting
cli
  .command('stream <prompt>')
  .description('Stream AI responses')
  .option('-f, --format <type>', 'Output format', 'ansi')
  .action(async (prompt, options) => {
    const response = await getAIStream(prompt);

    for await (const chunk of response) {
      if (options.format === 'ansi') {
        console.log(formatAnsi(chunk));
      } else {
        console.log(chunk);
      }
    }
  });

cli.parse(process.argv);
```

### Streaming AI Output

```typescript
import { createCLI, withStreaming } from '@agent-io/invoke';
import { streamFormat } from '@agent-io/stream';

const cli = createCLI({
  name: 'stream-agent',
  version: '1.0.0',
  streamDefaults: {
    vendor: 'auto',
    format: 'ansi',
  },
});

cli
  .command('run <task>')
  .description('Run an AI task with streaming output')
  .option('--vendor <type>', 'AI vendor')
  .option('--format <type>', 'Output format')
  .option('--collapse-tools', 'Collapse tool output')
  .action(
    withStreaming(async ({ args, options, stream }) => {
      const [task] = args;
      const aiResponse = await runAITask(task);

      // Stream formatted output
      for await (const output of streamFormat({
        vendor: options.vendor,
        source: aiResponse.stream,
        format: options.format,
        collapseTools: options.collapseTools,
      })) {
        process.stdout.write(output);
      }
    }),
  );

cli.parse(process.argv);
```

### Interactive Mode

```typescript
import { createCLI, createPrompt } from '@agent-io/invoke';

const cli = createCLI({
  name: 'interactive-agent',
  version: '1.0.0',
});

cli
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    const prompt = createPrompt({
      message: 'agent> ',
      history: true,
    });

    console.log('Interactive mode. Type "exit" to quit.');

    while (true) {
      const input = await prompt.ask();

      if (input === 'exit') break;

      // Process input
      const response = await processCommand(input);
      console.log(response);
    }

    prompt.close();
  });

cli.parse(process.argv);
```

### File Processing

```typescript
import { createCLI } from '@agent-io/invoke';
import { createReadStream } from 'fs';

const cli = createCLI({
  name: 'file-processor',
  version: '1.0.0',
});

cli
  .command('process <file>')
  .description('Process JSONL file')
  .option('-o, --output <file>', 'Output file')
  .option('--stats', 'Show statistics')
  .action(async (file, options) => {
    const input = createReadStream(file);
    let eventCount = 0;

    for await (const event of streamEvents({
      vendor: 'auto',
      source: input,
    })) {
      eventCount++;

      if (options.output) {
        await writeOutput(options.output, event);
      } else {
        console.log(JSON.stringify(event));
      }
    }

    if (options.stats) {
      console.log(`\nProcessed ${eventCount} events`);
    }
  });

cli.parse(process.argv);
```

### Error Handling

```typescript
import { createCLI, CLIError } from '@agent-io/invoke';

const cli = createCLI({
  name: 'error-aware-cli',
  version: '1.0.0',
});

// Custom error handler
cli.on('error', (error: CLIError) => {
  if (error.code === 'INVALID_ARGUMENT') {
    console.error(`Invalid argument: ${error.message}`);
    console.error('Use --help for usage information');
  } else if (error.code === 'COMMAND_NOT_FOUND') {
    console.error(`Unknown command: ${error.command}`);
    console.error('Available commands:');
    cli.commands.forEach(cmd => {
      console.error(`  ${cmd.name()} - ${cmd.description()}`);
    });
  } else {
    console.error(`Error: ${error.message}`);
  }

  process.exit(1);
});

cli
  .command('validate <input>')
  .description('Validate input')
  .action(async input => {
    if (!isValid(input)) {
      throw new CLIError('INVALID_ARGUMENT', `Invalid input: ${input}`);
    }

    console.log('Input is valid!');
  });

cli.parse(process.argv);
```

## Advanced Features

### Custom Output Handlers

```typescript
import { createCLI, OutputHandler } from '@agent-io/invoke';

class TableOutputHandler implements OutputHandler {
  private rows: any[] = [];

  write(data: any): void {
    this.rows.push(data);
  }

  flush(): void {
    console.table(this.rows);
    this.rows = [];
  }
}

const cli = createCLI({
  name: 'table-cli',
  version: '1.0.0',
});

cli
  .command('list')
  .option('--table', 'Output as table')
  .action(async options => {
    const handler = options.table ? new TableOutputHandler() : new DefaultOutputHandler();

    const items = await fetchItems();
    items.forEach(item => handler.write(item));
    handler.flush();
  });
```

### Plugin System

```typescript
import { createCLI, Plugin } from '@agent-io/invoke';

// Define a plugin
const loggingPlugin: Plugin = {
  name: 'logging',

  install(cli) {
    cli.on('command:before', (cmd, args) => {
      console.log(`Running command: ${cmd.name()}`);
      console.log(`Arguments:`, args);
    });

    cli.on('command:after', (cmd, result) => {
      console.log(`Command completed: ${cmd.name()}`);
    });

    cli.on('command:error', (cmd, error) => {
      console.error(`Command failed: ${cmd.name()}`);
      console.error(error);
    });
  },
};

// Use plugin
const cli = createCLI({
  name: 'plugin-cli',
  version: '1.0.0',
  plugins: [loggingPlugin],
});
```

### Configuration Management

```typescript
import { createCLI, loadConfig, saveConfig } from '@agent-io/invoke';

const cli = createCLI({
  name: 'configurable-cli',
  version: '1.0.0',
});

cli
  .command('config set <key> <value>')
  .description('Set configuration value')
  .action(async (key, value) => {
    const config = await loadConfig();
    config[key] = value;
    await saveConfig(config);
    console.log(`Set ${key} = ${value}`);
  });

cli
  .command('config get <key>')
  .description('Get configuration value')
  .action(async key => {
    const config = await loadConfig();
    console.log(config[key] || 'Not set');
  });

cli
  .command('config list')
  .description('List all configuration')
  .action(async () => {
    const config = await loadConfig();
    Object.entries(config).forEach(([key, value]) => {
      console.log(`${key} = ${value}`);
    });
  });
```

## Testing

### Unit Testing CLI Commands

```typescript
import { describe, it, expect } from 'vitest';
import { createCLI, MockStream } from '@agent-io/invoke';

describe('CLI Commands', () => {
  it('should handle chat command', async () => {
    const output = new MockStream();
    const cli = createCLI({
      name: 'test-cli',
      version: '1.0.0',
      output,
    });

    cli.command('chat <message>').action(async message => {
      output.write(`Received: ${message}`);
    });

    await cli.parseAsync(['node', 'test', 'chat', 'Hello']);

    expect(output.toString()).toContain('Received: Hello');
  });
});
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.
