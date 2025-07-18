# Docker Deployment Guide

This guide covers deploying the Rust MCP Server with Dashboard using Docker.

## Quick Start

```bash
# Build and run with docker-compose
docker-compose -f docker/docker-compose.yml up --build

# Or use the convenience script
./docker/build-docker.sh

# Access the dashboard at http://localhost:8080
```

## Docker Architecture

The project uses a multi-stage Docker build for optimal image size and security:

1. **Node.js Stage**: Builds CSS and TypeScript assets
2. **Rust Build Stage**: Compiles the Rust binary
3. **Runtime Stage**: Minimal image with just the binary and assets

## Files Overview

All Docker-related files are in the `docker/` directory:

- `Dockerfile`: Multi-stage build configuration
- `docker-compose.yml`: Service orchestration
- `nginx.conf`: Reverse proxy configuration
- `build-docker.sh`: Convenience build script

## Building the Image

### Using Docker Compose (Recommended)

```bash
# Build and run
docker-compose -f docker/docker-compose.yml up --build

# Run in background
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Stop services
docker-compose -f docker/docker-compose.yml down
```

### Using Docker Directly

```bash
# Build the image
docker build -f docker/Dockerfile -t rust-mcp-server .

# Run the container
docker run -p 8080:8080 rust-mcp-server

# Run with custom environment variables
docker run -p 8080:8080 \
  -e RUST_LOG=debug \
  -e DASHBOARD_PORT=8080 \
  rust-mcp-server
```

## Environment Variables

Configure the server through environment variables in `docker-compose.yml`:

### Logging
- `RUST_LOG`: Set logging level (default: `info`)
- `RUST_BACKTRACE`: Enable panic backtraces (default: `1`)

### Dashboard Configuration
- `DASHBOARD_HOST`: Bind address (default: `0.0.0.0` in Docker)
- `DASHBOARD_PORT`: Port number (default: `8080`)
- `HEARTBEAT_INTERVAL_MS`: WebSocket heartbeat interval (default: `500`)
- `STATUS_UPDATE_INTERVAL_MS`: Status update frequency (default: `1000`)
- `METRICS_UPDATE_INTERVAL_MS`: Metrics update frequency (default: `2000`)

### Security Settings
- `MAX_TOOL_EXECUTION_TIME_MS`: Tool timeout (default: `30000`)
- `MAX_CONCURRENT_TOOL_CALLS`: Concurrent tool limit (default: `10`)
- `MAX_FILE_SIZE_BYTES`: Maximum file size (default: `10485760`)
- `ALLOWED_FILE_EXTENSIONS`: Comma-separated list (default: `txt,json,toml,yaml,yml,md,log`)

### Rate Limiting
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: Request limit (default: `60`)
- `RATE_LIMIT_BURST_SIZE`: Burst allowance (default: `10`)

## Production Deployment

### Using Nginx Reverse Proxy

The included `nginx.conf` provides:
- WebSocket upgrade handling
- Gzip compression
- Security headers
- Static asset caching

To use with docker-compose:

```yaml
services:
  mcp-server:
    # ... existing config ...
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - mcp-server
```

### Health Checks

The Dockerfile includes a health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

### Security Considerations

1. **Non-root User**: The container runs as user `mcpuser` (UID 1001)
2. **Minimal Base Image**: Uses `debian:bookworm-slim` for smaller attack surface
3. **No Shell**: Production image doesn't include development tools
4. **Read-only Filesystem**: Can be run with `--read-only` flag

Example secure deployment:

```bash
docker run \
  --read-only \
  --tmpfs /tmp \
  --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  -p 8080:8080 \
  rust-mcp-server
```

## Volumes and Persistence

The MCP server is stateless by design. If you need persistence:

```yaml
services:
  mcp-server:
    volumes:
      - ./data:/app/data  # For file operations
      - ./logs:/app/logs  # For log files
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker-compose -f docker/docker-compose.yml logs mcp-server
```

### Permission issues

Ensure files are accessible by UID 1001:
```bash
chown -R 1001:1001 ./data
```

### Build failures

Clear Docker cache and rebuild:
```bash
docker-compose -f docker/docker-compose.yml build --no-cache
```

### Network issues

Verify port isn't already in use:
```bash
lsof -i :8080
```

## Development with Docker

For development, you can mount source code:

```yaml
services:
  mcp-server:
    volumes:
      - ./src:/app/src:ro
      - ./templates:/app/templates:ro
      - ./static:/app/static:ro
    environment:
      - RUST_LOG=debug
      - ENABLE_CORS=true
```

Note: This requires rebuilding when Rust code changes.

## Monitoring

### Viewing Metrics

Access the dashboard at `http://localhost:8080` to see:
- Real-time server status
- Tool execution metrics
- Active sessions
- Event history

### Container Stats

Monitor resource usage:
```bash
docker stats rust-mcp-server
```

### Logs

View structured logs:
```bash
docker-compose -f docker/docker-compose.yml logs -f --tail=100
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Build Docker image
  run: docker build -f docker/Dockerfile -t rust-mcp-server:${{ github.sha }} .

- name: Run tests in Docker
  run: docker run --rm rust-mcp-server:${{ github.sha }} cargo test

- name: Push to registry
  run: |
    docker tag rust-mcp-server:${{ github.sha }} myregistry/rust-mcp-server:latest
    docker push myregistry/rust-mcp-server:latest
```

## Updating

To update to a new version:

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker/docker-compose.yml up --build -d

# Remove old images
docker image prune -f
```