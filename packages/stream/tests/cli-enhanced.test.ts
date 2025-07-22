import { describe, it, expect, beforeEach, vi } from 'vitest';
// import { Command } from 'commander';
import { main } from '../src/cli.js';
// import type { ExtendedStreamFormatOptions } from '../src/stream.js';
import * as streamModule from '../src/stream.js';
import * as fs from 'fs';

// Mock the stream module
vi.mock('../src/stream.js', () => ({
  streamFormat: vi.fn(),
}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
    readFileSync: actual.readFileSync,
  };
});

describe('Enhanced CLI', () => {
  let mockStdoutWrite: any;
  let mockStderrWrite: any;
  let mockStreamFormat: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock process methods
    mockStdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    mockStderrWrite = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    // Get mocked streamFormat
    mockStreamFormat = vi.mocked(streamModule.streamFormat);
  });

  it('should parse all command line options correctly', async () => {
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield 'test output\n';
      },
    };
    mockStreamFormat.mockReturnValue(mockIterator);

    // Test with all options
    process.argv = [
      'node',
      'cli.js',
      '--vendor',
      'claude',
      '--format',
      'html',
      '--collapse-tools',
      '--hide-tools',
      '--hide-cost',
      '--hide-debug',
      '--only',
      'msg,tool',
      'input.jsonl',
    ];

    await main();

    // Verify streamFormat was called with correct options
    expect(mockStreamFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor: 'claude',
        format: 'html',
        renderOptions: expect.objectContaining({
          format: 'html',
          collapseTools: true,
          hideTools: true,
          hideCost: true,
          hideDebug: true,
          compactMode: false,
        }),
        eventFilter: new Set(['msg', 'tool']),
        emitDebugEvents: false,
      }),
    );
  });

  it('should handle --html shorthand correctly', async () => {
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield '<div>test</div>\n';
      },
    };
    mockStreamFormat.mockReturnValue(mockIterator);

    process.argv = ['node', 'cli.js', '--html'];

    await main();

    // Verify HTML wrapper was written
    expect(mockStdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('<!DOCTYPE html>'),
    );
    expect(mockStdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining('</html>'),
    );
  });

  it('should handle --json shorthand correctly', async () => {
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield '{"t":"msg","text":"test"}\n';
      },
    };
    mockStreamFormat.mockReturnValue(mockIterator);

    process.argv = ['node', 'cli.js', '--json'];

    await main();

    // Verify streamFormat was called with json format and compact mode
    expect(mockStreamFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'json',
        renderOptions: expect.objectContaining({
          format: 'json',
          compactMode: true,
        }),
      }),
    );
  });

  it('should validate vendor type', async () => {
    process.argv = ['node', 'cli.js', '--vendor', 'invalid'];

    await expect(main()).rejects.toThrow("Invalid vendor 'invalid'");

    expect(mockStderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("Invalid vendor 'invalid'"),
    );
  });

  it('should validate format type', async () => {
    process.argv = ['node', 'cli.js', '--format', 'invalid'];

    await expect(main()).rejects.toThrow("Invalid format 'invalid'");

    expect(mockStderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("Invalid format 'invalid'"),
    );
  });

  it('should validate event types in --only option', async () => {
    process.argv = ['node', 'cli.js', '--only', 'msg,invalid,tool'];

    await expect(main()).rejects.toThrow("Invalid event type 'invalid'");

    expect(mockStderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("Invalid event type 'invalid'"),
    );
  });

  it('should handle file output correctly', async () => {
    const mockWriteStream = {
      write: vi.fn().mockReturnValue(true), // Return true to indicate successful write without backpressure
      end: vi.fn((cb?: (error?: Error | null) => void) => {
        // Simulate successful stream end
        if (cb) cb();
      }),
      once: vi.fn((event: string, cb: () => void) => {
        // Simulate drain event callback for backpressure handling
        if (event === 'drain') {
          setImmediate(cb);
        }
      }),
    };
    vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any);

    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield 'test output\n';
      },
    };
    mockStreamFormat.mockReturnValue(mockIterator);

    process.argv = ['node', 'cli.js', '--output', 'output.txt'];

    await main();

    expect(vi.mocked(fs.createWriteStream)).toHaveBeenCalledWith('output.txt');
    expect(mockWriteStream.write).toHaveBeenCalledWith('test output\n');
    expect(mockWriteStream.end).toHaveBeenCalled();
  });

  it('should handle input file correctly', async () => {
    const mockReadStream = {};
    vi.mocked(fs.createReadStream).mockReturnValue(mockReadStream as any);

    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield 'test output\n';
      },
    };
    mockStreamFormat.mockReturnValue(mockIterator);

    process.argv = ['node', 'cli.js', 'input.jsonl'];

    await main();

    expect(vi.mocked(fs.createReadStream)).toHaveBeenCalledWith('input.jsonl', {
      encoding: 'utf8',
    });
    expect(mockStreamFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        source: mockReadStream,
      }),
    );
  });

  it('should parse comma-separated event types correctly', async () => {
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield 'test\n';
      },
    };
    mockStreamFormat.mockReturnValue(mockIterator);

    process.argv = ['node', 'cli.js', '--only', 'msg, tool, error'];

    await main();

    expect(mockStreamFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        eventFilter: new Set(['msg', 'tool', 'error']),
      }),
    );
  });

  it('should handle errors gracefully in HTML mode', async () => {
    mockStreamFormat.mockImplementation(() => {
      throw new Error('Test error');
    });

    process.argv = ['node', 'cli.js', '--html'];

    await expect(main()).rejects.toThrow('Test error');

    // Should write HTML error
    expect(mockStdoutWrite).toHaveBeenCalledWith(
      expect.stringContaining(
        '<div class="error-message">Error: Test error</div>',
      ),
    );
  });

  it('should include comprehensive help text', async () => {
    // Save original argv and stdout
    const originalArgv = process.argv;
    const originalWrite = process.stdout.write;

    // Capture output
    let helpOutput = '';
    process.stdout.write = (chunk: any) => {
      helpOutput += chunk.toString();
      return true;
    };

    // Test help output
    process.argv = ['node', 'cli.js', '--help'];

    try {
      await main();
    } catch (e) {
      // Expect process.exit to be called for help
    }

    // Restore
    process.stdout.write = originalWrite;
    process.argv = originalArgv;

    expect(helpOutput).toContain('Auto-detect vendor and format for terminal');
    expect(helpOutput).toContain('Event types for --only:');
    expect(helpOutput).toContain('Vendor auto-detection:');
  });

  it('should set emitDebugEvents based on hideDebug option', async () => {
    const mockIterator = {
      async *[Symbol.asyncIterator]() {
        yield 'test\n';
      },
    };
    mockStreamFormat.mockReturnValue(mockIterator);

    // Test with default (hideDebug = true by default)
    process.argv = ['node', 'cli.js'];
    await main();

    expect(mockStreamFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        emitDebugEvents: false,
      }),
    );

    // Reset and test with --hide-debug explicitly set
    vi.clearAllMocks();
    mockStreamFormat.mockReturnValue(mockIterator);
    mockStdoutWrite.mockClear();
    mockStderrWrite.mockClear();

    // Test with --hide-debug option
    process.argv = ['node', 'cli.js', '--hide-debug'];

    await main();

    expect(mockStreamFormat).toHaveBeenCalledWith(
      expect.objectContaining({
        emitDebugEvents: false,
      }),
    );
  });
});
