#!/bin/bash

# Build script for Rust MCP Server with Tailwind CSS

set -e

echo "Building Tailwind CSS..."
npm install
npm run build-css

echo "Building Rust project..."
cargo build --release

echo "Build complete!"