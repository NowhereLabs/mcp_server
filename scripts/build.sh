#!/bin/bash

# Build script for Rust MCP Server with Tailwind CSS and Alpine.js

set -e

# Set build mode (default to production)
BUILD_MODE="${BUILD_MODE:-production}"

echo "Building in ${BUILD_MODE} mode..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to handle errors gracefully
handle_error() {
    echo "Error: $1" >&2
    echo "Build failed at step: $2" >&2
    exit 1
}

# Validate prerequisites
echo "Validating prerequisites..."
if ! command_exists node; then
    handle_error "Node.js is not installed. Please install Node.js 18 or later." "prerequisite validation"
fi

if ! command_exists npm; then
    handle_error "npm is not installed. Please install npm." "prerequisite validation"
fi

if ! command_exists cargo; then
    handle_error "Rust/Cargo is not installed. Please install Rust toolchain." "prerequisite validation"
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    handle_error "Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18 or later." "prerequisite validation"
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    handle_error "package.json not found. Please run this script from the project root." "prerequisite validation"
fi

# Check if Cargo.toml exists
if [ ! -f "Cargo.toml" ]; then
    handle_error "Cargo.toml not found. Please run this script from the project root." "prerequisite validation"
fi

echo "Installing dependencies..."
if ! npm install; then
    handle_error "Failed to install npm dependencies" "dependency installation"
fi

echo "Building Tailwind CSS..."
if ! npm run build-css; then
    handle_error "Failed to build Tailwind CSS" "CSS build"
fi

# Verify CSS output was generated
if [ ! -f "static/css/output.css" ]; then
    handle_error "CSS output file not generated" "CSS build validation"
fi

echo "Building Alpine.js components..."
if [ "$BUILD_MODE" = "development" ]; then
    if ! npm run build-js:dev; then
        handle_error "Failed to build TypeScript components in development mode" "TypeScript build"
    fi
else
    if ! npm run build-js:prod; then
        handle_error "Failed to build TypeScript components in production mode" "TypeScript build"
    fi
fi

# Verify TypeScript output was generated
if [ ! -f "static/js/dashboard.min.js" ]; then
    handle_error "TypeScript output file not generated" "TypeScript build validation"
fi

echo "Building Rust project..."
if ! cargo build --release; then
    handle_error "Failed to build Rust project" "Rust build"
fi

# Verify Rust binary was generated
if [ ! -f "target/release/rust-mcp-server" ]; then
    handle_error "Rust binary not generated" "Rust build validation"
fi

echo "Running linter..."
if ! cargo clippy -- -D warnings; then
    handle_error "Linter found issues that need to be fixed" "linting"
fi

echo "Running formatter check..."
if ! cargo fmt --check; then
    echo "Warning: Code formatting issues found. Run 'cargo fmt' to fix them."
fi

echo "Running tests..."
if ! cargo test; then
    handle_error "Tests failed" "testing"
fi

echo "Build complete!"

# Show build summary
echo "Build summary:"
echo "- Mode: ${BUILD_MODE}"
echo "- CSS: $(ls -lh static/css/output.css 2>/dev/null | awk '{print $5}' || echo 'N/A') - output.css"
echo "- JS: $(ls -lh static/js/dashboard.min.js 2>/dev/null | awk '{print $5}' || echo 'N/A') - dashboard.min.js"
echo "- Binary: $(ls -lh target/release/rust-mcp-server 2>/dev/null | awk '{print $5}' || echo 'N/A') - rust-mcp-server"

# Show bundle analysis in development mode
if [ "$BUILD_MODE" = "development" ] && [ -f "static/js/bundle-meta.json" ]; then
    echo "Bundle analysis:"
    echo "$(ls -lh static/js/dashboard.min.js | awk '{print $5}') - dashboard.min.js"
fi

echo "Build successful! You can now run the server with: ./target/release/rust-mcp-server"