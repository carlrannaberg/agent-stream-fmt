# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-07-19

### Added

- Initial release with support for Claude, Gemini, and Amp CLI formats
- ANSI terminal rendering with color support
- HTML rendering for web display
- Smart auto-detection of vendor formats
- Streaming architecture with constant memory usage
- Comprehensive test suite with 100% coverage
- Performance benchmarks showing 2-3M lines/sec throughput
- CLI with filtering options (--hide-tools, --only, etc.)
- Full TypeScript support with detailed types
- Multi-line detection for improved accuracy
- Confidence scoring for vendor detection
- Enhanced error handling with contextual information

### Performance

- Claude parser: 2.2M lines/sec
- Gemini parser: 2.8M lines/sec
- Amp parser: 3.2M lines/sec
- Memory usage: <600 bytes per event

[0.1.0]: https://github.com/yourusername/agent-stream-fmt/releases/tag/v0.1.0
