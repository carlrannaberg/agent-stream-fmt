#!/usr/bin/env tsx

/**
 * Demo script for the ANSI renderer
 *
 * This demonstrates all the features of the AnsiRenderer including:
 * - Message rendering with role-based colors
 * - Tool execution tracking
 * - Cost display
 * - Error formatting
 * - Debug output
 * - Markdown-like formatting
 */
/* eslint-disable no-console */

import { AnsiRenderer } from '../src/render/ansi.js';
import type { AgentEvent } from '../src/types.js';
// import type { RenderOptions } from '../src/render/types.js';

// Simulate a delay for demo purposes
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function demoBasicRendering() {
  console.log('\n=== Basic Message Rendering ===\n');

  const renderer = new AnsiRenderer({
    format: 'ansi',
    collapseTools: false,
  });

  const events: AgentEvent[] = [
    { t: 'msg', role: 'user', text: 'Can you help me install a package?' },
    {
      t: 'msg',
      role: 'assistant',
      text: "Of course! I'll help you install a package. Let me run `npm install` for you.",
    },
    { t: 'tool', name: 'npm', phase: 'start', text: 'install express' },
    {
      t: 'tool',
      name: 'npm',
      phase: 'stdout',
      text: 'added 58 packages, and audited 59 packages in 2s',
    },
    {
      t: 'tool',
      name: 'npm',
      phase: 'stdout',
      text: '8 packages are looking for funding\n  run `npm fund` for details',
    },
    {
      t: 'tool',
      name: 'npm',
      phase: 'stdout',
      text: 'found 0 vulnerabilities',
    },
    { t: 'tool', name: 'npm', phase: 'end', exitCode: 0 },
    {
      t: 'msg',
      role: 'assistant',
      text: "Great! I've successfully installed Express for you.",
    },
    { t: 'cost', deltaUsd: 0.0023 },
  ];

  for (const event of events) {
    process.stdout.write(renderer.render(event));
    await delay(300);
  }
}

async function demoMarkdownFormatting() {
  console.log('\n=== Markdown-like Formatting ===\n');

  const renderer = new AnsiRenderer({
    format: 'ansi',
  });

  const message: AgentEvent = {
    t: 'msg',
    role: 'assistant',
    text: `Here's how to use **bold text**, *italic text*, and \`inline code\`.

You can also combine them: **\`bold code\`** or *\`italic code\`*.

\`\`\`javascript
// Code blocks are shown in gray
function hello() {
  console.log("Hello, world!");
}
\`\`\`

Regular text continues here.`,
  };

  process.stdout.write(renderer.render(message));
}

async function demoCollapsedTools() {
  console.log('\n=== Collapsed Tool Output ===\n');

  const renderer = new AnsiRenderer({
    format: 'ansi',
    collapseTools: true,
  });

  const events: AgentEvent[] = [
    { t: 'msg', role: 'user', text: 'Run a build process' },
    { t: 'tool', name: 'webpack', phase: 'start', text: 'build' },
    {
      t: 'tool',
      name: 'webpack',
      phase: 'stdout',
      text: 'Hash: 1a2b3c4d5e6f\nVersion: webpack 5.89.0\nTime: 1234ms\nBuilt at: 12/07/2024 10:00:00 AM',
    },
    {
      t: 'tool',
      name: 'webpack',
      phase: 'stdout',
      text: 'asset main.js 123 KiB [emitted] (name: main)\nasset styles.css 45 KiB [emitted]',
    },
    {
      t: 'tool',
      name: 'webpack',
      phase: 'stdout',
      text: 'Entrypoint main 168 KiB = main.js 123 KiB styles.css 45 KiB\nwebpack compiled successfully',
    },
    { t: 'tool', name: 'webpack', phase: 'end', exitCode: 0 },
  ];

  for (const event of events) {
    process.stdout.write(renderer.render(event));
    await delay(200);
  }
}

async function demoErrorHandling() {
  console.log('\n=== Error and Debug Events ===\n');

  const renderer = new AnsiRenderer({
    format: 'ansi',
  });

  const events: AgentEvent[] = [
    { t: 'msg', role: 'user', text: 'Try to access a file' },
    { t: 'tool', name: 'cat', phase: 'start', text: '/etc/shadow' },
    {
      t: 'tool',
      name: 'cat',
      phase: 'stderr',
      text: 'cat: /etc/shadow: Permission denied',
    },
    { t: 'tool', name: 'cat', phase: 'end', exitCode: 1 },
    { t: 'error', message: 'Failed to read file: Permission denied' },
    {
      t: 'debug',
      raw: { error: 'EACCES', syscall: 'open', path: '/etc/shadow' },
    },
  ];

  for (const event of events) {
    process.stdout.write(renderer.render(event));
    await delay(300);
  }
}

async function demoAllRoles() {
  console.log('\n=== All Message Roles ===\n');

  const renderer = new AnsiRenderer({
    format: 'ansi',
  });

  const events: AgentEvent[] = [
    { t: 'msg', role: 'system', text: 'You are a helpful assistant.' },
    { t: 'msg', role: 'user', text: 'Hello!' },
    {
      t: 'msg',
      role: 'assistant',
      text: 'Hi there! How can I help you today?',
    },
  ];

  for (const event of events) {
    process.stdout.write(renderer.render(event));
    await delay(400);
  }
}

async function demoFlush() {
  console.log('\n=== Pending Tool Warning (flush) ===\n');

  const renderer = new AnsiRenderer({
    format: 'ansi',
  });

  // Start a tool but don't end it
  const events: AgentEvent[] = [
    { t: 'msg', role: 'user', text: 'Start a long-running process' },
    { t: 'tool', name: 'long-process', phase: 'start' },
    { t: 'tool', name: 'long-process', phase: 'stdout', text: 'Processing...' },
  ];

  for (const event of events) {
    process.stdout.write(renderer.render(event));
  }

  // Simulate end of stream - flush pending state
  console.log('\n--- Stream ended unexpectedly ---');
  process.stdout.write(renderer.flush());
}

async function main() {
  console.log('🎨 ANSI Renderer Demo\n');
  console.log('This demo showcases all the features of the AnsiRenderer.');
  console.log(
    'Watch how different event types are rendered with colors and formatting!\n',
  );

  await demoBasicRendering();
  await delay(1000);

  await demoMarkdownFormatting();
  await delay(1000);

  await demoCollapsedTools();
  await delay(1000);

  await demoErrorHandling();
  await delay(1000);

  await demoAllRoles();
  await delay(1000);

  await demoFlush();

  console.log('\n✨ Demo complete!\n');
}

// Run the demo
main().catch(console.error);
