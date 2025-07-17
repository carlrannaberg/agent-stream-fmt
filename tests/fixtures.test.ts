import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

describe('Fixture validation', () => {
  const vendors = ['claude', 'gemini', 'amp'] as const;
  
  for (const vendor of vendors) {
    describe(vendor, () => {
      const fixtureDir = join('tests/fixtures', vendor);
      
      it('has fixture directory', () => {
        expect(existsSync(fixtureDir), `Fixture directory should exist: ${fixtureDir}`).toBe(true);
      });
      
      it('has at least one .jsonl file', () => {
        let files: string[] = [];
        try {
          files = readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl'));
        } catch (error) {
          throw new Error(`Failed to read fixture directory: ${fixtureDir}`);
        }
        
        expect(files.length, `${vendor} should have at least one .jsonl fixture file`).toBeGreaterThan(0);
      });
      
      it('all JSONL files are valid', () => {
        let files: string[] = [];
        try {
          files = readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl'));
        } catch (error) {
          // Directory doesn't exist, skip validation
          return;
        }
        
        for (const file of files) {
          const filePath = join(fixtureDir, file);
          let content: string;
          
          try {
            content = readFileSync(filePath, 'utf-8');
          } catch (error) {
            throw new Error(`Failed to read fixture file: ${filePath}`);
          }
          
          const lines = content.split('\n').filter(line => line.trim());
          
          for (const [index, line] of lines.entries()) {
            try {
              JSON.parse(line);
            } catch (error) {
              throw new Error(
                `Invalid JSON in ${vendor}/${file} at line ${index + 1}:\n` +
                `  Line content: ${line}\n` +
                `  Parse error: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        }
      });
    });
  }
});