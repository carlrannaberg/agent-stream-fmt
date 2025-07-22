# Test Suite Documentation

This directory contains comprehensive test suites and validation for the Phase 1 components of the
agent-stream-fmt project.

## Test Structure

### Core Test Files

- **`comprehensive-integration.test.ts`** - Comprehensive integration tests validating all parsers
  against real fixture files
- **`registry-integration.test.ts`** - Enhanced registry integration tests for auto-detection and
  priority ordering
- **`error-handling.test.ts`** - Comprehensive error handling tests for malformed JSON and edge
  cases
- **`performance-benchmarks.test.ts`** - Performance benchmark tests targeting >1000 lines/sec
- **`fixture-validation.test.ts`** - Validation tests for all fixture data from tests/fixtures/
  directory
- **`fixtures.test.ts`** - Basic fixture validation (existing)

### Parser-Specific Tests

- **`src/parsers/claude.test.ts`** - Claude parser unit tests
- **`src/parsers/registry.test.ts`** - Parser registry unit tests
- **`src/parsers/integration.test.ts`** - Basic integration tests
- **`src/parsers/types.test.ts`** - Type system tests
- **`src/types.test.ts`** - Core type tests

## Test Categories

### 1. Parser Integration Tests (`comprehensive-integration.test.ts`)

**Purpose**: Validate parsers against real fixture files

**Key Test Areas**:

- Parser detection accuracy across all fixtures
- Event generation validation
- Content preservation testing
- Performance validation (>1000 lines/sec)
- Error resilience testing

**Coverage**: All fixture files in `tests/fixtures/`

### 2. Registry Integration Tests (`registry-integration.test.ts`)

**Purpose**: Validate parser registry system

**Key Test Areas**:

- Auto-detection system validation
- Priority ordering verification
- Error handling in registry operations
- Concurrent processing validation
- Cross-vendor detection testing

**Coverage**: Registry functionality, parser registration, detection logic

### 3. Error Handling Tests (`error-handling.test.ts`)

**Purpose**: Test resilience and graceful failure modes

**Key Test Areas**:

- Malformed JSON handling
- Edge case inputs (empty, whitespace, unicode)
- Unknown event types
- Parser registration errors
- Detection failures
- Memory efficiency under error conditions

**Coverage**: Error conditions, malformed inputs, edge cases

### 4. Performance Benchmarks (`performance-benchmarks.test.ts`)

**Purpose**: Ensure performance meets targets

**Key Test Areas**:

- Parser performance (>1000 lines/sec target)
- Detection performance
- Memory usage validation
- Scaling tests
- Concurrent processing
- Real fixture performance

**Coverage**: Performance characteristics, memory usage, scaling

### 5. Fixture Validation (`fixture-validation.test.ts`)

**Purpose**: Comprehensive validation of all fixture data

**Key Test Areas**:

- JSON structure validation
- Vendor detection validation
- Parser processing validation
- Content integrity validation
- Coverage analysis

**Coverage**: All fixture files, processing coverage, data integrity

## Running Tests

### Individual Test Suites

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:integration    # Integration tests
npm run test:performance    # Performance benchmarks
npm run test:errors         # Error handling tests
npm run test:fixtures       # Fixture validation

# Run comprehensive test suite
npm run test:comprehensive  # All tests with summary
```

### Validation Scripts

```bash
# Basic fixture validation
npm run fixtures:validate

# Comprehensive validation with performance
npm run validate:comprehensive
```

## Test Data

### Fixture Files

Test fixtures are located in `tests/fixtures/` organized by vendor:

```
tests/fixtures/
├── claude/
│   ├── basic-message.jsonl
│   ├── complex-session.jsonl
│   ├── error-handling.jsonl
│   └── tool-use.jsonl
├── gemini/
│   ├── basic-content.jsonl
│   └── code-generation.jsonl
└── amp/
    ├── build-process.jsonl
    ├── simple-task.jsonl
    └── test-execution.jsonl
```

### Test Data Generation

For performance tests, synthetic data is generated to ensure consistent benchmarking:

- Sample message events
- Tool use/result events
- Usage tracking events
- Error events
- Mixed event sequences

## Performance Targets

### Parser Performance

- **Target**: >1000 lines/second
- **Measurement**: Average processing time across fixture files
- **Validation**: All parsers must meet target consistently

### Detection Performance

- **Target**: >2000 detections/second
- **Measurement**: Vendor detection speed
- **Validation**: Detection should be faster than parsing

### Memory Usage

- **Target**: <100MB for 10k line processing
- **Measurement**: Heap usage during processing
- **Validation**: No significant memory leaks

## Error Handling Requirements

### Malformed JSON

- **Detection**: Should return null gracefully
- **Parsing**: Should throw ParseError with meaningful message
- **Performance**: Should not degrade significantly

### Unknown Event Types

- **Detection**: Should detect if basic structure matches
- **Parsing**: Should generate debug events
- **Content**: Should preserve original data in debug event

### Edge Cases

- **Empty inputs**: Should handle gracefully
- **Unicode content**: Should preserve exactly
- **Large inputs**: Should process efficiently
- **Concurrent access**: Should maintain consistency

## Validation Reports

The comprehensive validation script generates detailed reports:

### Report Sections

1. **Registry Status** - Available parsers and configuration
2. **Overall Statistics** - Total files, lines, errors processed
3. **Performance Benchmarks** - Speed and memory usage metrics
4. **Vendor Results** - Per-vendor processing statistics
5. **Error Summary** - Categorized error analysis

### Report Output

- **Console**: Formatted terminal output with colors
- **JSON**: Machine-readable report in `validation-report.json`
- **Status**: Exit code indicating pass/fail status

## Test Development Guidelines

### Adding New Tests

1. **Use Real Data**: Prefer fixture files over synthetic data
2. **Test Edge Cases**: Include error conditions and boundary cases
3. **Performance Aware**: Include performance validation in tests
4. **Comprehensive Coverage**: Test all supported event types
5. **Clear Assertions**: Use descriptive error messages

### Test Organization

```typescript
describe('Feature Area', () => {
  describe('Specific Functionality', () => {
    it('specific behavior with clear description', () => {
      // Test implementation
    });
  });
});
```

### Performance Testing

```typescript
it('meets performance target', () => {
  const startTime = performance.now();

  // Test operation
  for (const item of testData) {
    process(item);
  }

  const endTime = performance.now();
  const duration = endTime - startTime;
  const itemsPerSecond = (testData.length / duration) * 1000;

  expect(itemsPerSecond).toBeGreaterThan(TARGET_PERFORMANCE);
});
```

## Continuous Integration

The test suite is designed for CI/CD integration:

### Test Execution

- **Parallel**: Tests can run in parallel for speed
- **Deterministic**: Results should be consistent across runs
- **Environment**: Works in Node.js 18+ environments

### Exit Codes

- **0**: All tests passed
- **1**: Tests failed or performance targets not met

### Reporting

- **JUnit**: Compatible with CI reporting systems
- **Coverage**: Integrated with coverage reporting
- **Artifacts**: Validation reports as build artifacts

## Troubleshooting

### Common Issues

1. **Performance Test Failures**
   - Check system load during test execution
   - Verify fixture files are not corrupted
   - Ensure adequate system resources

2. **Fixture Validation Errors**
   - Verify fixture files contain valid JSON
   - Check file permissions and accessibility
   - Ensure fixture directory structure is correct

3. **Parser Detection Issues**
   - Verify parser registration is correct
   - Check detection logic for edge cases
   - Validate fixture format matches expectations

### Debug Options

```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run specific test file
npm test tests/comprehensive-integration.test.ts

# Run with coverage
npm test -- --coverage
```

## Future Enhancements

### Planned Test Additions

- **Streaming Tests**: Real-time processing validation
- **Memory Profiling**: Detailed memory usage analysis
- **Regression Tests**: Automated regression detection
- **Load Testing**: High-volume processing tests

### Test Infrastructure

- **Test Data Management**: Automated fixture generation
- **Performance Tracking**: Historical performance monitoring
- **Cross-Platform Testing**: Validation across different environments
- **Integration Testing**: End-to-end CLI testing

---

_This test suite ensures the reliability, performance, and correctness of the Phase 1 implementation
according to the specifications in `specs/phase-1.md`._
