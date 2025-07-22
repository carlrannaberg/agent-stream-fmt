# Contributing to agent-stream-fmt

We love your input! We want to make contributing to agent-stream-fmt as easy and transparent as
possible. Whether you're reporting a bug, discussing the current state of the code, submitting a
fix, proposing new features, or becoming a maintainer - we appreciate all contributions.

## Development Setup

Getting started with development is straightforward:

1. **Fork the repo and clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/agent-stream-fmt.git
   cd agent-stream-fmt
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create a feature branch**

   ```bash
   git checkout -b feat/amazing-feature
   ```

4. **Verify your setup**

   ```bash
   npm run build          # Build the project
   npm test               # Run tests
   npm run typecheck      # Check TypeScript types
   ```

5. **Make your changes** - See code style guidelines below

6. **Run tests** to ensure everything works

   ```bash
   npm test
   ```

7. **Commit using conventional commits**

   ```bash
   git commit -m "feat: add amazing feature"
   ```

8. **Push and create a PR**
   ```bash
   git push origin feat/amazing-feature
   ```

## Development Workflow

### Building

```bash
npm run build          # Build TypeScript project with tsup
npm run typecheck      # TypeScript type checking
```

### Testing

We use Vitest as our test framework. Tests are located in `tests/` directory and alongside source
files as `*.test.ts`.

```bash
# Core testing commands
npm test               # Run all tests with vitest
npm run test:watch     # Run tests in watch mode

# Specialized test suites
npm run test:integration      # Run integration tests
npm run test:performance      # Run performance benchmarks
npm run test:errors           # Run error handling tests
npm run test:fixtures         # Run fixture validation tests
npm run test:comprehensive    # Run full test suite with reporting

# Test a single file
npm test -- tests/parsers/claude.test.ts
npm test -- src/render/ansi.test.ts
```

#### Testing Philosophy

**When tests fail, fix the code, not the test.**

Key principles:

- **Tests should be meaningful** - Avoid tests that always pass regardless of behavior
- **Test actual functionality** - Call the functions being tested, don't just check side effects
- **Failing tests are valuable** - They reveal bugs or missing features
- **Fix the root cause** - When a test fails, fix the underlying issue, don't hide the test
- **Test edge cases** - Tests that reveal limitations help improve the code
- **Document test purpose** - Each test should include a comment explaining why it exists

### Fixtures Management

Real CLI outputs are crucial for testing. We provide tools to manage them:

```bash
npm run fixtures:capture      # Capture real CLI outputs
npm run fixtures:analyze      # Analyze fixture schemas
npm run fixtures:validate     # Validate fixture files
npm run validate:comprehensive # Full validation with reports
```

### Performance Benchmarks

We maintain strict performance requirements:

- **Throughput**: >50,000 lines/second
- **Memory**: <20MB RSS for infinite streams
- **Latency**: <10ms for first output
- **Startup**: <100ms from CLI invocation

```bash
npm run benchmark             # Run throughput benchmark
npm run benchmark:throughput  # Throughput testing
npm run benchmark:memory      # Memory usage profiling
npm run benchmark:all         # All benchmarks
```

## Code Style

### Git Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- **Format**: `type(scope): description`
- **Types**: feat, fix, docs, style, refactor, test, chore, perf

Examples:

```
feat(parser): add Claude JSONL parser
fix(stream): handle partial lines correctly
docs: update API documentation
perf(render): optimize ANSI color handling
test: add Gemini parser edge cases
chore(deps): update vitest to v1.2.0
```

### TypeScript Guidelines

- **Strict mode**: Always use strict TypeScript configuration
- **Module system**: ESM modules only
- **Target**: ES2022 or later
- **Imports**: Use explicit imports, prefer named imports

```typescript
// Good
import { streamEvents, AgentEvent } from './stream';
import type { Vendor } from './types';

// Avoid
import * as stream from './stream';
```

### Naming Conventions

- **Files**: kebab-case (`agent-parser.ts`)
- **Functions/Variables**: camelCase (`streamEvents`, `parseMessage`)
- **Types/Interfaces**: PascalCase (`AgentEvent`, `VendorParser`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_LINE_LENGTH`)
- **Enums**: PascalCase with descriptive names

### Code Organization

```typescript
// File structure order:
1. Type imports
2. Value imports
3. Type definitions
4. Constants
5. Main implementation
6. Default export (if any)

// Example:
import type { AgentEvent } from './types';
import { kleur } from 'kleur';

interface RenderOptions {
  // ...
}

const DEFAULT_OPTIONS: RenderOptions = {
  // ...
};

export class AnsiRenderer {
  // ...
}
```

### Error Handling

- **Graceful degradation**: Never crash on malformed input
- **Explicit error types**: Use typed errors when possible
- **Logging**: Use structured logging for debugging

```typescript
// Good
try {
  const obj = JSON.parse(line);
  return parseEvent(obj);
} catch (error) {
  return { t: 'error', message: `Parse error: ${error.message}` };
}

// Avoid silent failures
try {
  const obj = JSON.parse(line);
  return parseEvent(obj);
} catch {
  return null; // Don't do this
}
```

### Script Command Consistency

When modifying npm scripts in package.json, ensure all references are updated:

- GitHub Actions workflows (.github/workflows/\*.yml)
- README.md documentation
- This contributing guide
- Any Docker configurations
- CI/CD configuration files

## Pull Request Process

1. **Update your branch** with the latest main branch

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure all tests pass**

   ```bash
   npm test
   npm run typecheck
   ```

3. **Update documentation** if needed
   - Update README.md with any new features or API changes
   - Update type definitions and JSDoc comments
   - Add examples if introducing new functionality

4. **Create your pull request**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changes you made and why
   - Include any breaking changes or migration notes

5. **Wait for review**
   - A maintainer will review your PR
   - Address any feedback or requested changes
   - Once approved, your PR will be merged!

## Where to Get Help

- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub discussions for questions and ideas
- **Documentation**: Check the `specs/` directory for detailed specifications
- **Examples**: Look in the `examples/` directory for usage patterns

## Performance Considerations

When contributing, please keep our performance targets in mind:

- Streaming operations should maintain constant memory usage
- Avoid buffering entire files in memory
- Use async iterators for data processing
- Pre-compile regular expressions
- Minimize string concatenations in hot paths

## Security

- Never include API keys or tokens in fixtures or tests
- Sanitize any sensitive information from logs
- Always validate and escape user input
- Use try-catch for all JSON parsing operations
- Follow the principle of least privilege

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless
of age, body size, disability, ethnicity, gender identity and expression, level of experience,
nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:

- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Project maintainers are responsible for clarifying the standards of acceptable behavior and are
expected to take appropriate and fair corrective action in response to any instances of unacceptable
behavior.

## Recognition

Contributors who make significant improvements will be recognized in our README.md. We value all
contributions, whether they're fixing typos, improving documentation, adding tests, or implementing
new features.

Remember: **We're all here to make great software together!** Every contribution matters, and we're
excited to see what you'll bring to the project.

Thank you for contributing to agent-stream-fmt! 🎉
