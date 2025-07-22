import { createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { streamEvents } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('=== Streaming Claude Events Demo ===\n');

  const filePath = join(
    __dirname,
    '../tests/fixtures/claude/basic-message.jsonl',
  );
  const stream = createReadStream(filePath);

  console.log('Streaming events from:', filePath);
  console.log('---');

  let eventCount = 0;

  try {
    for await (const event of streamEvents({
      vendor: 'claude',
      source: stream,
      emitDebugEvents: true,
    })) {
      eventCount++;
      console.log(`Event ${eventCount}:`, JSON.stringify(event, null, 2));
    }

    console.log('---');
    console.log(`Total events processed: ${eventCount}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Auto-detection example
async function autoDetectDemo() {
  console.log('\n=== Auto-Detection Demo ===\n');

  const filePath = join(__dirname, '../tests/fixtures/claude/tool-use.jsonl');
  const stream = createReadStream(filePath);

  console.log('Auto-detecting vendor from:', filePath);
  console.log('---');

  for await (const event of streamEvents({
    vendor: 'auto',
    source: stream,
    emitDebugEvents: true,
  })) {
    if (event.t === 'debug' && event.raw?.detected) {
      console.log('Auto-detected vendor:', event.raw.detected);
      break;
    }
  }
}

// Error handling example
async function errorHandlingDemo() {
  console.log('\n=== Error Handling Demo ===\n');

  const { Readable } = await import('stream');
  const input = Readable.from([
    '{"type":"message","role":"user","content":"hello"}\n',
    'invalid json line\n',
    '{"type":"message","role":"assistant","content":"world"}\n',
  ]);

  console.log('Streaming with error handling...');
  console.log('---');

  for await (const event of streamEvents({
    vendor: 'claude',
    source: input,
    continueOnError: true,
  })) {
    console.log(
      `Event [${event.t}]:`,
      event.t === 'error' ? event.message : JSON.stringify(event),
    );
  }
}

// Run all demos
(async () => {
  await main();
  await autoDetectDemo();
  await errorHandlingDemo();
})();
