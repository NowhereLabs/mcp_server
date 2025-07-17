# Rust MCP Server with Real-time Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-blue)](https://github.com/NowhereLabs/mcp_server/pkgs/container/rust-mcp-server)

A high-performance Model Context Protocol (MCP) server implementation in Rust with an integrated real-time web dashboard for monitoring and debugging.

## Features

- **MCP Protocol Implementation**: Built with the official MCP SDK for Claude Desktop integration
- **Real-time Web Dashboard**: Monitor server status, tool executions, and metrics via WebSocket
- **Flexible Operation Modes**: Run MCP server only, dashboard only, or both together
- **High-Performance Architecture**: Lock-free concurrent data structures for optimal throughput
- **Alpine.js Frontend**: Reactive UI components with Tailwind CSS styling
- **Docker Support**: Production-ready containerization with multi-stage builds

## Quick Start

### Prerequisites

- Rust 1.82+ (for local development)
- Node.js 20+ (for building frontend assets)
- Docker & Docker Compose (for containerized deployment)

### Installation Options

#### Using GitHub Packages Docker Image

```bash
# Pull the latest image
docker pull ghcr.io/nowherelabs/rust-mcp-server:latest

# Run with docker-compose
docker run -p 8080:8080 ghcr.io/nowherelabs/rust-mcp-server:latest

# Or use a specific version
docker pull ghcr.io/nowherelabs/rust-mcp-server:v0.1.1
```

#### Building from Source

```bash
# Build and run with docker-compose
docker-compose -f docker/docker-compose.yml up --build

# Or use the build script
./docker/build-docker.sh

# Access the dashboard at http://localhost:8080
```

### Running Locally

```bash
# Install dependencies and build everything
./scripts/build.sh

# Or build components separately:
npm install
npm run build-css
npm run build-js:prod
cargo build --release

# Run the server (defaults to both MCP and dashboard)
cargo run --release

# Run specific modes
cargo run --release -- --mode=mcp-only    # MCP server only
cargo run --release -- --mode=dashboard   # Dashboard only  
cargo run --release -- --mode=both        # Both (default)

# Access the dashboard at http://localhost:8080
```

## Project Structure

```
.
├── config/           # Configuration files
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vitest.config.js
│   ├── esbuild.config.js
│   ├── rustfmt.toml
│   └── clippy.toml
├── docker/           # Docker deployment files
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── build-docker.sh
├── docs/             # Documentation
│   ├── CLAUDE.md     # Claude Code instructions
│   └── DOCKER.md     # Docker deployment guide
├── scripts/          # Build and utility scripts
│   ├── build.sh
│   └── build.js
├── src/              # Rust source code
│   ├── main.rs       # Application entry point
│   ├── shared/       # Shared state and configuration
│   │   ├── state.rs  # Thread-safe AppState
│   │   └── config.rs # Environment configuration
│   ├── server/       # MCP protocol implementation
│   │   ├── mod.rs    # MCP server setup
│   │   ├── mcp_router.rs  # Tool routing
│   │   ├── echo_test.rs   # Example echo tool
│   │   └── error.rs       # Error types
│   └── dashboard/    # Web interface
│       ├── server.rs      # Actix Web server
│       ├── handlers.rs    # REST API endpoints
│       └── websocket.rs   # Real-time WebSocket
├── static/           # Frontend assets
│   ├── css/          # Tailwind input/output
│   └── js/           # Alpine.js components
├── templates/        # Askama HTML templates
└── tests/            # Test suites
    ├── integration_tests.rs
    ├── dashboard_tests.rs
    └── components/   # JavaScript tests
```

## Currently Implemented Tools

The server currently implements an example "echo" tool for testing. To add new tools:

1. Create a tool handler in `src/server/`
2. Register it in `mcp_router.rs`
3. Add tests for the new functionality

## Architecture Highlights

### State Management
- **ArcSwap**: Lock-free reads for frequently accessed data (MCP status)
- **DashMap**: Concurrent HashMap for session management
- **RwLock**: For append-heavy collections (tool call history)
- **Broadcast Channels**: Real-time event distribution to dashboard

### Frontend Stack
- **Tailwind CSS**: Utility-first styling
- **Alpine.js**: Lightweight reactive components
- **ESBuild**: Fast JavaScript bundling
- **Vitest**: Component testing framework

## Development

### Testing

```bash
# Run all Rust tests
cargo test

# Run specific test suites
cargo test --test integration_tests
cargo test --test dashboard_tests

# Run JavaScript tests
npm test
npm run test:ui      # With UI
npm run test:coverage # With coverage

# Run tests with output
cargo test -- --nocapture
```

### Code Quality

```bash
# Format code
cargo fmt

# Run linter (strict mode)
cargo clippy -- -D warnings

# Check for vulnerabilities  
cargo audit

# Run all checks
cargo fmt && cargo clippy -- -D warnings && cargo test
```

### Development Mode

The server includes hot-reload functionality for rapid development:

```bash
# Start with hot-reload (recommended)
./scripts/dev.sh         # Dashboard only
./scripts/dev-both.sh    # MCP + Dashboard

# Or manually with --dev flag
cargo run -- --dev

# Features in dev mode:
# - Automatic browser refresh on frontend changes
# - Auto-compilation on backend changes (with cargo-watch)
# - Visual "DEV MODE" indicator in UI
# - File watching for templates, CSS, JS, and Rust code

# Traditional development commands
npm run watch-css        # Watch CSS changes

# Build JavaScript with sourcemaps
npm run build-js:dev

# Run with debug logging
RUST_LOG=debug cargo run
```

## Configuration

Key environment variables:

- `RUST_LOG`: Logging level (default: `info`)
- `DASHBOARD_HOST`: Dashboard bind address (default: `127.0.0.1`)
- `DASHBOARD_PORT`: Dashboard port (default: `8080`)
- `ENABLE_CORS`: Enable CORS for development (default: `false`)

## Claude Desktop Integration

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "rust-mcp-dashboard": {
      "command": "cargo",
      "args": ["run", "--release"],
      "cwd": "/path/to/rust-mcp-server"
    }
  }
}
```

## Security Features

- Content Security Policy headers
- Input validation on all endpoints
- Non-root Docker execution
- Structured error handling without information leakage

## Performance

The server is designed for high concurrency with:
- Lock-free data structures where possible
- Efficient state management patterns
- Automatic cleanup of old data (tool history limited to 1000 entries)
- WebSocket connection pooling

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please ensure:
- All tests pass (`cargo test`)
- Code is formatted (`cargo fmt`)
- No clippy warnings (`cargo clippy -- -D warnings`)
- New features include tests