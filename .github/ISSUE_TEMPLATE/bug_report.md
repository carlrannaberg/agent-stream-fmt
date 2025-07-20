---
name: Bug Report
about: Report a bug or unexpected behavior in agent-stream-fmt
title: '[BUG] '
labels: ['bug', 'needs-triage']
assignees: ''
---

## Bug Description

**Brief Summary**
A clear and concise description of what the bug is.

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened instead.

## Environment Information

**System Information:**

- OS: [e.g., macOS 14.0, Ubuntu 22.04, Windows 11]
- Node.js version: [run `node --version`]
- npm version: [run `npm --version`]
- Terminal: [e.g., iTerm2, Windows Terminal, GNOME Terminal]

**Package Information:**

- agent-stream-fmt version: [run `npm list agent-stream-fmt`]
- Installation method: [npm, yarn, pnpm, built from source]
- TypeScript version (if applicable): [run `tsc --version`]

**AI CLI Information:**

- [ ] Claude Code - Version: [run `claude --version`]
- [ ] Gemini CLI - Version: [run `gemini --version`]
- [ ] Amp Code - Version: [run `amp --version`]
- [ ] Other vendor: [specify name and version]

## Reproduction Steps

**Minimal Example**
Please provide the smallest possible example that reproduces the issue:

```bash
# Command that triggers the bug
claude --json "your prompt here" | agent-stream-fmt --vendor claude
```

**Step-by-step Instructions:**

1.
2.
3.
4.

## Input/Output Data

**Input JSONL Sample:**

```jsonl
# Paste a few lines of the input JSONL that causes the issue
# Remove any sensitive information like API keys
```

**Expected Output:**

```
# What you expected to see
```

**Actual Output:**

```
# What you actually saw (including error messages)
```

## Additional Context

**Command Line Arguments Used:**

```bash
# Full command with all flags
agent-stream-fmt --vendor claude --format ansi --collapse-tools
```

**Error Messages:**

```
# Full error output if any
```

**Debug Information:**
If possible, run with debug logging enabled:

```bash
DEBUG=agent-stream-fmt:* your-command-here
```

**Performance Impact:**

- [ ] High memory usage
- [ ] Slow processing
- [ ] Crashes/hangs
- [ ] Incorrect output format
- [ ] Other: [describe]

## Checklist

- [ ] I have searched for existing issues before creating this one
- [ ] I have provided all requested environment information
- [ ] I have included a minimal reproduction example
- [ ] I have removed any sensitive information from code samples
- [ ] I have tested with the latest version of agent-stream-fmt
- [ ] I have included relevant error messages or debug output
