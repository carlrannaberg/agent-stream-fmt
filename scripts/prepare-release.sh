#!/bin/bash

# AI-powered release preparation script for Agent-IO monorepo
# Handles changeset operations in non-interactive mode

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PACKAGE_JSON="${PROJECT_ROOT}/package.json"
CHANGELOG_FILE="${PROJECT_ROOT}/CHANGELOG.md"
README_FILE="${PROJECT_ROOT}/README.md"

# Default values
DRY_RUN=false
INTERACTIVE=true
RELEASE_TYPE=""
AI_CLI=""
AI_MODEL=""
AI_FLAGS=""

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

print_ai() {
    echo -e "${CYAN}🤖 $1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

AI-powered release preparation script for Agent-IO monorepo.

OPTIONS:
    -t, --type TYPE     Release type: patch, minor, major
    -d, --dry-run       Perform a dry run without making changes
    -y, --yes           Non-interactive mode (use defaults)
    -h, --help          Show this help message

EXAMPLES:
    $0                          # Interactive mode
    $0 --type minor             # Prepare minor release
    $0 --type patch --dry-run   # Dry run for patch release
    $0 --type major --yes       # Non-interactive major release

EOF
}

# Function to detect available AI CLI
detect_ai_cli() {
    print_step "Detecting available AI CLI tools..."

    if command -v claude &> /dev/null; then
        AI_CLI="claude"
        AI_MODEL="--model claude-sonnet-4-20250514"
        AI_FLAGS='--output-format stream-json --verbose --max-turns 30 --allowedTools "Edit" "MultiEdit" "Read" "Write"'
        print_success "Found Claude CLI with Sonnet 4 model"
    elif command -v gemini &> /dev/null; then
        AI_CLI="gemini"
        AI_MODEL="--model gemini-2.5-flash-exp"
        AI_FLAGS="--include-all --yolo"
        print_success "Found Gemini CLI with Flash 2.5 model"
    else
        print_error "No AI CLI found. Install Claude CLI or Gemini CLI to use this script."
        echo "Installation instructions:"
        echo "  - Claude CLI: https://github.com/anthropics/claude-cli"
        echo "  - Gemini CLI: https://github.com/google/generative-ai-cli"
        exit 1
    fi
}

# Function to validate environment
validate_environment() {
    print_step "Validating environment..."

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not a git repository. Please run this script from the project root."
        exit 1
    fi

    # Check if package.json exists
    if [[ ! -f "$PACKAGE_JSON" ]]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        print_error "Uncommitted changes detected. Please commit or stash changes before release."
        git status --short
        exit 1
    fi

    # Check if we're on main branch
    current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" ]]; then
        print_warning "Not on main branch (current: $current_branch)"
        if [[ "$INTERACTIVE" == "true" ]]; then
            read -p "Continue anyway? [y/N]: " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi


    print_success "Environment validation passed"
}

# Function to get current version of publishable packages
get_current_versions() {
    print_step "Getting current package versions..."

    # Get @agent-io/stream version (main package)
    STREAM_VERSION=$(node -p "require('./packages/stream/package.json').version")
    echo "Current @agent-io/stream version: $STREAM_VERSION"

    # Check what packages are actually published
    PUBLISHED_STREAM=$(npm view "@agent-io/stream" version 2>/dev/null || echo "")
    if [ -n "$PUBLISHED_STREAM" ]; then
        echo "Latest published @agent-io/stream on NPM: $PUBLISHED_STREAM"
        LAST_VERSION_TAG="@agent-io/stream@$PUBLISHED_STREAM"
    else
        echo "@agent-io/stream not found on NPM registry"
        LAST_VERSION_TAG=""
    fi
}

# Function to prompt for release type
prompt_release_type() {
    if [[ -n "$RELEASE_TYPE" ]]; then
        return
    fi

    echo
    print_info "Current @agent-io/stream version: $STREAM_VERSION"
    echo
    echo "Select release type:"
    echo "  1) patch   - Bug fixes, no breaking changes"
    echo "  2) minor   - New features, backwards compatible"
    echo "  3) major   - Breaking changes"
    echo

    while true; do
        read -p "Enter choice [1-3]: " -r choice
        case $choice in
            1) RELEASE_TYPE="patch"; break ;;
            2) RELEASE_TYPE="minor"; break ;;
            3) RELEASE_TYPE="major"; break ;;
            *) print_error "Invalid choice. Please enter 1-3." ;;
        esac
    done
}

# Function to run tests and validation
run_tests() {
    print_step "Running test suite and validation..."

    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "Dry run: Skipping tests"
        return
    fi

    # Run the validation pipeline
    if ! npm run validate; then
        print_error "Validation failed. Please fix the issues before preparing a release."
        exit 1
    fi

    print_success "All tests and validation passed. Continuing with release preparation..."
}

# Function to pre-compute release data
pre_compute_release_data() {
    print_step "Pre-computing release data..."
    echo "==========================="

    # Fetch latest tags
    git fetch --tags

    get_current_versions

    # Get the last git tag
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$LAST_TAG" ]; then
        echo "No previous tags found in git."
        if [ -n "$LAST_VERSION_TAG" ]; then
            echo "Using NPM version $PUBLISHED_STREAM as reference"
            LAST_TAG=$LAST_VERSION_TAG
        else
            echo "This will be the first release."
            LAST_TAG="HEAD"
        fi
    else
        echo "Last git tag: $LAST_TAG"
        # Warn if git tag doesn't match NPM version
        if [ -n "$PUBLISHED_STREAM" ] && [ "$LAST_TAG" != "@agent-io/stream@$PUBLISHED_STREAM" ]; then
            print_warning "Git tag ($LAST_TAG) doesn't match NPM version (@agent-io/stream@$PUBLISHED_STREAM)"
            echo "Using NPM version as the reference for changes"
            LAST_TAG="@agent-io/stream@$PUBLISHED_STREAM"
        fi
    fi

    # Get commit information
    if [ "$LAST_TAG" != "HEAD" ]; then
        COMMIT_COUNT=$(git rev-list ${LAST_TAG}..HEAD --count)
        echo "Found $COMMIT_COUNT commits since $LAST_TAG"

        # Get recent commits (limit to avoid long output)
        RECENT_COMMITS=$(git log ${LAST_TAG}..HEAD --oneline --max-count=20)

        # Get file changes with smart filtering for monorepo
        DIFF_STAT=$(git diff ${LAST_TAG}..HEAD --stat)
        ALL_CHANGED_FILES=$(git diff ${LAST_TAG}..HEAD --name-only)

        # Smart filtering for monorepo: Focus on packages/stream and root files
        FILE_COUNT=$(echo "$ALL_CHANGED_FILES" | wc -l)
        echo "Total files changed: $FILE_COUNT"

        if [ "$FILE_COUNT" -gt 200 ]; then
            echo "Too many files changed ($FILE_COUNT) - skipping detailed diff analysis"
            CODE_CHANGED_FILES=""
        else
            # Filter for relevant files in the monorepo
            CODE_CHANGED_FILES=$(echo "$ALL_CHANGED_FILES" | grep -v -E '^(docs/|issues/|plans/|specs/|\.github/|reports/)' | \
                grep -E '^(packages/stream/|packages/core/).*\.(ts|js|json|yml|yaml)$|^(package\.json|tsconfig|vitest\.config|\.changeset/)' || echo "")
        fi

        if [ -n "$CODE_CHANGED_FILES" ]; then
            CODE_FILE_COUNT=$(echo "$CODE_CHANGED_FILES" | wc -l)
            echo "Relevant monorepo files to analyze: $CODE_FILE_COUNT"

            if [ "$CODE_FILE_COUNT" -gt 50 ]; then
                echo "Too many code files changed ($CODE_FILE_COUNT) - providing file list only"
                DIFF_FULL="[DIFF TOO LARGE - $CODE_FILE_COUNT relevant files changed: $(echo "$CODE_CHANGED_FILES" | head -20 | tr '\n' ' ')...]"
                INCLUDE_DIFF_INSTRUCTION="Use 'git diff ${LAST_TAG}..HEAD -- packages/stream/' to check main package changes"
            else
                # Create filtered diff for packages/stream mainly
                FILTERED_DIFF=""
                for file in $CODE_CHANGED_FILES; do
                    if [ -f "$file" ]; then
                        FILTERED_DIFF="$FILTERED_DIFF$(git diff ${LAST_TAG}..HEAD -- "$file" 2>/dev/null || echo "")"
                    fi
                done

                if [ -n "$FILTERED_DIFF" ]; then
                    DIFF_LINES=$(echo "$FILTERED_DIFF" | wc -l)
                    DIFF_CHARS=$(echo "$FILTERED_DIFF" | wc -c)
                    echo "Filtered diff (relevant files only): $DIFF_LINES lines, $DIFF_CHARS characters"

                    if [ "$DIFF_LINES" -gt 3000 ] || [ "$DIFF_CHARS" -gt 80000 ]; then
                        echo "Even filtered diff is large - providing file list only"
                        DIFF_FULL="[DIFF TOO LARGE - Relevant files changed: $(echo "$CODE_CHANGED_FILES" | tr '\n' ' ')]"
                        INCLUDE_DIFF_INSTRUCTION="Use 'git diff ${LAST_TAG}..HEAD -- packages/stream/' to check main package changes"
                    else
                        DIFF_FULL="$FILTERED_DIFF"
                        INCLUDE_DIFF_INSTRUCTION=""
                    fi
                else
                    DIFF_FULL="[NO CODE CHANGES - Only documentation/config files changed]"
                    INCLUDE_DIFF_INSTRUCTION="No source code changes found. This release contains only documentation updates."
                fi
            fi
        else
            if [ "$FILE_COUNT" -gt 200 ]; then
                DIFF_FULL="[DIFF TOO LARGE - $FILE_COUNT total files changed - analysis skipped for performance]"
                INCLUDE_DIFF_INSTRUCTION="Use 'git diff ${LAST_TAG}..HEAD --stat' to see file changes"
            else
                DIFF_FULL="[NO CODE CHANGES - Only documentation/config files changed]"
                INCLUDE_DIFF_INSTRUCTION="No source code changes found. This release contains only documentation updates."
            fi
        fi
    else
        COMMIT_COUNT=0
        RECENT_COMMITS=""
        DIFF_STAT="No previous release found - this is the first release"
        DIFF_FULL=""
        CODE_CHANGED_FILES=""
        INCLUDE_DIFF_INSTRUCTION=""
    fi

    # Get current CHANGELOG content
    CHANGELOG_CONTENT=$(head -100 "$CHANGELOG_FILE" 2>/dev/null || echo "# Changelog\n\nAll notable changes to this project will be documented in this file.")

    echo "Changes to analyze: $COMMIT_COUNT commits"
    echo
}

# Function to generate AI changelog and update READMEs
generate_ai_updates() {
    print_ai "Analyzing changes and updating CHANGELOG.md, README.md, and package READMEs..."

    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "Dry run: Skipping AI-powered CHANGELOG and README updates"
        return
    fi

    # Check if timeout command is available
    if command -v gtimeout >/dev/null 2>&1; then
        TIMEOUT_CMD="gtimeout 600"
    elif command -v timeout >/dev/null 2>&1; then
        TIMEOUT_CMD="timeout 600"
    else
        print_warning "No timeout command available. Install coreutils on macOS: brew install coreutils"
        TIMEOUT_CMD=""
    fi

    # Temporarily disable exit on error for AI command
    set +e

    local prompt="You are preparing a new $RELEASE_TYPE release for the Agent-IO monorepo.

CURRENT SITUATION:
- This is a monorepo with multiple packages
- Main package: @agent-io/stream (universal JSONL formatter for AI agent CLIs)
- Current @agent-io/stream version: $STREAM_VERSION
- Latest published version on NPM: ${PUBLISHED_STREAM:-"Not published yet"}
- Reference version for changes: ${LAST_TAG#v}
- Release type: $RELEASE_TYPE
- Date: $(date +%Y-%m-%d)

COMMITS SINCE LAST RELEASE ($COMMIT_COUNT commits):
$RECENT_COMMITS

RELEVANT FILES CHANGED (monorepo filtered):
$(echo "$CODE_CHANGED_FILES" | tr '\n' ' ')

FILE CHANGES STATISTICS (all files):
$DIFF_STAT

ACTUAL CODE CHANGES (filtered - relevant files only):
$DIFF_FULL

$INCLUDE_DIFF_INSTRUCTION

CURRENT CHANGELOG (first 100 lines):
$CHANGELOG_CONTENT

TASKS:
1. CHANGELOG.md Update:
   - Analyze the ACTUAL CODE CHANGES (not just commit messages)
   - Focus on changes to packages/stream/ (the main published package)
   - Write accurate changelog entries based on the code changes:
     * Fixed: bug fixes (what was actually fixed in the code)
     * Added: new features (what new functionality was added)
     * Changed: changes to existing functionality (what behavior changed)
     * Removed: removed features (what was deleted)
     * Security: security fixes
     * Documentation: documentation only changes
   - Add a new section at the top of CHANGELOG.md for the upcoming version
   - Follow the Keep a Changelog format with today's date ($(date +%Y-%m-%d))
   - Only include categories that have changes
   - Since this is a monorepo, focus on user-facing changes to @agent-io/stream

2. README.md Update:
   - Review the new features and changes you're adding to CHANGELOG.md
   - Update README.md to ensure all new features are properly documented:
     * Add new CLI flags/options to usage examples
     * Update feature lists to include major new functionality
     * Ensure usage examples reflect any changed behavior
     * Add any new configuration options or environment variables
   - Maintain consistency with the existing README structure and style
   - Focus on the main @agent-io/stream package features

3. Package README Update (packages/stream/README.md):
   - Check if the package README needs the same updates as the main README
   - Ensure CLI examples are correct and match the current implementation
   - Update any version-specific documentation
   - Keep package README focused on usage as a standalone npm package

IMPORTANT:
- DO NOT update package.json files or create any git commits - those will be handled separately
- DO NOT modify changeset files - those will be handled by the script
- Focus on accuracy - changelog entries should reflect actual code changes, not just commit messages
- Since only @agent-io/stream is published, focus on changes to that package
- Ensure README.md is comprehensive and up-to-date with all features in the new release"

    $TIMEOUT_CMD $AI_CLI $AI_MODEL $AI_FLAGS -p "$prompt" | aio-stream

    AI_EXIT_CODE=$?
    set -e  # Re-enable exit on error

    if [ $AI_EXIT_CODE -eq 124 ]; then
        print_error "$AI_CLI command timed out after 10 minutes."
        exit 1
    elif [ $AI_EXIT_CODE -ne 0 ]; then
        print_error "$AI_CLI command failed with exit code $AI_EXIT_CODE"
        exit 1
    fi

    print_success "CHANGELOG.md and all READMEs updated successfully!"
}

# Function to create changeset in non-interactive mode
create_changeset() {
    print_step "Creating changeset for $RELEASE_TYPE release..."

    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "Dry run: Would create changeset for $RELEASE_TYPE release"
        return
    fi

    # Get a summary from the recent commits for changeset description
    local changeset_summary="$RELEASE_TYPE release with improvements and fixes"
    if [ -n "$RECENT_COMMITS" ]; then
        # Extract first line of most recent meaningful commit
        changeset_summary=$(echo "$RECENT_COMMITS" | head -1 | sed 's/^[a-f0-9]* //' || echo "$RELEASE_TYPE release")
    fi

    # Create changeset file manually since we need non-interactive mode
    local changeset_id="$(openssl rand -hex 4)"
    local changeset_file=".changeset/${changeset_id}.md"

    cat > "$changeset_file" << EOF
---
"@agent-io/stream": $RELEASE_TYPE
---

$changeset_summary
EOF

    print_success "Changeset created: $changeset_file"
}

# Function to version and publish via changeset
version_and_publish() {
    print_step "Running changeset version and creating release commit..."

    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "Dry run: Would run changeset version and create commit"
        return
    fi

    # Run changeset version to update package.json and CHANGELOG
    npm run version

    # Add all changes including the updated CHANGELOG and package.json
    git add .

    # Create release commit
    local commit_message="chore: prepare release

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

    git commit -m "$commit_message"

    print_success "Release commit created"
}

# Function to show release summary
show_release_summary() {
    echo
    print_success "Release preparation complete!"
    echo
    echo "📊 Release Summary:"
    echo "  Previous version: $STREAM_VERSION"
    echo "  Release type:     $RELEASE_TYPE"
    echo "  Commits included: $COMMIT_COUNT"
    echo
    echo "  Package: @agent-io/stream (main package)"
    echo

    if [[ "$DRY_RUN" == "false" ]]; then
        echo "🚀 Next steps:"
        echo "  1. Review the changes: git diff HEAD~1"
        echo "  2. Push to GitHub: git push origin main"
        echo "  3. GitHub Actions will automatically:"
        echo "     - Create release PR or publish if PR exists"
        echo "     - Tag the release"
        echo "     - Publish to npm"
        echo "     - Create GitHub release"
        echo
        echo "🔗 Links:"
        echo "  - GitHub Actions: https://github.com/carlrannaberg/agent-io/actions"
        echo "  - NPM Package: https://www.npmjs.com/package/@agent-io/stream"
        echo "  - Releases: https://github.com/carlrannaberg/agent-io/releases"
    else
        echo "💡 This was a dry run. No changes were made."
        echo "   Remove --dry-run to perform the actual release preparation."
    fi
    echo
}

# Function to cleanup temporary files
cleanup() {
    rm -f /tmp/agent-io-*.txt /tmp/agent-io-*.md
}

# Function to handle script interruption
handle_interrupt() {
    echo
    print_warning "Script interrupted"
    cleanup
    exit 130
}

# Main function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--type)
                RELEASE_TYPE="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -y|--yes)
                INTERACTIVE=false
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Set up interrupt handler
    trap handle_interrupt SIGINT SIGTERM

    echo
    print_info "Agent-IO - AI-Powered Release Preparation"
    echo

    # Validate release type if provided
    if [[ -n "$RELEASE_TYPE" ]]; then
        case "$RELEASE_TYPE" in
            patch|minor|major) ;;
            *)
                print_error "Invalid release type: $RELEASE_TYPE"
                print_info "Valid types: patch, minor, major"
                exit 1
                ;;
        esac
    fi

    # Main workflow
    detect_ai_cli
    validate_environment
    prompt_release_type
    run_tests

    # Pre-compute all data for AI
    pre_compute_release_data

    print_info "Preparing $RELEASE_TYPE release for @agent-io/stream"
    echo

    if [[ "$INTERACTIVE" == "true" ]]; then
        read -p "Continue with release preparation? [Y/n]: " -r
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            print_info "Release preparation cancelled"
            exit 0
        fi
    fi

    # Run the release preparation with AI
    generate_ai_updates

    # Create changeset and prepare release
    create_changeset
    version_and_publish

    # Show summary
    show_release_summary

    # Cleanup
    cleanup

    print_success "Release preparation script completed successfully!"
}

# Run main function with all arguments
main "$@"