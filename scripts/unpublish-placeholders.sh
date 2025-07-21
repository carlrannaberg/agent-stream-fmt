#!/bin/bash

# Script to unpublish placeholder packages from npm
# These packages were published but are not actually used

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  This script will unpublish placeholder packages from npm${NC}"
echo -e "${YELLOW}⚠️  These packages are not used and were published by mistake${NC}"
echo

# Packages to unpublish (all versions)
PACKAGES=(
    "@agent-io/core"
    "@agent-io/jsonl"
    "@agent-io/invoke"
)

echo "Packages to unpublish:"
for pkg in "${PACKAGES[@]}"; do
    echo "  - $pkg"
done
echo

read -p "Are you sure you want to unpublish these packages? [y/N]: " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

echo

for pkg in "${PACKAGES[@]}"; do
    echo -e "${YELLOW}Unpublishing $pkg...${NC}"
    
    # Check if package exists
    if npm view "$pkg" version >/dev/null 2>&1; then
        # Get all versions
        VERSIONS=$(npm view "$pkg" versions --json | jq -r '.[]' 2>/dev/null || npm view "$pkg" version)
        
        if [ -n "$VERSIONS" ]; then
            # If multiple versions, unpublish each
            if echo "$VERSIONS" | grep -q $'\n'; then
                echo "$VERSIONS" | while read -r version; do
                    echo "  Unpublishing $pkg@$version"
                    npm unpublish "$pkg@$version" --force || echo -e "${RED}Failed to unpublish $pkg@$version${NC}"
                done
            else
                # Single version
                echo "  Unpublishing $pkg@$VERSIONS"
                npm unpublish "$pkg@$VERSIONS" --force || echo -e "${RED}Failed to unpublish $pkg@$VERSIONS${NC}"
            fi
        fi
        echo -e "${GREEN}✅ $pkg unpublished${NC}"
    else
        echo -e "${YELLOW}$pkg not found on npm, skipping${NC}"
    fi
    echo
done

echo -e "${GREEN}✅ Placeholder packages unpublished${NC}"
echo
echo "Note: The @agent-io/stream package (the main package) is still published and available."