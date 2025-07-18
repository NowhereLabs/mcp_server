# Rust MCP Server with Real-time Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-blue)](https://github.com/NowhereLabs/mcp_server/pkgs/container/rust-mcp-server)

A high-performance Model Context Protocol (MCP) server implementation in Rust with an integrated real-time web dashboard for monitoring and debugging.

## Features

- **MCP Protocol Implementation**: Built with the official MCP SDK for Claude Desktop integration
- **Real-time Web Dashboard**: Monitor server status, tool executions, and metrics via WebSocket
- **Flexible Operation Modes**: Run MCP server only, dashboard only, or both together
- **High-Performance Architecture**: Lock-free concurrent data structures for optimal throughput
- **TypeScript Frontend**: Fully type-safe Alpine.js reactive UI components with comprehensive testing
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
docker pull ghcr.io/nowherelabs/rust-mcp-server:v0.1.3
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
├── config/           # Configuration files (TypeScript)
│   ├── tailwind.config.ts
│   ├── postcss.config.ts
│   ├── vitest.config.ts
│   ├── esbuild.config.ts
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
│   └── js/           # TypeScript Alpine.js components
├── templates/        # Askama HTML templates
├── tests/            # Comprehensive test suites
│   ├── integration_tests.rs
│   ├── dashboard_tests.rs
│   ├── websocket_origin_tests.rs
│   ├── hot_reload_tests.rs
│   ├── docker_integration_tests_optimized.rs
│   ├── components/   # TypeScript component tests
│   ├── integration/  # End-to-end integration tests
│   └── utils/        # Utility function tests
└── tsconfig.json     # TypeScript configuration
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
- **TypeScript**: Full type safety with strict mode enabled
- **Tailwind CSS**: Utility-first styling with TypeScript configuration
- **Alpine.js**: Lightweight reactive components with type definitions
- **ESBuild**: Fast TypeScript bundling and compilation
- **Vitest**: Modern testing framework with TypeScript support

## Development

### Testing

Our comprehensive test suite includes 174 tests across all components:

```bash
# Run complete test suite (recommended)
cargo test && npm test

# Rust tests (46 total)
cargo test                                    # All Rust tests
cargo test --lib --bins                      # Unit tests (10)
cargo test --test integration_tests          # Integration tests (5)
cargo test --test dashboard_tests            # Dashboard tests (7)
cargo test --test websocket_origin_tests     # WebSocket tests (6)
cargo test --test hot_reload_tests           # Hot-reload tests (8)
cargo test --test basic_integration          # Basic integration (9)
cargo test --test docker_integration_tests_optimized  # Docker tests (5)

# TypeScript tests (123 total)
npm test                     # All TypeScript tests
npm run test:ui             # With interactive UI
npm run test:coverage       # With coverage report
npm run type-check          # TypeScript compilation check

# Test categories:
# - Component tests (58): All Alpine.js components
# - Integration tests (33): End-to-end functionality
# - Utility tests (32): Error handling and helpers

# Development testing
cargo test -- --nocapture   # Rust tests with output
npm test -- --reporter=verbose  # Detailed test output
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

# Build TypeScript with sourcemaps
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
- All tests pass (`cargo test && npm test` - 174 total tests)
- Code is formatted (`cargo fmt`)
- No clippy warnings (`cargo clippy -- -D warnings`)
- TypeScript compiles without errors (`npm run type-check`)
- New features include comprehensive tests (both Rust and TypeScript)