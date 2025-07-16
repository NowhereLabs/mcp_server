#!/bin/bash
set -e

echo "🐳 Building Rust MCP Server Docker Image..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t rust-mcp-server .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo ""
    echo "🚀 To run the container:"
    echo "  docker run -p 8080:8080 rust-mcp-server"
    echo ""
    echo "🔧 Or use Docker Compose:"
    echo "  docker-compose up"
    echo ""
    echo "🌐 Then open: http://localhost:8080"
else
    echo "❌ Docker build failed!"
    exit 1
fi