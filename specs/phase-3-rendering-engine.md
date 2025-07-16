# Phase 3: Rendering Engine Implementation

**Status**: Draft  
**Authors**: Claude Assistant  
**Date**: 2025-07-16  
**Version**: 1.0.0  

## Overview

Phase 3 transforms the agent-stream-fmt project from a functional streaming parser into a polished, human-readable formatting tool. This phase implements the rendering engine that converts normalized `AgentEvent` streams into beautifully formatted ANSI terminal output and semantic HTML, along with an enhanced CLI that provides the complete user experience specified in the main feature document.

## Background/Problem Statement

Phases 1 and 2 delivered a working streaming parser that can normalize vendor-specific JSONL into unified `AgentEvent` objects. However, the current output is raw JSON events, which are not suitable for human consumption. Phase 3 addresses this by:

1. **Raw JSON output**: Current `streamEvents` emits structured events but no human-readable formatting
2. **Missing visual hierarchy**: No distinction between message types, roles, or tool phases
3. **No terminal styling**: Plain text output lacks colors, emphasis, and visual structure
4. **Limited CLI features**: Basic functionality without filtering, formatting options, or user experience polish
5. **No HTML support**: Cannot generate web-friendly output for documentation or dashboards

## Goals

- **Beautiful terminal output**: ANSI-formatted text with colors, icons, and proper indentation
- **Semantic HTML generation**: Web-compatible output with CSS styling and accessibility features
- **Enhanced CLI experience**: Complete command-line interface with filtering, formatting options, and help
- **Flexible rendering system**: Extensible architecture supporting multiple output formats
- **Performance optimization**: Maintain streaming efficiency while adding rendering complexity
- **User-friendly defaults**: Sensible formatting that works well out-of-the-box

## Non-Goals

- **Not a web application**: HTML output is static, not interactive
- **Not a theme engine**: Single, well-designed style rather than customizable themes
- **Not a pager**: Does not implement scrolling or navigation features
- **Not a syntax highlighter**: Basic code formatting without language-specific highlighting
- **Not a rich text editor**: Read-only output formatting only

## Technical Dependencies

### Phase Prerequisites
- **Phase 1 Complete**: Core types (`AgentEvent`, `VendorParser`) and parser infrastructure
- **Phase 2 Complete**: `streamEvents` function, line reader, and basic CLI foundation

### External Dependencies
- **kleur**: ^4.1.5 (ANSI colors and styles, already specified in main spec)
- **Node.js**: >= 18.0.0 (native stream support)
- **TypeScript**: 5.x (type safety)

### New Dependencies (Optional)
- **@types/node**: For enhanced type definitions
- **escape-html**: For HTML entity escaping (or implement inline)

## Detailed Design

### Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ AgentEvent  │────▶│   Renderer   │────▶│   Styled    │
│   Stream    │     │   Factory    │     │   Output    │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   Format     │
                    │  Providers   │
                    │              │
                    │ ├─ ANSI      │
                    │ ├─ HTML      │
                    │ └─ JSON      │
                    └──────────────┘
```

### Core Rendering Types

```typescript
// src/render/types.ts
export interface RenderOptions {
  format: 'ansi' | 'html' | 'json';
  collapseTools?: boolean;
  hideTools?: boolean;
  hideCost?: boolean;
  hideDebug?: boolean;
  showTimestamps?: boolean;
  compactMode?: boolean;
  colorDisabled?: boolean;
}

export interface Renderer {
  render(event: AgentEvent): string;
  renderBatch(events: AgentEvent[]): string;
  flush(): string; // For any pending state
}

export interface RenderContext {
  previousEvent?: AgentEvent;
  toolStack: Map<string, ToolState>;
  messageCount: number;
  renderStartTime: number;
}

interface ToolState {
  name: string;
  startTime: number;
  outputLines: string[];
  collapsed: boolean;
}
```

### ANSI Renderer Implementation

```typescript
// src/render/ansi.ts
import { kleur } from 'kleur';
import { AgentEvent, RenderOptions } from '../types';

export class AnsiRenderer implements Renderer {
  private context: RenderContext;
  
  constructor(private options: RenderOptions) {
    this.context = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now()
    };
  }
  
  render(event: AgentEvent): string {
    // Update context
    this.context.previousEvent = event;
    
    switch (event.t) {
      case 'msg':
        return this.renderMessage(event);
      case 'tool':
        return this.renderTool(event);
      case 'cost':
        return this.renderCost(event);
      case 'error':
        return this.renderError(event);
      case 'debug':
        return this.renderDebug(event);
      default:
        return this.renderUnknown(event);
    }
  }
  
  private renderMessage(event: AgentEvent & { t: 'msg' }): string {
    this.context.messageCount++;
    
    const roleIcon = {
      'user': '👤',
      'assistant': '🤖',
      'system': '⚙️'
    }[event.role] || '❓';
    
    const roleColor = {
      'user': kleur.bold().cyan,
      'assistant': kleur.bold().green,
      'system': kleur.bold().yellow
    }[event.role] || kleur.bold().white;
    
    const header = roleColor(`${roleIcon} ${event.role}:`);
    const content = this.formatMessageContent(event.text);
    
    return `${header}\n${content}\n\n`;
  }
  
  private renderTool(event: AgentEvent & { t: 'tool' }): string {
    if (this.options.hideTools) return '';
    
    const toolKey = `${event.name}-${event.phase}`;
    
    switch (event.phase) {
      case 'start':
        this.context.toolStack.set(event.name, {
          name: event.name,
          startTime: Date.now(),
          outputLines: [],
          collapsed: this.options.collapseTools || false
        });
        
        const startIcon = kleur.dim().italic('🔧');
        const toolName = kleur.bold().blue(event.name);
        const input = event.text ? kleur.dim(` ${event.text}`) : '';
        
        return `${startIcon} ${toolName}${input}\n`;
        
      case 'stdout':
      case 'stderr':
        const toolState = this.context.toolStack.get(event.name);
        if (!toolState) return '';
        
        if (toolState.collapsed) {
          toolState.outputLines.push(event.text || '');
          return '';
        }
        
        const prefix = event.phase === 'stderr' 
          ? kleur.dim().red('  │ ')
          : kleur.dim().gray('  │ ');
        
        const lines = (event.text || '').split('\n');
        return lines.map(line => `${prefix}${line}`).join('\n') + '\n';
        
      case 'end':
        const endState = this.context.toolStack.get(event.name);
        if (!endState) return '';
        
        const duration = Date.now() - endState.startTime;
        const exitCode = event.exitCode || 0;
        
        let result = '';
        
        if (endState.collapsed && endState.outputLines.length > 0) {
          const summary = endState.outputLines.join('\n');
          result += kleur.dim().gray(`  └─ ${summary.slice(0, 100)}${summary.length > 100 ? '...' : ''}\n`);
        }
        
        const statusIcon = exitCode === 0 ? '✅' : '❌';
        const statusColor = exitCode === 0 ? kleur.green : kleur.red;
        const durationText = kleur.dim().gray(`(${duration}ms)`);
        
        result += `${statusIcon} ${statusColor(event.name)} ${durationText}\n`;
        
        this.context.toolStack.delete(event.name);
        return result;
        
      default:
        return kleur.dim().gray(`  │ ${event.phase}: ${event.text || ''}\n`);
    }
  }
  
  private renderCost(event: AgentEvent & { t: 'cost' }): string {
    if (this.options.hideCost) return '';
    
    const costIcon = '💰';
    const costText = kleur.dim().yellow(`$${event.deltaUsd.toFixed(4)}`);
    
    return `${costIcon} ${costText}\n`;
  }
  
  private renderError(event: AgentEvent & { t: 'error' }): string {
    const errorIcon = '🚨';
    const errorText = kleur.bold().red(event.message);
    
    return `${errorIcon} ${errorText}\n`;
  }
  
  private renderDebug(event: AgentEvent & { t: 'debug' }): string {
    if (this.options.hideDebug) return '';
    
    const debugIcon = kleur.dim().gray('🐛');
    const debugText = kleur.dim().gray(JSON.stringify(event.raw, null, 2));
    
    return `${debugIcon} ${debugText}\n`;
  }
  
  private formatMessageContent(text: string): string {
    // Basic markdown-like formatting
    const lines = text.split('\n');
    return lines.map(line => {
      // Code blocks
      if (line.startsWith('```')) {
        return kleur.dim().gray(line);
      }
      
      // Inline code
      line = line.replace(/`([^`]+)`/g, (_, code) => kleur.yellow(code));
      
      // Bold
      line = line.replace(/\*\*([^*]+)\*\*/g, (_, text) => kleur.bold(text));
      
      // Italic
      line = line.replace(/\*([^*]+)\*/g, (_, text) => kleur.italic(text));
      
      return `  ${line}`;
    }).join('\n');
  }
  
  renderBatch(events: AgentEvent[]): string {
    return events.map(event => this.render(event)).join('');
  }
  
  flush(): string {
    // Handle any pending tool output
    const pending = Array.from(this.context.toolStack.values())
      .map(tool => `⚠️  ${kleur.yellow('Tool still running:')} ${tool.name}`)
      .join('\n');
      
    return pending ? pending + '\n' : '';
  }
}
```

### HTML Renderer Implementation

```typescript
// src/render/html.ts
export class HtmlRenderer implements Renderer {
  private context: RenderContext;
  
  constructor(private options: RenderOptions) {
    this.context = {
      toolStack: new Map(),
      messageCount: 0,
      renderStartTime: Date.now()
    };
  }
  
  render(event: AgentEvent): string {
    this.context.previousEvent = event;
    
    switch (event.t) {
      case 'msg':
        return this.renderMessage(event);
      case 'tool':
        return this.renderTool(event);
      case 'cost':
        return this.renderCost(event);
      case 'error':
        return this.renderError(event);
      case 'debug':
        return this.renderDebug(event);
      default:
        return this.renderUnknown(event);
    }
  }
  
  private renderMessage(event: AgentEvent & { t: 'msg' }): string {
    const roleClass = `message-${event.role}`;
    const roleIcon = {
      'user': '👤',
      'assistant': '🤖',
      'system': '⚙️'
    }[event.role] || '❓';
    
    const content = this.escapeHtml(event.text)
      .replace(/\n/g, '<br>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    return `
      <div class="message ${roleClass}">
        <div class="message-header">
          <span class="role-icon">${roleIcon}</span>
          <span class="role-name">${event.role}</span>
        </div>
        <div class="message-content">${content}</div>
      </div>
    `;
  }
  
  private renderTool(event: AgentEvent & { t: 'tool' }): string {
    if (this.options.hideTools) return '';
    
    switch (event.phase) {
      case 'start':
        return `
          <div class="tool-execution" id="tool-${event.name}">
            <div class="tool-start">
              <span class="tool-icon">🔧</span>
              <span class="tool-name">${this.escapeHtml(event.name)}</span>
              ${event.text ? `<span class="tool-input">${this.escapeHtml(event.text)}</span>` : ''}
            </div>
            <div class="tool-output">
        `;
        
      case 'stdout':
      case 'stderr':
        const outputClass = event.phase === 'stderr' ? 'stderr' : 'stdout';
        const escapedText = this.escapeHtml(event.text || '');
        return `<div class="tool-${outputClass}">${escapedText}</div>`;
        
      case 'end':
        const statusClass = (event.exitCode || 0) === 0 ? 'success' : 'error';
        const statusIcon = (event.exitCode || 0) === 0 ? '✅' : '❌';
        
        return `
            </div>
            <div class="tool-end ${statusClass}">
              <span class="status-icon">${statusIcon}</span>
              <span class="tool-name">${this.escapeHtml(event.name)}</span>
              ${event.exitCode !== undefined ? `<span class="exit-code">Exit: ${event.exitCode}</span>` : ''}
            </div>
          </div>
        `;
        
      default:
        return `<div class="tool-${event.phase}">${this.escapeHtml(event.text || '')}</div>`;
    }
  }
  
  private renderCost(event: AgentEvent & { t: 'cost' }): string {
    if (this.options.hideCost) return '';
    
    return `
      <div class="cost-info">
        <span class="cost-icon">💰</span>
        <span class="cost-amount">$${event.deltaUsd.toFixed(4)}</span>
      </div>
    `;
  }
  
  private renderError(event: AgentEvent & { t: 'error' }): string {
    return `
      <div class="error-message">
        <span class="error-icon">🚨</span>
        <span class="error-text">${this.escapeHtml(event.message)}</span>
      </div>
    `;
  }
  
  private renderDebug(event: AgentEvent & { t: 'debug' }): string {
    if (this.options.hideDebug) return '';
    
    return `
      <div class="debug-info">
        <span class="debug-icon">🐛</span>
        <pre class="debug-content">${this.escapeHtml(JSON.stringify(event.raw, null, 2))}</pre>
      </div>
    `;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  
  renderBatch(events: AgentEvent[]): string {
    return events.map(event => this.render(event)).join('');
  }
  
  flush(): string {
    // Close any open tool executions
    const openTools = Array.from(this.context.toolStack.values())
      .map(tool => `</div><div class="tool-interrupted">⚠️ Tool interrupted: ${tool.name}</div></div>`)
      .join('');
      
    return openTools;
  }
}
```

### Enhanced Streaming API

```typescript
// src/stream.ts (enhanced)
export async function* streamFormat(opts: {
  vendor: Vendor;
  source: NodeJS.ReadableStream;
  format?: 'ansi' | 'html' | 'json';
  renderOptions?: RenderOptions;
}): AsyncIterator<string> {
  const renderer = createRenderer(opts.format || 'ansi', opts.renderOptions || {});
  
  for await (const event of streamEvents(opts)) {
    const formatted = renderer.render(event);
    if (formatted) {
      yield formatted;
    }
  }
  
  // Flush any pending output
  const final = renderer.flush();
  if (final) {
    yield final;
  }
}

function createRenderer(format: string, options: RenderOptions): Renderer {
  switch (format) {
    case 'ansi':
      return new AnsiRenderer(options);
    case 'html':
      return new HtmlRenderer(options);
    case 'json':
      return new JsonRenderer(options);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}
```

### Enhanced CLI Implementation

```typescript
// src/cli.ts (enhanced)
import { program } from 'commander';
import { streamFormat } from './stream';
import { Vendor } from './types';

interface CliOptions {
  vendor: Vendor;
  format: 'ansi' | 'html' | 'json';
  collapseTools: boolean;
  hideTools: boolean;
  hideCost: boolean;
  hideDebug: boolean;
  only?: string;
  output?: string;
  help: boolean;
}

async function main() {
  program
    .name('agent-stream-fmt')
    .description('Format JSONL output from AI agent CLIs')
    .version('1.0.0')
    .option('-v, --vendor <type>', 'vendor type (auto|claude|gemini|amp)', 'auto')
    .option('-f, --format <type>', 'output format (ansi|html|json)', 'ansi')
    .option('--collapse-tools', 'collapse tool output sections', false)
    .option('--hide-tools', 'hide tool execution entirely', false)
    .option('--hide-cost', 'hide cost information', false)
    .option('--hide-debug', 'hide debug events', true)
    .option('--only <types>', 'only show specific event types (comma-separated)')
    .option('-o, --output <file>', 'output file (default: stdout)')
    .option('--html', 'shorthand for --format html')
    .option('--json', 'shorthand for --format json')
    .addHelpText('after', `
Examples:
  claude --json "explain recursion" | agent-stream-fmt
  gemini --jsonl -i task.md | agent-stream-fmt --vendor gemini --hide-tools
  amp-code run build.yml -j | agent-stream-fmt --html > build-log.html
  cat session.jsonl | agent-stream-fmt --only tool,error --collapse-tools
  
Event types for --only:
  msg     - user/assistant/system messages
  tool    - tool execution (start/stdout/stderr/end)
  cost    - usage cost information
  error   - error messages
  debug   - debug information
  
Vendor auto-detection:
  - Automatically detects format from input
  - Supports claude, gemini, amp formats
  - Use --vendor to force specific parser
    `);
    
  program.parse();
  
  const opts = program.opts<CliOptions>();
  
  // Handle shorthand options
  if (opts.html) opts.format = 'html';
  if (opts.json) opts.format = 'json';
  
  // Setup output stream
  const output = opts.output 
    ? fs.createWriteStream(opts.output)
    : process.stdout;
  
  // Setup filtering
  const eventFilter = opts.only
    ? new Set(opts.only.split(',').map(s => s.trim()))
    : undefined;
  
  // Setup render options
  const renderOptions: RenderOptions = {
    format: opts.format,
    collapseTools: opts.collapseTools,
    hideTools: opts.hideTools,
    hideCost: opts.hideCost,
    hideDebug: opts.hideDebug
  };
  
  // Add HTML document wrapper for HTML output
  if (opts.format === 'html') {
    output.write(HTML_DOCUMENT_START);
  }
  
  try {
    for await (const formatted of streamFormat({
      vendor: opts.vendor as Vendor,
      source: process.stdin,
      format: opts.format,
      renderOptions
    })) {
      // Apply filtering if specified
      if (eventFilter) {
        // Note: This is a simplified version - real implementation would
        // need to parse the event type from the formatted output or
        // apply filtering at the event level
      }
      
      output.write(formatted);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (opts.format === 'html') {
      output.write(HTML_DOCUMENT_END);
    }
    
    if (opts.output) {
      output.end();
    }
  }
}

const HTML_DOCUMENT_START = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Stream Output</title>
  <style>
    body { font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; line-height: 1.6; margin: 20px; }
    .message { margin: 1em 0; padding: 1em; border-radius: 8px; }
    .message-user { background: #f0f8ff; border-left: 4px solid #007acc; }
    .message-assistant { background: #f0fff0; border-left: 4px solid #28a745; }
    .message-system { background: #fffbf0; border-left: 4px solid #ffc107; }
    .message-header { font-weight: bold; margin-bottom: 0.5em; }
    .tool-execution { margin: 1em 0; padding: 1em; background: #f8f9fa; border-radius: 4px; }
    .tool-start { font-weight: bold; color: #007acc; }
    .tool-output { margin: 0.5em 0; padding: 0.5em; background: #ffffff; border-radius: 4px; }
    .tool-stdout { color: #333; }
    .tool-stderr { color: #dc3545; }
    .tool-end.success { color: #28a745; }
    .tool-end.error { color: #dc3545; }
    .error-message { padding: 1em; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24; }
    .cost-info { display: inline-block; padding: 0.2em 0.5em; background: #fff3cd; border-radius: 4px; font-size: 0.9em; }
    .debug-info { padding: 0.5em; background: #e9ecef; border-radius: 4px; font-size: 0.8em; }
    pre { white-space: pre-wrap; word-wrap: break-word; }
    code { background: #f8f9fa; padding: 0.2em 0.4em; border-radius: 3px; }
  </style>
</head>
<body>
`;

const HTML_DOCUMENT_END = `
</body>
</html>
`;

if (require.main === module) {
  main().catch(console.error);
}
```

## User Experience

### Terminal Output Examples

```bash
# Basic conversation
👤 user:
  write a hello world function

🤖 assistant:
  I'll create a simple hello world function for you.

🔧 write Hello world function in TypeScript
  │ function helloWorld(): string {
  │   return "Hello, World!";
  │ }
  │ 
  │ export default helloWorld;
✅ write (234ms)

# Tool execution with collapse
🔧 npm test --collapse-tools
  └─ npm WARN deprecated package@1.0.0... (truncated)
✅ npm (1.2s)

# Error handling
🚨 Parse error: Invalid JSON on line 47

# Cost tracking
💰 $0.0023
```

### HTML Output Features

- **Semantic structure**: Proper HTML5 elements and accessibility
- **Responsive design**: Works on mobile and desktop
- **Syntax highlighting**: Basic code formatting
- **Collapsible sections**: Tool outputs can be expanded/collapsed
- **Print-friendly**: CSS optimized for printing
- **Self-contained**: No external dependencies

### CLI Help and Examples

```bash
# Help output
agent-stream-fmt --help

# Real usage examples
claude --json "debug this code" | agent-stream-fmt --collapse-tools
gemini --jsonl "create tests" | agent-stream-fmt --only tool,error
amp-code run deploy.yml | agent-stream-fmt --html > deployment-log.html
```

## Testing Strategy

### Unit Tests

```typescript
// tests/render/ansi.test.ts
describe('ANSI Renderer', () => {
  it('renders message with correct role styling', () => {
    const renderer = new AnsiRenderer({ format: 'ansi' });
    const event: AgentEvent = { t: 'msg', role: 'assistant', text: 'Hello' };
    
    const output = renderer.render(event);
    
    expect(output).toContain('🤖');
    expect(output).toMatch(/\x1b\[.*m/); // Contains ANSI codes
    expect(output).toContain('Hello');
  });
  
  it('handles tool lifecycle correctly', () => {
    const renderer = new AnsiRenderer({ format: 'ansi' });
    
    const start = renderer.render({ t: 'tool', name: 'npm', phase: 'start' });
    const stdout = renderer.render({ t: 'tool', name: 'npm', phase: 'stdout', text: 'Installing...' });
    const end = renderer.render({ t: 'tool', name: 'npm', phase: 'end', exitCode: 0 });
    
    expect(start).toContain('🔧');
    expect(stdout).toContain('Installing...');
    expect(end).toContain('✅');
  });
  
  it('collapses tools when option enabled', () => {
    const renderer = new AnsiRenderer({ format: 'ansi', collapseTools: true });
    
    renderer.render({ t: 'tool', name: 'npm', phase: 'start' });
    const stdout = renderer.render({ t: 'tool', name: 'npm', phase: 'stdout', text: 'Installing...' });
    
    expect(stdout).toBe(''); // No immediate output when collapsed
  });
});
```

### Integration Tests

```typescript
// tests/cli.test.ts
describe('Enhanced CLI', () => {
  it('formats Claude output end-to-end', async () => {
    const input = fs.createReadStream('fixtures/claude/basic-message.jsonl');
    const output = await runCLI(['--vendor', 'claude'], input);
    
    expect(output).toContain('👤 user:');
    expect(output).toContain('🤖 assistant:');
  });
  
  it('generates valid HTML output', async () => {
    const input = fs.createReadStream('fixtures/claude/tool-use.jsonl');
    const output = await runCLI(['--html'], input);
    
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<div class="message">');
    expect(output).toContain('</html>');
  });
  
  it('filters events correctly', async () => {
    const input = fs.createReadStream('fixtures/claude/complex-session.jsonl');
    const output = await runCLI(['--only', 'tool,error'], input);
    
    expect(output).toContain('🔧'); // Tool events
    expect(output).not.toContain('🤖'); // No messages
  });
});
```

### Rendering Tests

```typescript
// tests/render/html.test.ts
describe('HTML Renderer', () => {
  it('escapes HTML entities correctly', () => {
    const renderer = new HtmlRenderer({ format: 'html' });
    const event: AgentEvent = { 
      t: 'msg', 
      role: 'user', 
      text: 'Code: <script>alert("xss")</script>' 
    };
    
    const output = renderer.render(event);
    
    expect(output).toContain('&lt;script&gt;');
    expect(output).not.toContain('<script>');
  });
  
  it('generates semantic HTML structure', () => {
    const renderer = new HtmlRenderer({ format: 'html' });
    const event: AgentEvent = { t: 'msg', role: 'assistant', text: 'Hello' };
    
    const output = renderer.render(event);
    
    expect(output).toContain('<div class="message message-assistant">');
    expect(output).toContain('<div class="message-header">');
    expect(output).toContain('<div class="message-content">');
  });
});
```

### Performance Tests

```typescript
// tests/render/performance.test.ts
describe('Rendering Performance', () => {
  it('maintains streaming performance with rendering', async () => {
    const events = generateTestEvents(10000);
    const renderer = new AnsiRenderer({ format: 'ansi' });
    
    const start = performance.now();
    for (const event of events) {
      renderer.render(event);
    }
    const elapsed = performance.now() - start;
    
    const eventsPerSecond = (events.length * 1000) / elapsed;
    expect(eventsPerSecond).toBeGreaterThan(50000); // Maintain 50k events/sec
  });
});
```

## Performance Considerations

### Streaming Efficiency
- **Incremental rendering**: Each event rendered independently without buffering
- **Minimal string concatenation**: Use arrays and single join operations
- **Efficient ANSI escape sequences**: Pre-computed color codes, minimal escape usage
- **Context reuse**: Maintain rendering state without creating new objects

### Memory Management
- **Bounded tool stack**: Limit concurrent tool tracking to prevent memory leaks
- **String interning**: Reuse common strings (colors, icons) to reduce allocation
- **Lazy evaluation**: Only format complex content when actually needed

### Optimization Targets
- **Rendering throughput**: > 50k events/second (maintaining Phase 2 performance)
- **Memory overhead**: < 5MB additional RSS for rendering engine
- **Startup time**: < 50ms additional overhead for renderer initialization

## Security Considerations

### Input Sanitization
- **HTML escaping**: All user content properly escaped in HTML mode
- **ANSI injection prevention**: Strip or escape ANSI codes in message content
- **No code execution**: Renderers never execute or evaluate user content

### Output Safety
- **Content Security Policy**: Generated HTML includes CSP headers
- **XSS prevention**: Comprehensive HTML entity escaping
- **Safe defaults**: All formatting options default to secure values

### Error Handling
```typescript
// Safe error handling in renderers
try {
  const formatted = renderer.render(event);
  return formatted;
} catch (error) {
  // Never expose internal errors to output
  return renderError({ t: 'error', message: 'Rendering error' });
}
```

## Documentation

### User Documentation
1. **Enhanced README**: Complete examples showing all output formats
2. **CLI help**: Comprehensive help text with examples
3. **Format comparison**: Side-by-side ANSI vs HTML output examples
4. **Filtering guide**: How to use `--only` and other filtering options

### API Documentation
1. **Renderer interfaces**: Complete TypeScript API documentation
2. **Customization guide**: How to extend renderers for new formats
3. **Performance guide**: Optimization tips for high-volume streams

## Implementation Phases

### Phase 3a: Core Rendering (6-8 hours)
**Duration**: 6-8 hours  
**Focus**: Basic ANSI rendering with essential features

#### Tasks:
1. **Renderer architecture** (1.5 hours)
   - Implement `Renderer` interface and factory pattern
   - Create `RenderContext` for state management
   - Set up renderer selection logic

2. **ANSI renderer implementation** (3 hours)
   - Message rendering with role-based styling
   - Basic tool execution formatting
   - Error and cost event rendering
   - Color and icon system using kleur

3. **Enhanced streaming API** (1.5 hours)
   - Implement `streamFormat` function
   - Connect renderer to streaming pipeline
   - Add format parameter handling

4. **Basic CLI enhancements** (2 hours)
   - Add format options (`--html`, `--json`)
   - Implement basic filtering (`--hide-tools`, `--collapse-tools`)
   - Update help text and examples

#### Testing:
- Unit tests for `AnsiRenderer`
- Integration tests with fixture files
- CLI option validation

#### Success Criteria:
- ANSI output renders correctly for all event types
- Performance maintains 50k+ events/second
- CLI provides formatted output for all vendors

### Phase 3b: HTML Rendering & Advanced Features (4-6 hours)
**Duration**: 4-6 hours  
**Focus**: HTML output and advanced CLI features

#### Tasks:
1. **HTML renderer implementation** (2.5 hours)
   - Semantic HTML structure for all event types
   - CSS styling for professional appearance
   - HTML entity escaping and security

2. **Advanced CLI features** (2 hours)
   - Event filtering with `--only` option
   - Output file handling (`--output`)
   - Enhanced help and examples

3. **HTML document generation** (1 hour)
   - Complete HTML document wrapper
   - Inline CSS for self-contained output
   - Responsive design and print support

4. **Enhanced error handling** (0.5 hours)
   - Graceful rendering failures
   - Better error messages
   - Input validation

#### Testing:
- HTML output validation
- Advanced CLI option testing
- Security testing for HTML escaping
- End-to-end integration tests

#### Success Criteria:
- Valid, self-contained HTML output
- All CLI options work correctly
- Comprehensive error handling

### Phase 3c: Polish & Optimization (2-3 hours)
**Duration**: 2-3 hours  
**Focus**: Performance optimization and final polish

#### Tasks:
1. **Performance optimization** (1.5 hours)
   - Profile rendering performance
   - Optimize string operations
   - Minimize memory allocations

2. **Documentation updates** (1 hour)
   - Update README with rendering examples
   - Complete CLI help text
   - Add usage examples

3. **Final testing and validation** (0.5 hours)
   - Complete test suite execution
   - Performance benchmarking
   - End-to-end validation

#### Testing:
- Performance benchmarking
- Memory usage validation
- Complete fixture testing
- Documentation accuracy

#### Success Criteria:
- Performance targets met
- All tests pass
- Documentation complete
- Ready for Phase 4

## Open Questions

1. **Tool output chunking**: Should we buffer tool output to avoid interleaved lines, or stream immediately?
2. **HTML templating**: Use string templates or consider a minimal templating engine?
3. **Color customization**: Should we support custom color schemes or theme files?
4. **Accessibility**: What ARIA attributes and semantic elements are needed for HTML mode?
5. **Performance vs features**: Should we offer a "fast mode" with minimal formatting?

## Next Steps

### Immediate (Phase 3 Implementation)
1. **Start with Phase 3a**: Core ANSI rendering
2. **Test extensively**: Use all captured fixtures from Phase 0
3. **Optimize incrementally**: Profile and improve performance

### Future Phases (Phase 4+)
1. **Additional vendors**: Gemini and Amp parser implementation
2. **Advanced features**: Plugin system, custom renderers
3. **Performance optimization**: Further streaming improvements

### Success Transition to Phase 4
- [ ] All rendering tests pass with 90%+ coverage
- [ ] Performance maintains 50k+ events/second
- [ ] HTML output validates and displays correctly
- [ ] CLI provides complete user experience
- [ ] Documentation updated and accurate

## References

### External Libraries
- [kleur documentation](https://github.com/lukeed/kleur) - ANSI colors and styling
- [commander.js](https://github.com/tj/commander.js) - CLI framework
- [HTML5 specification](https://html.spec.whatwg.org/) - Semantic HTML guidelines

### Design Patterns
- [Renderer pattern](https://en.wikipedia.org/wiki/Visitor_pattern) - Multiple output format support
- [Factory pattern](https://en.wikipedia.org/wiki/Factory_method_pattern) - Renderer creation
- [Strategy pattern](https://en.wikipedia.org/wiki/Strategy_pattern) - Format selection

### Performance References
- [Node.js Stream Performance](https://nodejs.org/en/docs/guides/backpressuring-in-streams/)
- [String Optimization in V8](https://v8.dev/blog/string-optimization)
- [Memory Management Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)