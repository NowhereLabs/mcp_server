#!/bin/bash

# Build script for Rust MCP Server with Tailwind CSS and Alpine.js

set -e

# Set build mode (default to production)
BUILD_MODE="${BUILD_MODE:-production}"

echo "Building in ${BUILD_MODE} mode..."

echo "Installing dependencies..."
npm install

echo "Building Tailwind CSS..."
npm run build-css

echo "Building Alpine.js components..."
if [ "$BUILD_MODE" = "development" ]; then
    npm run build-js:dev
else
    npm run build-js:prod
fi

echo "Building Rust project..."
cargo build --release

echo "Running linter..."
cargo clippy -- -D warnings

echo "Build complete!"

# Show bundle analysis in development mode
if [ "$BUILD_MODE" = "development" ] && [ -f "static/js/bundle-meta.json" ]; then
    echo "Bundle analysis:"
    echo "$(ls -lh static/js/dashboard.min.js | awk '{print $5}') - dashboard.min.js"
fi