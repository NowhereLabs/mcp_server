# Rust MCP Server - Docker Setup

This guide explains how to run the Rust MCP Server using Docker.

## Quick Start

### Using Docker Compose (Recommended)

#### Production Mode
1. **Build and run the server:**
   ```bash
   docker-compose up --build
   ```

2. **Access the dashboard:**
   - Open your browser to http://localhost:8080
   - The dashboard will show available tools with executable buttons

3. **Stop the server:**
   ```bash
   docker-compose down
   ```

#### Development Mode (with debug features)
1. **Run development server:**
   ```bash
   docker-compose --profile development up --build
   ```

2. **Access debug routes:**
   - Dashboard: http://localhost:8080
   - Debug config: http://localhost:8080/debug/config
   - Debug state: http://localhost:8080/debug/state
   - Debug events: http://localhost:8080/debug/events

#### With Nginx Reverse Proxy
1. **Run with nginx (production):**
   ```bash
   docker-compose --profile production up --build
   ```

2. **Access via nginx:**
   - Dashboard: http://localhost (port 80)

### Using Docker directly

1. **Build the image:**
   ```bash
   docker build -t rust-mcp-server .
   ```

2. **Run the container:**
   ```bash
   docker run -p 8080:8080 --name mcp-server rust-mcp-server
   ```

3. **Stop the container:**
   ```bash
   docker stop mcp-server && docker rm mcp-server
   ```

## Available Tools

The dashboard provides buttons to execute the following tools:

- **read_file**: Read contents of a file (default: `/etc/hostname`)
- **write_file**: Write content to a file (default: `/tmp/test.txt`)
- **list_directory**: List directory contents (default: `/tmp`)
- **http_get**: Make HTTP GET request (simulated)
- **http_post**: Make HTTP POST request (simulated)
- **system_info**: Get system information (OS, architecture, etc.)

## Configuration

### Environment Variables

#### Logging & Debug
- `RUST_LOG`: Set logging level (default: `rust_mcp_server=info,mcp_server=info`)
- `RUST_BACKTRACE`: Enable backtrace on panic (default: `1`)

#### Server Configuration  
- `DASHBOARD_PORT`: Dashboard server port (default: `8080`)
- `DASHBOARD_HOST`: Dashboard bind address (default: `0.0.0.0`)

#### Security Settings
- `MAX_TOOL_EXECUTION_TIME_MS`: Tool execution timeout (default: `30000`)
- `MAX_CONCURRENT_TOOL_CALLS`: Max concurrent tool calls (default: `10`)
- `MAX_FILE_SIZE_BYTES`: Max file size for operations (default: `10485760`)
- `ALLOWED_FILE_EXTENSIONS`: Comma-separated allowed extensions (default: `txt,json,toml,yaml,yml,md,log`)

#### Rate Limiting
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: API rate limit (default: `60`)
- `RATE_LIMIT_BURST_SIZE`: Rate limit burst size (default: `10`)

#### Resource Limits
- `MAX_HTTP_RESPONSE_SIZE_BYTES`: Max HTTP response size (default: `5242880`)
- `HTTP_TIMEOUT_SECONDS`: HTTP request timeout (default: `30`)

#### Development Settings
- `ENABLE_CORS`: Enable CORS headers (default: `false` in production, `true` in development)
- `ENABLE_DEBUG_ROUTES`: Enable debug endpoints (default: `false` in production, `true` in development)

### Profiles

The docker-compose.yml supports multiple profiles:

- **Default (Production)**: Secure settings, debug features disabled
- **Development**: Debug enabled, relaxed limits, CORS enabled  
- **Production**: With nginx reverse proxy and optimized settings

### Volumes

The docker-compose.yml mounts:
- `/tmp/mcp-server` for file operations
- Static files and templates for development
- `.env` file for configuration (development profile only)

## Production Deployment

For production use with nginx reverse proxy:

```bash
docker-compose --profile production up --build
```

This will:
- Start the MCP server on port 8080
- Start nginx on port 80 with:
  - Gzip compression
  - Static file caching
  - WebSocket support
  - SSE (Server-Sent Events) support

## Health Checks

The container includes health checks that verify the `/health` endpoint.

## Security

- Runs as non-root user (`mcpuser`)
- Minimal base image (debian:bookworm-slim)
- Only necessary packages installed
- File operations are limited to mounted volumes

## Development

For development, you can mount your local source code:

```bash
# Edit docker-compose.yml to add:
volumes:
  - ./src:/app/src:ro
  - ./templates:/app/templates:ro
  - ./static:/app/static:ro
```

Then rebuild when code changes:
```bash
docker-compose up --build
```

## Troubleshooting

### View logs:
```bash
docker-compose logs -f mcp-server
```

### Enter container:
```bash
docker-compose exec mcp-server bash
```

### Check health:
```bash
curl http://localhost:8080/health
```

## API Testing

Test tool execution via API:

```bash
# Test system info
curl -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "system_info", "arguments": {}}'

# Test file read
curl -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "read_file", "arguments": {"path": "/etc/hostname"}}'

# Test file write
curl -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "write_file", "arguments": {"path": "/tmp/docker-test.txt", "content": "Hello from Docker!"}}'

# Test directory listing
curl -X POST http://localhost:8080/api/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name": "list_directory", "arguments": {"path": "/tmp"}}'
```

## Dashboard Features

The web dashboard (http://localhost:8080) includes:

- **Live server status** with connection indicators
- **Performance metrics** showing tool call statistics  
- **Available tools** with clickable execute buttons
- **Recent tool calls** history with success/failure status
- **Real-time events** via Server-Sent Events (SSE)
- **WebSocket support** for live updates

## Testing Results

✅ **Docker Build**: Successfully builds multi-stage image with Rust 1.82+
✅ **Health Check**: `/health` endpoint returns status and timestamp
✅ **Tool Execution**: All 6 tools (system_info, read_file, write_file, list_directory, http_get, http_post) working
✅ **File Operations**: Can read from `/etc/` and write to `/tmp/`
✅ **Dashboard UI**: Responsive web interface with working execute buttons
✅ **Real-time Updates**: SSE and WebSocket connections functional