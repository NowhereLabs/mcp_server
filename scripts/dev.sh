#!/bin/bash
# Development script with hot-reload for Rust MCP server

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting development mode with hot-reload...${NC}"

# Check if cargo-watch is installed
if ! command -v cargo-watch &> /dev/null; then
    echo -e "${YELLOW}⚠️  cargo-watch not found. Installing...${NC}"
    cargo install cargo-watch
fi

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}👋 Stopping development server...${NC}"
    # Kill all child processes
    pkill -P $$
    exit 0
}

# Set up trap to call cleanup on SIGINT (Ctrl+C)
trap cleanup SIGINT

# Start cargo-watch with proper arguments
echo -e "${GREEN}✅ Starting cargo-watch...${NC}"
echo -e "${YELLOW}📁 Watching for changes in src/, templates/, static/, and config/${NC}"
echo -e "${YELLOW}🔄 Server will restart automatically on backend changes${NC}"
echo -e "${YELLOW}🔥 Frontend changes will trigger browser hot-reload${NC}"
echo -e "${YELLOW}⚡ TypeScript types will be regenerated when Rust types change${NC}"
echo -e "${YELLOW}📝 Press Ctrl+C to stop${NC}\n"

# Run cargo-watch
# -x: Execute command
# -w: Watch additional paths
# -i: Ignore paths
# --why: Show which files triggered the rebuild
cargo-watch \
    -x "run -- --mode=dashboard --dev" \
    -w src \
    -w Cargo.toml \
    -w templates \
    -w static \
    -w config \
    -i "target/*" \
    -i "*.log" \
    -i "static/css/output.css" \
    --why

# This line will only be reached if cargo-watch exits unexpectedly
echo -e "${RED}❌ cargo-watch exited unexpectedly${NC}"