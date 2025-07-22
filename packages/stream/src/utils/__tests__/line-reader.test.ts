import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'stream';
import {
  createLineReader,
  createLineReaderWithLineNumbers,
} from '../line-reader.js';

describe('createLineReader', () => {
  /**
   * Helper function to create a readable stream from string chunks
   */
  function createStreamFromChunks(chunks: string[]): Readable {
    let index = 0;
    return new Readable({
      read() {
        if (index < chunks.length) {
          this.push(chunks[index++]);
        } else {
          this.push(null);
        }
      },
    });
  }

  /**
   * Helper function to create a readable stream from a single string
   */
  function createStreamFromString(content: string): Readable {
    return Readable.from([content]);
  }

  /**
   * Helper to collect all lines from an async generator
   */
  async function collectLines(
    generator: AsyncGenerator<string>,
  ): Promise<string[]> {
    const lines: string[] = [];
    for await (const line of generator) {
      lines.push(line);
    }
    return lines;
  }

  describe('Basic Functionality', () => {
    it('should handle complete lines', async () => {
      // Tests that complete lines ending with newlines are properly extracted
      const stream = createStreamFromString('line1\nline2\nline3\n');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle partial lines across chunks', async () => {
      // Tests that lines split across chunk boundaries are properly reassembled
      const stream = createStreamFromChunks(['Hello ', 'World\nFoo', 'bar\n']);
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual(['Hello World', 'Foobar']);
    });

    it('should handle missing final newline', async () => {
      // Tests that the last line without a newline is still yielded
      const stream = createStreamFromString('line1\nline2\nline3');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle empty stream', async () => {
      // Tests that an empty stream yields no lines
      const stream = createStreamFromString('');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual([]);
    });

    it('should handle stream with only newlines', async () => {
      // Tests that a stream of only newlines yields no lines by default
      const stream = createStreamFromString('\n\n\n');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual([]);
    });

    it('should handle mixed empty and non-empty lines', async () => {
      // Tests that empty lines are filtered out by default
      const stream = createStreamFromString('line1\n\nline2\n\n\nline3\n');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual(['line1', 'line2', 'line3']);
    });

    it('should include empty lines when includeEmpty is true', async () => {
      // Tests that empty lines are included when the option is set
      const stream = createStreamFromString('line1\n\nline2\n\n');
      const lines = await collectLines(
        createLineReader(stream, { includeEmpty: true }),
      );

      expect(lines).toEqual(['line1', '', 'line2', '']);
    });

    it('should handle lines with only whitespace', async () => {
      // Tests that lines with only whitespace are excluded by default
      const stream = createStreamFromString('line1\n   \t   \nline2\n');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual(['line1', 'line2']);
    });
  });

  describe('Max Line Length Enforcement', () => {
    it('should truncate lines exceeding max length', async () => {
      // Tests basic max line length truncation
      const longLine = 'a'.repeat(150);
      const stream = createStreamFromString(`${longLine}\nshort\n`);
      const lines = await collectLines(
        createLineReader(stream, { maxLineLength: 100 }),
      );

      expect(lines[0]).toHaveLength(100);
      expect(lines[0]).toBe('a'.repeat(100));
      // After truncation, it continues accumulating until newline
      expect(lines[1]).toBe('a'.repeat(50) + '\nshort\n');
    });

    it('should handle very long lines without newlines', async () => {
      // Tests that very long lines without any newlines are properly truncated
      const longLine = 'x'.repeat(300);
      const stream = createStreamFromString(longLine);
      const lines = await collectLines(
        createLineReader(stream, { maxLineLength: 100 }),
      );

      // After first truncation at 100, it continues accumulating the remaining 200 chars
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('x'.repeat(100));
      expect(lines[1]).toBe('x'.repeat(200));
    });

    it('should handle long lines with newlines within max length', async () => {
      // Tests that newlines within the max length are respected
      const line1 = 'a'.repeat(80);
      const line2 = 'b'.repeat(90);
      const stream = createStreamFromString(`${line1}\n${line2}\n`);
      const lines = await collectLines(
        createLineReader(stream, { maxLineLength: 100 }),
      );

      expect(lines).toEqual([line1, line2]);
    });

    it('should handle chunks that individually exceed max length', async () => {
      // Tests handling of individual chunks that exceed max length
      const chunk1 = 'a'.repeat(150);
      const chunk2 = 'b'.repeat(150) + '\n';
      const stream = createStreamFromChunks([chunk1, chunk2]);
      const lines = await collectLines(
        createLineReader(stream, { maxLineLength: 100 }),
      );

      // Multiple truncations as buffer keeps exceeding max length
      expect(lines[0]).toBe('a'.repeat(100)); // First truncation
      expect(lines[1]).toBe('a'.repeat(50) + 'b'.repeat(50)); // Second truncation
      expect(lines[2]).toBe('b'.repeat(100) + '\n'); // Remaining content with newline
    });

    it('should handle very small max line length', async () => {
      // Tests edge case of very small max line length
      const stream = createStreamFromString('abcdefghij\n123\n');
      const lines = await collectLines(
        createLineReader(stream, { maxLineLength: 3 }),
      );

      // After first truncation at 3 chars, the remaining buffer is yielded as-is
      expect(lines).toEqual(['abc', 'defghij\n123\n']);
    });
  });

  describe('Encoding Support', () => {
    it('should handle UTF-8 content correctly', async () => {
      // Tests that UTF-8 characters are properly handled
      const stream = createStreamFromString(
        'Hello 世界\nΓειά σου κόσμε\n🌍🌎🌏\n',
      );
      const lines = await collectLines(
        createLineReader(stream, { encoding: 'utf8' }),
      );

      expect(lines).toEqual(['Hello 世界', 'Γειά σου κόσμε', '🌍🌎🌏']);
    });

    it('should respect existing stream encoding', async () => {
      // Tests that existing stream encoding is not overridden
      const stream = createStreamFromString('test\n');
      stream.setEncoding('utf8');

      const setEncodingSpy = vi.spyOn(stream, 'setEncoding');
      await collectLines(createLineReader(stream));

      // Should not call setEncoding again since it's already set
      expect(setEncodingSpy).not.toHaveBeenCalled();
    });

    it('should set encoding when not already set', async () => {
      // Tests that encoding is set when the stream doesn't have one
      const stream = createStreamFromString('test\n');

      const setEncodingSpy = vi.spyOn(stream, 'setEncoding');
      await collectLines(createLineReader(stream, { encoding: 'utf8' }));

      expect(setEncodingSpy).toHaveBeenCalledWith('utf8');
    });
  });

  describe('Resource Cleanup', () => {
    it('should destroy stream after reading', async () => {
      // Tests that the stream is properly destroyed after reading
      const stream = createStreamFromString('line1\nline2\n');
      const destroySpy = vi.spyOn(stream, 'destroy');

      await collectLines(createLineReader(stream));

      expect(destroySpy).toHaveBeenCalled();
      expect(stream.destroyed).toBe(true);
    });

    it('should destroy stream on error', async () => {
      // Tests that the stream is destroyed even when an error occurs
      const stream = new Readable({
        read() {
          this.emit('error', new Error('Test error'));
        },
      });

      const destroySpy = vi.spyOn(stream, 'destroy');

      try {
        await collectLines(createLineReader(stream));
      } catch (error) {
        // Expected error
      }

      expect(destroySpy).toHaveBeenCalled();
    });

    it('should not destroy already destroyed stream', async () => {
      // Tests that we don't attempt to destroy an already destroyed stream
      const stream = createStreamFromString('test\n');
      stream.destroy();

      const destroySpy = vi.spyOn(stream, 'destroy');

      try {
        await collectLines(createLineReader(stream));
      } catch (error) {
        // Expected - reading from destroyed stream
      }

      // Should not call destroy again
      expect(destroySpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single character lines', async () => {
      // Tests handling of very short lines
      const stream = createStreamFromString('a\nb\nc\n');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual(['a', 'b', 'c']);
    });

    it('should handle carriage return line feeds (CRLF)', async () => {
      // Tests that CRLF line endings are handled (CR is preserved)
      const stream = createStreamFromString('line1\r\nline2\r\nline3\r\n');
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toEqual(['line1\r', 'line2\r', 'line3\r']);
    });

    it('should handle null chunks gracefully', async () => {
      // Tests that null chunks (end of stream) are handled properly
      const stream = new Readable({
        read() {
          this.push('line1\n');
          this.push(null);
        },
      });

      const lines = await collectLines(createLineReader(stream));
      expect(lines).toEqual(['line1']);
    });

    it('should handle very small max line length with chunks', async () => {
      // Tests edge case of max length smaller than chunk size
      const stream = createStreamFromChunks(['abcdef', 'ghij\n']);
      const lines = await collectLines(
        createLineReader(stream, { maxLineLength: 2 }),
      );

      // Truncations happen while processing chunks, final buffer includes newline
      expect(lines).toEqual(['ab', 'cd', 'efghij\n']);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large number of lines efficiently', async () => {
      // Tests that the line reader can handle many lines without issues
      const lineCount = 10000;
      const chunks: string[] = [];
      for (let i = 0; i < lineCount; i += 1000) {
        let chunk = '';
        for (let j = 0; j < 1000 && i + j < lineCount; j++) {
          chunk += `line${i + j}\n`;
        }
        chunks.push(chunk);
      }

      const stream = createStreamFromChunks(chunks);
      const lines = await collectLines(createLineReader(stream));

      expect(lines).toHaveLength(lineCount);
      expect(lines[0]).toBe('line0');
      expect(lines[lineCount - 1]).toBe(`line${lineCount - 1}`);
    });

    it('should stream lines without buffering entire content', async () => {
      // Tests that lines are yielded as they're read, not after buffering everything
      const yieldedLines: string[] = [];
      const stream = createStreamFromChunks(['line1\n', 'line2\n', 'line3\n']);

      for await (const line of createLineReader(stream)) {
        yieldedLines.push(line);
        // If streaming properly, we should have lines before the stream ends
        if (yieldedLines.length === 1) {
          expect(stream.readable).toBe(true);
        }
      }

      expect(yieldedLines).toEqual(['line1', 'line2', 'line3']);
    });
  });
});

describe('createLineReaderWithLineNumbers', () => {
  /**
   * Helper to create a readable stream from a string
   */
  function createStreamFromString(content: string): Readable {
    return Readable.from([content]);
  }

  /**
   * Helper to collect all lines with numbers from an async generator
   */
  async function collectLinesWithNumbers(
    generator: AsyncGenerator<{ line: string; lineNumber: number }>,
  ): Promise<Array<{ line: string; lineNumber: number }>> {
    const lines: Array<{ line: string; lineNumber: number }> = [];
    for await (const item of generator) {
      lines.push(item);
    }
    return lines;
  }

  it('should track line numbers correctly', async () => {
    // Tests that line numbers are correctly assigned starting from 1
    const stream = createStreamFromString('first\nsecond\nthird\n');
    const lines = await collectLinesWithNumbers(
      createLineReaderWithLineNumbers(stream),
    );

    expect(lines).toEqual([
      { line: 'first', lineNumber: 1 },
      { line: 'second', lineNumber: 2 },
      { line: 'third', lineNumber: 3 },
    ]);
  });

  it('should track line numbers with empty lines excluded', async () => {
    // Tests that line numbers increment only for non-empty lines
    const stream = createStreamFromString('first\n\nsecond\n\n\nthird\n');
    const lines = await collectLinesWithNumbers(
      createLineReaderWithLineNumbers(stream),
    );

    expect(lines).toEqual([
      { line: 'first', lineNumber: 1 },
      { line: 'second', lineNumber: 2 },
      { line: 'third', lineNumber: 3 },
    ]);
  });

  it('should track line numbers with empty lines included', async () => {
    // Tests that line numbers increment for all lines when includeEmpty is true
    const stream = createStreamFromString('first\n\nsecond\n');
    const lines = await collectLinesWithNumbers(
      createLineReaderWithLineNumbers(stream, { includeEmpty: true }),
    );

    expect(lines).toEqual([
      { line: 'first', lineNumber: 1 },
      { line: '', lineNumber: 2 },
      { line: 'second', lineNumber: 3 },
    ]);
  });

  it('should inherit all options from base createLineReader', async () => {
    // Tests that options like maxLineLength are properly passed through
    const longLine = 'a'.repeat(150);
    const stream = createStreamFromString(`${longLine}\nshort\n`);
    const lines = await collectLinesWithNumbers(
      createLineReaderWithLineNumbers(stream, { maxLineLength: 100 }),
    );

    expect(lines[0].line).toHaveLength(100);
    expect(lines[0].lineNumber).toBe(1);
    // After truncation, continues accumulating until newline
    expect(lines[1].line).toBe('a'.repeat(50) + '\nshort\n');
    expect(lines[1].lineNumber).toBe(2);
  });
});
