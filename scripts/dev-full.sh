#!/bin/bash
# Comprehensive development setup with type generation, hot-reload, and asset building

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting full development environment...${NC}"

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check if cargo-watch is installed
if ! command -v cargo-watch &> /dev/null; then
    echo -e "${YELLOW}⚠️  cargo-watch not found. Installing...${NC}"
    cargo install cargo-watch
fi

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing npm dependencies...${NC}"
    npm install
fi

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}👋 Stopping development environment...${NC}"
    # Kill all child processes
    pkill -P $$
    exit 0
}

# Set up trap to call cleanup on SIGINT (Ctrl+C)
trap cleanup SIGINT

# Generate initial TypeScript types
echo -e "${GREEN}🔄 Generating initial TypeScript types...${NC}"
cargo run --bin generate-types

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Initial type generation completed${NC}"
else
    echo -e "${RED}❌ Initial type generation failed${NC}"
fi

# Build initial CSS
echo -e "${GREEN}🎨 Building initial CSS...${NC}"
npm run build-css

# Build initial JavaScript
echo -e "${GREEN}📦 Building initial JavaScript...${NC}"
npm run build-js:dev

echo -e "${GREEN}✅ Development environment setup complete!${NC}"
echo -e "${YELLOW}📁 Watching for changes in:${NC}"
echo -e "${YELLOW}  - src/ (Rust code + type regeneration)${NC}"
echo -e "${YELLOW}  - templates/ (HTML templates)${NC}"
echo -e "${YELLOW}  - static/ (CSS, JS, assets)${NC}"
echo -e "${YELLOW}  - config/ (Configuration files)${NC}"
echo -e "${YELLOW}🔄 Server will restart automatically on backend changes${NC}"
echo -e "${YELLOW}🔥 Frontend changes will trigger browser hot-reload${NC}"
echo -e "${YELLOW}⚡ TypeScript types will be regenerated when Rust types change${NC}"
echo -e "${YELLOW}📝 Press Ctrl+C to stop${NC}\n"

# Start multiple watchers in parallel
echo -e "${BLUE}🏃 Starting watchers...${NC}"

# Start CSS watcher in background
echo -e "${GREEN}🎨 Starting CSS watcher...${NC}"
npm run watch-css &
CSS_PID=$!

# Start TypeScript type watcher in background
echo -e "${GREEN}⚡ Starting TypeScript type watcher...${NC}"
cargo-watch \
    -x "run --bin generate-types" \
    -w src/shared/state.rs \
    -w src/shared/types.rs \
    -w src/dashboard/types.rs \
    -w src/tools/ \
    --delay 1 \
    --ignore-nothing &
TYPE_PID=$!

# Start main server watcher (this will run in foreground)
echo -e "${GREEN}🚀 Starting main server watcher...${NC}"
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
    -i "static/js/types/generated/*" \
    --why

# This line will only be reached if cargo-watch exits unexpectedly
echo -e "${RED}❌ Main server watcher exited unexpectedly${NC}"
kill $CSS_PID $TYPE_PID 2>/dev/null