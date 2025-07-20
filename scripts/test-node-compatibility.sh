#!/bin/bash
# Test script to validate Node.js version compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Node.js Compatibility Test Script"
echo "======================================"

# Check current Node.js version
echo -e "\n${YELLOW}Current Node.js version:${NC}"
node --version

# Check if version meets requirements
NODE_VERSION=$(node -p "process.version")
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}❌ Error: Node.js version $NODE_VERSION is not supported. Minimum required: v18.0.0${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version meets requirements (>=18.0.0)${NC}"

# Test package.json engines field
echo -e "\n${YELLOW}Testing package.json engines constraint:${NC}"
npm run typecheck

echo -e "\n${YELLOW}Testing build process:${NC}"
npm run build

echo -e "\n${YELLOW}Testing core functionality:${NC}"
npm test -- --run src/types.test.ts src/parsers/claude.test.ts

echo -e "\n${YELLOW}Testing CLI functionality:${NC}"
echo '{"type":"message","role":"assistant","content":"Compatibility test"}' | node dist/cli.js --vendor claude

echo -e "\n${YELLOW}Testing auto-detection:${NC}"
echo '{"type":"message","role":"assistant","content":"Auto-detect test"}' | node dist/cli.js

echo -e "\n${YELLOW}Testing HTML output:${NC}"
echo '{"type":"message","role":"assistant","content":"HTML test"}' | node dist/cli.js --html > /tmp/test-output.html
if [ -s /tmp/test-output.html ]; then
    echo -e "${GREEN}✅ HTML output generated successfully${NC}"
else
    echo -e "${RED}❌ HTML output generation failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Testing JSON output:${NC}"
echo '{"type":"message","role":"assistant","content":"JSON test"}' | node dist/cli.js --json

echo -e "\n${YELLOW}Testing package installation simulation:${NC}"
npm pack > /dev/null 2>&1
PACKAGE_FILE=$(ls agent-stream-fmt-*.tgz)
echo "Package file: $PACKAGE_FILE"

# Test in temporary directory
TEST_DIR="/tmp/node-compat-test-$$"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"
npm init -y > /dev/null 2>&1
npm install "$OLDPWD/$PACKAGE_FILE" > /dev/null 2>&1

echo -e "${GREEN}✅ Package installed successfully${NC}"

# Test CLI from installed package
echo '{"type":"message","role":"assistant","content":"Installed package test"}' | npx agent-stream-fmt

# Test programmatic usage
cat > test-import.mjs << 'EOF'
import { streamEvents } from 'agent-stream-fmt';

const data = ['{"type":"message","role":"assistant","content":"Programmatic test"}'];

for await (const event of streamEvents({ vendor: 'claude', source: data })) {
  console.log(`Event type: ${event.t}`);
  if (event.t === 'msg') {
    console.log(`Message: ${event.text}`);
  }
}
EOF

echo -e "\n${YELLOW}Testing programmatic usage:${NC}"
node test-import.mjs

# Cleanup
cd "$OLDPWD"
rm -rf "$TEST_DIR"
rm -f "$PACKAGE_FILE"

echo -e "\n${GREEN}🎉 All Node.js compatibility tests passed!${NC}"
echo -e "${GREEN}✅ Node.js $NODE_VERSION is fully supported${NC}"