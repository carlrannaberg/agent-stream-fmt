<!--
Thank you for contributing to agent-stream-fmt! 🎉
Please fill out this template to help us review your changes efficiently.
-->

## Description

<!-- Provide a clear, concise description of your changes -->

### What does this PR do?

<!-- Briefly explain what problem this solves or what feature this adds -->

### Context and motivation

<!-- Why are these changes needed? Link to any related issues -->

Closes #<!-- issue number -->

## Type of Change

Please select the type of change that best describes your PR:

- [ ] 🐛 **Bug fix** (non-breaking change that fixes an issue)
- [ ] ✨ **New feature** (non-breaking change that adds functionality)
- [ ] 💥 **Breaking change** (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 **Documentation** (updates to documentation, README, or code comments)
- [ ] 🔧 **Maintenance** (dependency updates, build changes, tooling improvements)
- [ ] 🎨 **Style** (formatting changes, code style improvements)
- [ ] ♻️ **Refactor** (code changes that neither fix bugs nor add features)
- [ ] ⚡ **Performance** (changes that improve performance)
- [ ] 🧪 **Tests** (adding missing tests or correcting existing tests)

## Changes Made

<!-- List the specific changes you made -->

-
-
-

## Testing Performed

### Test Coverage

- [ ] All existing tests pass (`npm test`)
- [ ] TypeScript type checking passes (`npm run typecheck`)
- [ ] New/modified code has appropriate test coverage
- [ ] Performance benchmarks still pass (if applicable)

### Manual Testing

<!-- Describe the testing you performed to verify your changes -->

**Test scenarios:**

1.
2.
3.

**CLI testing commands used:**

```bash
# Add the commands you used to test your changes
```

### Fixtures and Integration

- [ ] Validated against real CLI outputs (if parser changes)
- [ ] Updated fixtures if necessary (`npm run fixtures:validate`)
- [ ] Tested integration with multiple vendors (if applicable)

## Performance Impact

<!-- Required for changes affecting parsers, streaming, or rendering -->

- [ ] No performance impact expected
- [ ] Performance tested with benchmarks (`npm run benchmark`)
- [ ] Memory usage verified (`npm run benchmark:memory`)
- [ ] Streaming efficiency maintained (constant memory for infinite streams)

**Performance results:**

<!-- If applicable, include benchmark results -->

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

- [ ] This PR contains no breaking changes
- [ ] Breaking changes are documented below

**Migration guide:**

<!-- Provide clear instructions for users to migrate their code -->

## Documentation

- [ ] Code changes are documented with JSDoc comments
- [ ] README.md updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] Examples updated or added (if needed)
- [ ] Changelog updated (`CHANGELOG.md`)

## Code Quality Checklist

### Code Style

- [ ] Follows TypeScript style guidelines
- [ ] Uses conventional commit format in commit messages
- [ ] Code follows project naming conventions (camelCase, PascalCase, etc.)
- [ ] Error handling follows project patterns (graceful degradation)
- [ ] No console.log statements left in production code

### Architecture

- [ ] Changes align with project architecture and patterns
- [ ] New dependencies are justified and minimal
- [ ] Code is modular and reusable
- [ ] Streaming operations maintain memory efficiency
- [ ] No breaking changes to public API (unless documented above)

### Security

- [ ] No API keys, tokens, or sensitive data in code/tests
- [ ] User input is properly validated and sanitized
- [ ] JSON parsing uses proper error handling
- [ ] No code execution of user-provided content

## Additional Context

<!-- Add any other context, screenshots, or notes about the PR here -->

### Related Issues

<!-- Link to any related issues, discussions, or PRs -->

### Dependencies

<!-- List any new dependencies added and why they're needed -->

### Future Work

<!-- Note any follow-up work that should be done -->

---

## For Maintainers

<!-- This section is for maintainer use -->

### Review Checklist

- [ ] Code review completed
- [ ] Performance impact assessed
- [ ] Security considerations reviewed
- [ ] Documentation accuracy verified
- [ ] Test coverage adequate
- [ ] Breaking changes properly documented

### Merge Checklist

- [ ] All CI checks passing
- [ ] Version bump needed (if applicable)
- [ ] Release notes prepared (if applicable)
- [ ] Migration guide complete (if breaking changes)

---

<!--
🔗 **Helpful Links:**
- [Contributing Guide](./CONTRIBUTING.md)
- [Code Style Guidelines](./CLAUDE.md#code-style)
- [Testing Strategy](./specs/testing-strategy.md)
- [Performance Requirements](./CLAUDE.md#performance-requirements)
-->

**By submitting this PR, I confirm that:**

- [ ] I have read and followed the [Contributing Guidelines](./CONTRIBUTING.md)
- [ ] My code follows the project's [code style](./CLAUDE.md#code-style)
- [ ] I have tested my changes thoroughly
- [ ] I understand this will be reviewed by maintainers

Thank you for your contribution! 🚀
