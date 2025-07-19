#!/bin/bash
# Watch for Rust type changes and regenerate TypeScript types

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Starting TypeScript type generation watcher...${NC}"

# Check if cargo-watch is installed
if ! command -v cargo-watch &> /dev/null; then
    echo -e "${YELLOW}⚠️  cargo-watch not found. Installing...${NC}"
    cargo install cargo-watch
fi

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}👋 Stopping type generation watcher...${NC}"
    # Kill all child processes
    pkill -P $$
    exit 0
}

# Set up trap to call cleanup on SIGINT (Ctrl+C)
trap cleanup SIGINT

# Generate types initially
echo -e "${GREEN}🔄 Generating initial TypeScript types...${NC}"
cargo run --bin generate-types

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Initial type generation completed${NC}"
else
    echo -e "${RED}❌ Initial type generation failed${NC}"
fi

echo -e "${YELLOW}👀 Watching for changes in Rust type files...${NC}"
echo -e "${YELLOW}📝 Press Ctrl+C to stop${NC}\n"

# Watch for changes in Rust files that contain type definitions
cargo-watch \
    -x "run --bin generate-types" \
    -w src/shared/state.rs \
    -w src/shared/types.rs \
    -w src/dashboard/types.rs \
    -w src/tools/ \
    --why \
    --delay 1 \
    --ignore-nothing