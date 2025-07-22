#!/usr/bin/env tsx
/**
 * Example: Error Recovery with Enhanced Context
 *
 * Demonstrates how the enhanced ParseError provides detailed context
 * about parsing failures, including line numbers and expected formats.
 */
/* eslint-disable no-console */

import { streamEvents } from '../src/index.js';
import { PassThrough } from 'stream';
import kleur from 'kleur';

async function main() {
  console.log(kleur.bold().blue('Error Recovery Example\n'));

  // Create a stream with mixed valid and invalid content
  const input = new PassThrough();

  // Start consuming events with debug enabled
  const eventPromise = (async () => {
    console.log(kleur.gray('Processing mixed JSONL stream...\n'));

    for await (const event of streamEvents({
      vendor: 'auto',
      source: input,
      continueOnError: true,
      emitDebugEvents: true,
    })) {
      switch (event.t) {
        case 'msg':
          console.log(kleur.green('✓'), kleur.bold('Message:'), event.text);
          break;

        case 'tool':
          if (event.phase === 'start') {
            console.log(kleur.cyan('→'), kleur.bold('Tool:'), event.name);
          }
          break;

        case 'error':
          console.log(kleur.red('✗'), kleur.bold('Error:'), event.message);
          break;

        case 'debug':
          if (event.raw.error) {
            console.log(
              kleur.yellow('  Debug:'),
              kleur.gray(
                `Line ${event.raw.lineNumber}: ${event.raw.line.substring(0, 50)}...`,
              ),
            );
          }
          break;
      }
    }
  })();

  // Write a mix of valid and invalid lines
  console.log(kleur.gray('Input lines:\n'));

  // Valid Claude message
  const line1 =
    '{"type":"message","role":"assistant","content":"Hello from Claude!"}';
  console.log(kleur.gray('1:'), line1);
  input.write(line1 + '\n');

  // Invalid JSON
  const line2 = 'This is not JSON at all';
  console.log(kleur.gray('2:'), line2);
  input.write(line2 + '\n');

  // Valid Gemini message
  const line3 = '{"type":"user","content":"Hello Gemini!"}';
  console.log(kleur.gray('3:'), line3);
  input.write(line3 + '\n');

  // Malformed JSON
  const line4 = '{"type": "message", "content": "Missing closing brace"';
  console.log(kleur.gray('4:'), line4);
  input.write(line4 + '\n');

  // Valid Claude tool use
  const line5 =
    '{"type":"tool_use","name":"calculator","input":{"operation":"add","a":5,"b":3}}';
  console.log(kleur.gray('5:'), line5);
  input.write(line5 + '\n');

  // JSON with wrong structure
  const line6 = '{"foo":"bar","baz":123}';
  console.log(kleur.gray('6:'), line6);
  input.write(line6 + '\n');

  // Valid Amp task
  const line7 = '{"phase":"start","task":"build"}';
  console.log(kleur.gray('7:'), line7);
  input.write(line7 + '\n');

  console.log(kleur.gray('\nProcessing results:\n'));

  input.end();
  await eventPromise;

  console.log(kleur.gray('\n---'));
  console.log(kleur.bold('Summary:'));
  console.log('• The parser successfully recovered from errors');
  console.log('• Error messages include line numbers for easy debugging');
  console.log('• Valid events were processed despite intermittent failures');
  console.log('• Debug events provide additional context when enabled');
}

// Example of catching and inspecting ParseError
import { ParseError } from '../src/parsers/types.js';

function demonstrateParseError() {
  console.log(kleur.bold().blue('\n\nParseError JSON Serialization Example\n'));

  const error = new ParseError(
    'Unexpected end of JSON input',
    'claude',
    '{"type":"message","content":"incomplete',
    new SyntaxError('Unexpected end of JSON input'),
    {
      lineNumber: 42,
      characterPosition: 39,
      expectedFormat:
        'Valid JSON object with "type" field (message, tool_use, tool_result, usage, or error)',
    },
  );

  console.log(kleur.bold('ParseError instance:'));
  console.log('• Message:', error.message);
  console.log('• Vendor:', error.vendor);
  console.log('• Line:', error.line);
  console.log('• Context:', error.context);

  console.log(kleur.bold('\nJSON representation:'));
  console.log(JSON.stringify(error.toJSON(), null, 2));

  console.log(kleur.bold('\nFull JSON stringify:'));
  console.log(JSON.stringify(error, null, 2));
}

// Run examples
main()
  .then(() => demonstrateParseError())
  .catch(console.error);
