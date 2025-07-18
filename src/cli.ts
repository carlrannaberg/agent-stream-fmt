#!/usr/bin/env node
import { createReadStream } from 'fs';
import { streamEvents } from './stream.js';
import { Vendor } from './types.js';

/**
 * Minimal CLI for testing the streaming engine
 * Full CLI with formatting will be implemented in Phase 3
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Basic argument parsing
  let vendor: Vendor = 'auto';
  let inputFile: string | null = null;
  let showHelp = false;
  let debug = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--vendor':
      case '-v':
        vendor = args[++i] as Vendor;
        break;
        
      case '--debug':
      case '-d':
        debug = true;
        break;
        
      case '--help':
      case '-h':
        showHelp = true;
        break;
        
      default:
        if (!arg.startsWith('-')) {
          inputFile = arg;
        }
    }
  }
  
  if (showHelp) {
    console.log(`agent-stream-fmt (Phase 2 - Basic CLI)

Usage: agent-stream-fmt [options] [file]

Options:
  --vendor, -v <vendor>  Vendor: auto, claude, gemini, amp (default: auto)
  --debug, -d            Show debug events
  --help, -h             Show this help

Examples:
  agent-stream-fmt output.jsonl
  agent-stream-fmt --vendor claude < output.jsonl
  claude --json "hello" | agent-stream-fmt --debug
`);
    process.exit(0);
  }
  
  try {
    // Create input stream
    const source = inputFile 
      ? createReadStream(inputFile, { encoding: 'utf8' })
      : process.stdin;
    
    // Stream and output events as JSON
    for await (const event of streamEvents({
      vendor,
      source,
      emitDebugEvents: debug
    })) {
      // Output each event as JSON (for testing)
      console.log(JSON.stringify(event));
    }
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };