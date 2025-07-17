# Phase 4: Additional Vendor Support - Technical Specification

**Project**: Agent Stream Format Parser  
**Phase**: 4 - Additional Vendors  
**Status**: Ready for Implementation  
**Prerequisites**: Phase 1 Complete ✅, Phase 2 Complete, Phase 3 Complete  
**Estimated Duration**: 2 days  
**Date**: 2025-07-17  

## Overview

Phase 4 extends the agent-stream-fmt parser system to support additional AI CLI vendors beyond the initial Claude implementation. This phase focuses on implementing robust parsers for Gemini and Amp CLI formats while enhancing the auto-detection system for reliable vendor identification.

## Phase 1 Foundation

Building upon the successfully completed Phase 1 infrastructure:

- **Core Type System**: Complete `AgentEvent` union with all event types
- **Parser Framework**: Extensible `VendorParser` interface with `detect()` and `parse()` methods
- **Registry System**: Priority-based `ParserRegistry` with auto-detection capabilities
- **Error Handling**: Comprehensive `ParseError` class with vendor-specific context
- **Performance Baseline**: Established benchmarks (>1M lines/sec for parsers)

## Goals

### Primary Objectives
1. **Extend Parser Coverage**: Implement production-ready parsers for Gemini and Amp CLIs
2. **Enhance Auto-Detection**: Improve vendor detection reliability and fallback mechanisms
3. **Maintain Performance**: Ensure new parsers meet or exceed Phase 1 benchmarks
4. **Preserve Compatibility**: No breaking changes to existing Claude parser or public APIs

### Success Criteria
- **Parser Completeness**: All three vendors (Claude, Gemini, Amp) parse their respective formats correctly
- **Detection Accuracy**: >95% vendor detection accuracy across all supported formats
- **Performance Targets**: New parsers achieve >1M lines/sec throughput
- **Test Coverage**: >95% test coverage for all new parser implementations
- **Error Handling**: Comprehensive error handling with clear, actionable messages

## Technical Architecture

### Parser Implementation Strategy

```typescript
// Enhanced Parser Architecture
interface VendorParser {
  vendor: string;
  detect(line: string): boolean;    // Fast format detection
  parse(line: string): AgentEvent[]; // Convert to normalized events
  metadata?: {
    version: string;
    supportedVersions: string[];
    documentationUrl: string;
  };
}
```

### Detection Priority System

```
Priority Levels (Higher = Tried First):
┌─────────────────────────────────────────┐
│ Claude Parser (Priority: 100)          │ ← Most mature, highest priority
├─────────────────────────────────────────┤
│ Gemini Parser (Priority: 90)           │ ← Well-defined format
├─────────────────────────────────────────┤
│ Amp Parser (Priority: 80)              │ ← Phase-based format
└─────────────────────────────────────────┘
```

## Implementation Plan

### 1. Gemini Parser Implementation

#### 1.1 Format Analysis
Based on Phase 0 fixture collection, Gemini CLI outputs:

```json
{"type": "user", "content": "Hello world"}
{"type": "assistant", "content": "Hello! How can I help you today?"}
{"type": "metadata", "usage": {"input_tokens": 10, "output_tokens": 25}}
```

#### 1.2 Parser Implementation (`src/parsers/gemini.ts`)

**Detection Logic**:
```typescript
detect(line: string): boolean {
  try {
    const obj = JSON.parse(line);
    return typeof obj.type === 'string' && 
           ['user', 'assistant', 'metadata'].includes(obj.type);
  } catch {
    return false;
  }
}
```

**Parsing Logic**:
- **user/assistant messages** → `MessageEvent` with appropriate role
- **metadata with usage** → `CostEvent` with calculated USD cost
- **unknown types** → `DebugEvent` for forward compatibility

**Cost Calculation**:
```typescript
// Gemini Pro pricing (approximate)
const INPUT_COST_PER_TOKEN = 0.000001;  // $0.001 per 1K tokens
const OUTPUT_COST_PER_TOKEN = 0.000003; // $0.003 per 1K tokens
```

#### 1.3 Test Coverage Requirements
- **Unit Tests**: Event parsing, cost calculation, error handling
- **Integration Tests**: Real fixture parsing, registry integration
- **Performance Tests**: Throughput benchmarks, memory usage
- **Edge Cases**: Malformed JSON, missing fields, unknown event types

### 2. Amp Parser Implementation

#### 2.1 Format Analysis
Amp CLI uses phase-based tool execution:

```json
{"phase": "start", "task": "npm_test", "timestamp": "2025-07-17T10:00:00Z"}
{"phase": "output", "task": "npm_test", "type": "stdout", "content": "Running tests..."}
{"phase": "output", "task": "npm_test", "type": "stderr", "content": "Warning: deprecated"}
{"phase": "end", "task": "npm_test", "exitCode": 0}
```

#### 2.2 Parser Implementation (`src/parsers/amp.ts`)

**Detection Logic**:
```typescript
detect(line: string): boolean {
  try {
    const obj = JSON.parse(line);
    return typeof obj.phase === 'string' && 
           typeof obj.task === 'string' &&
           ['start', 'output', 'end'].includes(obj.phase);
  } catch {
    return false;
  }
}
```

**Parsing Logic**:
- **start phase** → `ToolEvent` with phase='start'
- **output phase (stdout)** → `ToolEvent` with phase='stdout'
- **output phase (stderr)** → `ToolEvent` with phase='stderr'
- **end phase** → `ToolEvent` with phase='end' and exitCode

#### 2.3 Tool Event Sequencing
Amp events map directly to the multi-phase tool execution model:

```typescript
// start → stdout/stderr (multiple) → end
ToolEvent: {
  t: 'tool',
  name: obj.task,
  phase: obj.phase,
  text?: obj.content,
  exitCode?: obj.exitCode
}
```

### 3. Enhanced Auto-Detection System

#### 3.1 Detection Algorithm Improvements

**Current State** (Phase 1):
- Basic priority-based detection
- First-match wins approach
- Limited error handling

**Phase 4 Enhancements**:
```typescript
class ParserRegistry {
  detectVendor(line: string): VendorParser | null {
    // 1. Try all parsers in priority order
    const sortedParsers = this.getSortedParsers();
    
    // 2. Collect detection results
    const candidates: VendorParser[] = [];
    
    for (const entry of sortedParsers) {
      try {
        if (entry.parser.detect(line)) {
          candidates.push(entry.parser);
        }
      } catch (error) {
        // Log warning but continue
        console.warn(`Parser ${entry.parser.vendor} detection failed:`, error);
      }
    }
    
    // 3. Return highest priority match
    return candidates[0] || null;
  }
}
```

#### 3.2 Fallback Mechanisms

**Multi-Line Detection**:
```typescript
detectVendorMultiLine(lines: string[]): VendorParser | null {
  // Try detection on multiple lines for better accuracy
  const detectionResults = new Map<string, number>();
  
  for (const line of lines.slice(0, 10)) { // Check first 10 lines
    const parser = this.detectVendor(line);
    if (parser) {
      const count = detectionResults.get(parser.vendor) || 0;
      detectionResults.set(parser.vendor, count + 1);
    }
  }
  
  // Return parser with most matches
  const [topVendor] = [...detectionResults.entries()]
    .sort((a, b) => b[1] - a[1]);
  
  return topVendor ? this.getParser(topVendor[0]) : null;
}
```

#### 3.3 Detection Confidence Scoring

```typescript
interface DetectionResult {
  parser: VendorParser;
  confidence: number; // 0-1 scale
  reason: string;
}

detectVendorWithConfidence(line: string): DetectionResult | null {
  // Enhanced detection with confidence scoring
  // Higher confidence = more specific format markers
}
```

### 4. Parser Registry Enhancements

#### 4.1 Dynamic Parser Registration

**Enhanced Registration**:
```typescript
class ParserRegistry {
  registerParser(parser: VendorParser, priority: number = 50): void {
    // Validation improvements
    this.validateParser(parser);
    this.validatePriority(priority);
    
    // Conflict detection
    if (this.hasConflictingParser(parser)) {
      throw new Error(`Parser conflict detected for vendor: ${parser.vendor}`);
    }
    
    // Register with metadata
    this.parsers.set(parser.vendor, { 
      parser, 
      priority,
      registeredAt: new Date(),
      metadata: parser.metadata || {}
    });
  }
}
```

#### 4.2 Parser Validation

```typescript
private validateParser(parser: VendorParser): void {
  // Enhanced validation
  if (!parser.detect || typeof parser.detect !== 'function') {
    throw new Error('Parser must implement detect() method');
  }
  
  if (!parser.parse || typeof parser.parse !== 'function') {
    throw new Error('Parser must implement parse() method');
  }
  
  // Test detection method
  try {
    parser.detect('{"test": true}');
  } catch (error) {
    throw new Error(`Parser detect() method is broken: ${error.message}`);
  }
}
```

### 5. Error Handling Improvements

#### 5.1 Enhanced ParseError

```typescript
class ParseError extends Error {
  constructor(
    message: string,
    public readonly vendor: string,
    public readonly line: string,
    public readonly cause?: unknown,
    public readonly context?: {
      lineNumber?: number;
      characterPosition?: number;
      expectedFormat?: string;
    }
  ) {
    super(message);
    this.name = 'ParseError';
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      vendor: this.vendor,
      context: this.context
    };
  }
}
```

#### 5.2 Error Recovery Strategies

```typescript
// Graceful degradation for unknown formats
parse(line: string): AgentEvent[] {
  try {
    return this.parseKnownFormat(line);
  } catch (error) {
    // Fall back to debug event
    return [{
      t: 'debug',
      raw: { 
        originalLine: line,
        parseError: error.message,
        vendor: this.vendor 
      }
    }];
  }
}
```

## Performance Considerations

### Benchmarking Requirements

**Target Performance** (maintain Phase 1 levels):
- **Gemini Parser**: >1M lines/sec
- **Amp Parser**: >1M lines/sec  
- **Auto-Detection**: >1M detections/sec
- **Memory Usage**: <500 bytes per event

### Optimization Strategies

#### 5.1 Detection Optimization

```typescript
// Fast path for common patterns
detect(line: string): boolean {
  // Quick character-based checks before JSON parsing
  if (line.includes('"type":"user"') || 
      line.includes('"type":"assistant"') ||
      line.includes('"type":"metadata"')) {
    return this.verifyGeminiFormat(line);
  }
  return false;
}

private verifyGeminiFormat(line: string): boolean {
  try {
    const obj = JSON.parse(line);
    return typeof obj.type === 'string' && 
           ['user', 'assistant', 'metadata'].includes(obj.type);
  } catch {
    return false;
  }
}
```

#### 5.2 Memory Optimization

```typescript
// Minimize object allocation in hot paths
parse(line: string): AgentEvent[] {
  // Reuse event objects where possible
  // Avoid deep object copying
  // Use string interning for common values
}
```

## Testing Strategy

### Test Structure

```
tests/
├── parsers/
│   ├── gemini.test.ts         # Gemini parser unit tests
│   ├── amp.test.ts            # Amp parser unit tests
│   └── multi-vendor.test.ts   # Cross-vendor integration tests
├── registry/
│   ├── detection.test.ts      # Enhanced detection tests
│   └── priority.test.ts       # Priority system tests
├── fixtures/
│   ├── gemini/               # Real Gemini CLI outputs
│   └── amp/                  # Real Amp CLI outputs
└── performance/
    └── phase4-benchmarks.test.ts
```

### Test Coverage Requirements

**Unit Tests**:
- **Gemini Parser**: 100% line coverage, all event types
- **Amp Parser**: 100% line coverage, all phases
- **Registry Enhancements**: All new detection methods
- **Error Handling**: All error paths and recovery scenarios

**Integration Tests**:
- **Cross-vendor Detection**: Mixed format files
- **Priority System**: Correct parser selection
- **Performance Regression**: Ensure no slowdowns

**Performance Tests**:
- **Throughput Benchmarks**: >1M lines/sec for each parser
- **Memory Usage**: <500 bytes per event
- **Concurrent Processing**: Multiple vendor detection

### Fixture Requirements

**Gemini Fixtures** (minimum):
- `basic-messages.jsonl`: User/assistant conversation
- `metadata-usage.jsonl`: Usage tracking events
- `mixed-session.jsonl`: Complex conversation with metadata

**Amp Fixtures** (minimum):
- `simple-task.jsonl`: Basic tool execution
- `complex-workflow.jsonl`: Multi-step task with stdout/stderr
- `error-handling.jsonl`: Task failures and error cases

## API Compatibility

### Backwards Compatibility

**No Breaking Changes**:
- All Phase 1 exports remain unchanged
- Existing Claude parser behavior preserved
- Registry API maintains compatibility

**New Exports**:
```typescript
// Additional exports for Phase 4
export { GeminiParser } from './parsers/gemini.js';
export { AmpParser } from './parsers/amp.js';

// Enhanced detection functions
export { detectVendorMultiLine, detectVendorWithConfidence } from './parsers/index.js';
```

### Version Compatibility

**Semantic Versioning**:
- Phase 4 = Minor version bump (0.1.0 → 0.2.0)
- No breaking changes to existing APIs
- New features are additive only

## Implementation Checklist

### 1. Gemini Parser Implementation
- [ ] Create `src/parsers/gemini.ts` with complete parser
- [ ] Implement `detect()` method with format-specific checks
- [ ] Implement `parse()` method handling all event types
- [ ] Add comprehensive error handling and recovery
- [ ] Create unit tests with >95% coverage
- [ ] Performance benchmark: achieve >1M lines/sec

### 2. Amp Parser Implementation  
- [ ] Create `src/parsers/amp.ts` with complete parser
- [ ] Implement phase-based event parsing (start/output/end)
- [ ] Handle stdout/stderr output differentiation
- [ ] Add proper tool sequencing and exit code handling
- [ ] Create unit tests with >95% coverage
- [ ] Performance benchmark: achieve >1M lines/sec

### 3. Registry System Enhancement
- [ ] Enhance auto-detection with fallback mechanisms
- [ ] Add multi-line detection capability
- [ ] Implement detection confidence scoring
- [ ] Add parser validation and conflict detection
- [ ] Update priority system documentation

### 4. Error Handling Improvements
- [ ] Enhance `ParseError` with contextual information
- [ ] Add graceful degradation for unknown formats
- [ ] Implement error recovery strategies
- [ ] Add comprehensive error handling tests

### 5. Testing and Validation
- [ ] Create comprehensive test suite for new parsers
- [ ] Add cross-vendor integration tests
- [ ] Implement performance regression tests
- [ ] Validate against real CLI fixture files
- [ ] Achieve >95% test coverage across all new code

### 6. Documentation and Examples
- [ ] Update API documentation with new parsers
- [ ] Add usage examples for each vendor
- [ ] Document detection algorithm improvements
- [ ] Create troubleshooting guide for detection issues

## Risk Assessment

### Technical Risks

**Format Volatility**:
- **Risk**: Vendor CLI formats may change
- **Mitigation**: Version detection, graceful degradation, comprehensive testing

**Performance Degradation**:
- **Risk**: Additional parsers slow down detection
- **Mitigation**: Optimize detection algorithms, maintain benchmarks

**Detection Conflicts**:
- **Risk**: Multiple parsers claim the same format
- **Mitigation**: Precise detection logic, comprehensive testing

### Implementation Risks

**Fixture Availability**:
- **Risk**: Cannot access all CLI tools for fixture collection
- **Mitigation**: Synthetic fixtures based on documentation, community contributions

**Parser Complexity**:
- **Risk**: Vendor formats more complex than initially assessed
- **Mitigation**: Iterative implementation, fallback to debug events

## Success Metrics

### Quantitative Metrics
- **Parser Coverage**: 3 vendor parsers implemented and tested
- **Detection Accuracy**: >95% correct vendor identification
- **Performance**: All parsers achieve >1M lines/sec throughput
- **Test Coverage**: >95% line coverage for all new code
- **Memory Usage**: <500 bytes per event processed

### Qualitative Metrics
- **Code Quality**: Clean, maintainable parser implementations
- **Error Handling**: Clear, actionable error messages
- **Documentation**: Comprehensive API and usage documentation
- **Developer Experience**: Simple parser registration and usage

## Conclusion

Phase 4 significantly expands the agent-stream-fmt parser ecosystem by adding robust support for Gemini and Amp CLI formats while maintaining the high-performance, extensible architecture established in Phase 1. The enhanced auto-detection system and improved error handling provide a solid foundation for future vendor additions.

The implementation maintains strict backwards compatibility while adding powerful new capabilities, ensuring existing users can seamlessly benefit from expanded vendor support. With comprehensive testing and performance benchmarking, Phase 4 delivers production-ready parser coverage for the three major AI CLI vendors.

---

**Next Phase**: Phase 5 - Package & Documentation
**Dependencies**: Requires Phase 2 (Streaming Engine) and Phase 3 (Rendering Engine) completion
**Estimated Timeline**: 2 days of focused development with comprehensive testing