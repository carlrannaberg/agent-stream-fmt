import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Fixture validation', () => {
  const vendors = ['claude', 'gemini', 'amp'];
  
  for (const vendor of vendors) {
    describe(vendor, () => {
      const fixtureDir = join('tests/fixtures', vendor);
      
      it('has fixture directory', () => {
        expect(() => readdirSync(fixtureDir)).not.toThrow();
      });
      
      it('has README.md file', () => {
        const files = readdirSync(fixtureDir);
        expect(files).toContain('README.md');
      });
      
      it('all JSONL files are valid', () => {
        const files = readdirSync(fixtureDir).filter(f => f.endsWith('.jsonl'));
        
        for (const file of files) {
          const content = readFileSync(join(fixtureDir, file), 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          
          for (const [index, line] of lines.entries()) {
            expect(() => JSON.parse(line), 
              `${file} line ${index + 1} should be valid JSON`
            ).not.toThrow();
          }
        }
      });
    });
  }
});