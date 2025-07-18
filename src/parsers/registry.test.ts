import { describe, it, expect, beforeEach } from 'vitest';
import { ParserRegistry, registry, registerParser, getParser, detectVendor, listParsers, selectParser } from './index.js';
import { VendorParser } from './types.js';
import { claudeParser } from './claude.js';

describe('ParserRegistry', () => {
  let testRegistry: ParserRegistry;

  beforeEach(() => {
    testRegistry = new ParserRegistry();
  });

  describe('constructor', () => {
    it('initializes with all default parsers registered', () => {
      expect(testRegistry.hasParser('claude')).toBe(true);
      expect(testRegistry.hasParser('gemini')).toBe(true);
      expect(testRegistry.hasParser('amp')).toBe(true);
      expect(testRegistry.size()).toBe(3);
    });

    it('registers Claude parser with priority 100', () => {
      const parser = testRegistry.getParser('claude');
      expect(parser).toBe(claudeParser);
    });
  });

  describe('registerParser', () => {
    it('registers a parser with default priority', () => {
      const mockParser: VendorParser = {
        vendor: 'test',
        detect: () => true,
        parse: () => []
      };

      testRegistry.registerParser(mockParser);
      expect(testRegistry.hasParser('test')).toBe(true);
      expect(testRegistry.getParser('test' as any)).toBe(mockParser);
    });

    it('registers a parser with custom priority', () => {
      const mockParser: VendorParser = {
        vendor: 'test',
        detect: () => true,
        parse: () => []
      };

      testRegistry.registerParser(mockParser, 75);
      expect(testRegistry.hasParser('test')).toBe(true);
    });

    it('replaces existing parser with same vendor name', () => {
      const parser1: VendorParser = {
        vendor: 'test',
        detect: () => true,
        parse: () => []
      };

      const parser2: VendorParser = {
        vendor: 'test',
        detect: () => false,
        parse: () => []
      };

      testRegistry.registerParser(parser1);
      testRegistry.registerParser(parser2);
      
      expect(testRegistry.getParser('test' as any)).toBe(parser2);
      expect(testRegistry.size()).toBe(4); // claude + gemini + amp + test
    });

    it('throws error for null parser', () => {
      expect(() => {
        testRegistry.registerParser(null as any);
      }).toThrow('Parser cannot be null or undefined');
    });

    it('throws error for undefined parser', () => {
      expect(() => {
        testRegistry.registerParser(undefined as any);
      }).toThrow('Parser cannot be null or undefined');
    });

    it('throws error for parser with empty vendor name', () => {
      const mockParser: VendorParser = {
        vendor: '',
        detect: () => true,
        parse: () => []
      };

      expect(() => {
        testRegistry.registerParser(mockParser);
      }).toThrow('Parser must have a valid vendor name');
    });

    it('throws error for parser with whitespace-only vendor name', () => {
      const mockParser: VendorParser = {
        vendor: '   ',
        detect: () => true,
        parse: () => []
      };

      expect(() => {
        testRegistry.registerParser(mockParser);
      }).toThrow('Parser must have a valid vendor name');
    });

    it('throws error for parser with auto vendor name', () => {
      const mockParser: VendorParser = {
        vendor: 'auto',
        detect: () => true,
        parse: () => []
      };

      expect(() => {
        testRegistry.registerParser(mockParser);
      }).toThrow("Cannot register parser with vendor 'auto' (reserved for auto-detection)");
    });

    it('throws error for invalid priority', () => {
      const mockParser: VendorParser = {
        vendor: 'test',
        detect: () => true,
        parse: () => []
      };

      expect(() => {
        testRegistry.registerParser(mockParser, NaN);
      }).toThrow('Priority must be a finite number');

      expect(() => {
        testRegistry.registerParser(mockParser, Infinity);
      }).toThrow('Priority must be a finite number');
    });
  });

  describe('getParser', () => {
    it('returns parser for existing vendor', () => {
      const parser = testRegistry.getParser('claude');
      expect(parser).toBe(claudeParser);
    });

    it('returns null for non-existing vendor', () => {
      const parser = testRegistry.getParser('nonexistent' as any);
      expect(parser).toBeNull();
    });

    it('returns null for auto vendor', () => {
      const parser = testRegistry.getParser('auto');
      expect(parser).toBeNull();
    });
  });

  describe('detectVendor', () => {
    it('detects Claude format correctly', () => {
      const claudeLine = '{"type":"message","role":"assistant","content":"Hello"}';
      const detected = testRegistry.detectVendor(claudeLine);
      
      expect(detected).toBe(claudeParser);
    });

    it('returns null for unrecognized format', () => {
      const unknownLine = '{"unknown":"format"}';
      const detected = testRegistry.detectVendor(unknownLine);
      
      expect(detected).toBeNull();
    });

    it('returns null for empty line', () => {
      const detected = testRegistry.detectVendor('');
      expect(detected).toBeNull();
    });

    it('returns null for non-string input', () => {
      const detected = testRegistry.detectVendor(null as any);
      expect(detected).toBeNull();
    });

    it('respects parser priority order', () => {
      const highPriorityParser: VendorParser = {
        vendor: 'high',
        detect: () => true,
        parse: () => []
      };

      const lowPriorityParser: VendorParser = {
        vendor: 'low',
        detect: () => true,
        parse: () => []
      };

      testRegistry.registerParser(lowPriorityParser, 10);
      testRegistry.registerParser(highPriorityParser, 200);

      const detected = testRegistry.detectVendor('anything');
      expect(detected?.vendor).toBe('high');
    });

    it('handles parser detection errors gracefully', () => {
      const errorParser: VendorParser = {
        vendor: 'error',
        detect: () => { throw new Error('Detection error'); },
        parse: () => []
      };

      testRegistry.registerParser(errorParser, 200);

      // Should still work despite error parser
      const claudeLine = '{"type":"message","role":"assistant","content":"Hello"}';
      const detected = testRegistry.detectVendor(claudeLine);
      expect(detected?.vendor).toBe('claude');
    });
  });

  describe('listParsers', () => {
    it('returns list of registered vendors', () => {
      const vendors = testRegistry.listParsers();
      expect(vendors).toEqual(['amp', 'claude', 'gemini']);
    });

    it('returns sorted list', () => {
      const parser1: VendorParser = {
        vendor: 'zebra',
        detect: () => true,
        parse: () => []
      };

      const parser2: VendorParser = {
        vendor: 'alpha',
        detect: () => true,
        parse: () => []
      };

      testRegistry.registerParser(parser1);
      testRegistry.registerParser(parser2);

      const vendors = testRegistry.listParsers();
      expect(vendors).toEqual(['alpha', 'amp', 'claude', 'gemini', 'zebra']);
    });

    it('returns empty array for empty registry', () => {
      testRegistry.clear();
      const vendors = testRegistry.listParsers();
      expect(vendors).toEqual([]);
    });
  });

  describe('size', () => {
    it('returns correct size', () => {
      expect(testRegistry.size()).toBe(3);

      const mockParser: VendorParser = {
        vendor: 'test',
        detect: () => true,
        parse: () => []
      };

      testRegistry.registerParser(mockParser);
      expect(testRegistry.size()).toBe(4); // claude + gemini + amp + test
    });
  });

  describe('hasParser', () => {
    it('returns true for existing parser', () => {
      expect(testRegistry.hasParser('claude')).toBe(true);
    });

    it('returns false for non-existing parser', () => {
      expect(testRegistry.hasParser('nonexistent')).toBe(false);
    });
  });

  describe('unregisterParser', () => {
    it('removes existing parser', () => {
      const result = testRegistry.unregisterParser('claude');
      expect(result).toBe(true);
      expect(testRegistry.hasParser('claude')).toBe(false);
    });

    it('returns false for non-existing parser', () => {
      const result = testRegistry.unregisterParser('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all parsers', () => {
      testRegistry.clear();
      expect(testRegistry.size()).toBe(0);
      expect(testRegistry.listParsers()).toEqual([]);
    });
  });
});

describe('Default registry and convenience functions', () => {
  describe('default registry', () => {
    it('is initialized with all default parsers', () => {
      expect(registry.hasParser('claude')).toBe(true);
      expect(registry.hasParser('gemini')).toBe(true);
      expect(registry.hasParser('amp')).toBe(true);
      expect(registry.size()).toBe(3);
    });
  });

  describe('registerParser function', () => {
    it('registers parser with default registry', () => {
      const mockParser: VendorParser = {
        vendor: 'test-convenience',
        detect: () => true,
        parse: () => []
      };

      registerParser(mockParser, 75);
      expect(registry.hasParser('test-convenience')).toBe(true);
      
      // Cleanup
      registry.unregisterParser('test-convenience');
    });
  });

  describe('getParser function', () => {
    it('retrieves parser from default registry', () => {
      const parser = getParser('claude');
      expect(parser).toBe(claudeParser);
    });

    it('returns null for non-existing parser', () => {
      const parser = getParser('nonexistent' as any);
      expect(parser).toBeNull();
    });
  });

  describe('detectVendor function', () => {
    it('detects vendor using default registry', () => {
      const claudeLine = '{"type":"message","role":"assistant","content":"Hello"}';
      const detected = detectVendor(claudeLine);
      
      expect(detected).toBe(claudeParser);
    });

    it('returns null for unrecognized format', () => {
      const unknownLine = '{"unknown":"format"}';
      const detected = detectVendor(unknownLine);
      
      expect(detected).toBeNull();
    });
  });

  describe('listParsers function', () => {
    it('returns vendors from default registry', () => {
      const vendors = listParsers();
      expect(vendors).toContain('claude');
    });
  });

  describe('selectParser function', () => {
    it('returns specific parser for known vendor', () => {
      const parser = selectParser('claude');
      expect(parser).toBe(claudeParser);
    });

    it('throws error for unknown vendor', () => {
      expect(() => {
        selectParser('unknown' as any);
      }).toThrow('Unknown vendor: unknown');
    });

    it('auto-detects vendor when vendor is auto', () => {
      const claudeLine = '{"type":"message","role":"assistant","content":"Hello"}';
      const parser = selectParser('auto', claudeLine);
      
      expect(parser).toBe(claudeParser);
    });

    it('throws error for auto without firstLine', () => {
      expect(() => {
        selectParser('auto');
      }).toThrow('Auto-detection requires at least one line');
    });

    it('throws error for auto with unrecognized format', () => {
      const unknownLine = '{"unknown":"format"}';
      
      expect(() => {
        selectParser('auto', unknownLine);
      }).toThrow('Failed to auto-detect vendor from line');
    });
  });
});

describe('Integration tests with real fixtures', () => {
  it('detects Claude format from real fixture', () => {
    // Sample line from Claude fixtures
    const claudeLine = '{"type":"message","role":"assistant","content":"I\'ll help you create a simple test file."}';
    
    const detected = detectVendor(claudeLine);
    expect(detected?.vendor).toBe('claude');
  });

  it('detects Claude tool_use format', () => {
    const toolUseLine = '{"type":"tool_use","id":"toolu_123","name":"Write","input":{"file_path":"test.txt","content":"Hello"}}';
    
    const detected = detectVendor(toolUseLine);
    expect(detected?.vendor).toBe('claude');
  });

  it('detects Claude usage format', () => {
    const usageLine = '{"type":"usage","input_tokens":142,"output_tokens":89}';
    
    const detected = detectVendor(usageLine);
    expect(detected?.vendor).toBe('claude');
  });

  it('does not detect non-Claude format', () => {
    const nonClaudeLine = '{"kind":"content","data":{"text":"Hello World"}}';
    
    const detected = detectVendor(nonClaudeLine);
    expect(detected).toBeNull();
  });
});