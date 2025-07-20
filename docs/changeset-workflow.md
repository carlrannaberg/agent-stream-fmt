# Changeset Workflow

This guide explains how to use changesets for versioning and releases in the Agent-IO monorepo.

## Overview

We use [changesets](https://github.com/changesets/changesets) to manage package versions and releases. This allows:
- Independent versioning of packages
- Automatic changelog generation
- Coordinated releases across packages
- Semantic versioning based on change types

## Creating a Changeset

When you make changes that should trigger a version bump:

```bash
npm run changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the type of change (major/minor/patch)
3. Write a summary of the changes

## Versioning

After changesets are created, run:

```bash
npm run version
```

This will:
- Update package versions based on changesets
- Update changelogs
- Update dependency versions where needed
- Delete consumed changesets

## Publishing

To publish packages to npm:

```bash
npm run release
```

This will:
- Run the prerelease script (build and test)
- Publish changed packages to npm
- Create git tags for releases

## Workflow Summary

1. **Make changes** to one or more packages
2. **Create changeset**: `npm run changeset`
3. **Commit** the changeset file
4. **Before release**: `npm run version` (usually in CI)
5. **Publish**: `npm run release` (usually in CI)

## Change Types

- **Major**: Breaking changes (0.x.0 → 1.0.0)
- **Minor**: New features (x.0.0 → x.1.0)
- **Patch**: Bug fixes (x.x.0 → x.x.1)

## CI/CD Integration

The GitHub Actions workflow for releases:
1. Checks for changesets on PRs
2. Creates a "Version Packages" PR when changesets exist
3. Publishes packages when the version PR is merged

## Best Practices

1. **Always create changesets** for user-facing changes
2. **Write clear summaries** that will appear in changelogs
3. **Group related changes** in a single changeset
4. **Review version bumps** before publishing
5. **Don't commit version changes manually** - let changesets handle it

## Ignoring Changes

Some changes don't need changesets:
- Documentation updates
- Test improvements
- Build configuration
- Development dependencies

## Troubleshooting

### Missing Changeset

If CI fails due to missing changeset:
1. Run `npm run changeset`
2. Select affected packages
3. Commit the `.changeset/*.md` file

### Version Conflicts

If you see version conflicts:
1. Pull latest changes
2. Run `npm run version` again
3. Resolve any merge conflicts

### Publishing Failures

If publishing fails:
1. Check npm authentication
2. Ensure package names are available
3. Verify `access: "public"` in config
4. Check package.json `publishConfig`

## Configuration

Changeset configuration is in `.changeset/config.json`:
- `access`: "public" for npm publishing
- `baseBranch`: "main" 
- `updateInternalDependencies`: "patch" for automatic updates
- `changelog`: Generates CHANGELOG.md files