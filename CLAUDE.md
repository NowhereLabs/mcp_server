# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Running
```bash
# Install dependencies and build everything (including Tailwind CSS)
./build.sh

# Or build manually:
# 1. Build Tailwind CSS
npm install
npm run build-css

# 2. Build the Rust project
cargo build --release

# Run the server locally
cargo run --release

# Watch for CSS changes during development
npm run watch-css

# Build and run with Docker (recommended deployment)
docker-compose up --build
```

### Testing
```bash
# Run all tests
cargo test

# Run specific test suites
cargo test --test basic_integration
cargo test --test dashboard_tests
cargo test --test integration_tests

# Test individual modules
cargo test filesystem_tests
cargo test http_tests
cargo test system_tests
```

### Code Quality
```bash
# Format code (uses rustfmt.toml config)
cargo fmt

# Run linter with strict warnings (uses clippy.toml config)
cargo clippy -- -D warnings

# Security audit
cargo audit
```

## Architecture Overview

This is a high-performance Rust MCP (Model Context Protocol) server with a real-time web dashboard. The architecture consists of three main modules:

### Core Components

1. **`src/shared/`** - Shared state management using concurrent data structures
   - `AppState`: Thread-safe state using ArcSwap, DashMap, and RwLock
   - Optimized for different access patterns (read-heavy vs write-heavy)
   - Real-time event broadcasting via tokio broadcast channels

2. **`src/server/`** - MCP protocol implementation
   - `tools/`: Tool implementations (filesystem, http, system)
   - `resources/`: Configuration and log management
   - `prompts/`: Prompt handling and debugging
   - Uses official MCP SDK (`mcp-server`, `mcp-spec`)

3. **`src/dashboard/`** - Real-time web interface
   - Actix Web framework with WebSocket and SSE support
   - Askama templates for type-safe HTML rendering
   - Live monitoring of tool executions and metrics

### State Management Strategy
- **ArcSwap**: For frequently-read, rarely-updated data (MCP status)
- **DashMap**: For concurrent access to sessions and metrics
- **RwLock**: For append-heavy collections (tool call history)
- **Broadcast channels**: For real-time event distribution

## Tool Development

### Adding New Tools
1. Create new module in `src/server/tools/`
2. Implement tool trait with async methods
3. Register in tool handler (`src/server/mod.rs`)
4. Add corresponding test module (`*_tests.rs`)
5. Update dashboard UI if interactive features needed

### Tool Categories
- **Filesystem**: `read_file`, `write_file`, `list_directory`
- **HTTP**: `http_get`, `http_post` with full request/response handling
- **System**: `system_info` for performance monitoring

## Configuration

### Environment Variables
- `RUST_LOG`: Logging level (default: `info`)
- `RUST_BACKTRACE`: Enable panic backtraces (default: `1`)

### Rust Toolchain
- **MSRV**: 1.82+ (specified in Cargo.toml and clippy.toml)
- **Edition**: 2021
- **Formatting**: Custom rustfmt.toml with 100-char line width
- **Linting**: Strict clippy rules with cognitive complexity limits

### Docker Deployment
- Uses multi-stage build with nginx reverse proxy
- Non-root user execution for security
- Exposed on port 8080 with dashboard access

## Key Dependencies

### Core Runtime
- **Tokio**: Full async runtime with all features
- **Arc-swap**: Lock-free atomic reference counting for hot paths
- **DashMap**: Concurrent HashMap for shared state

### MCP Protocol
- **mcp-server**: Official MCP SDK for protocol implementation
- **mcp-spec**: MCP specification types and validation

### Web Framework
- **Actix Web**: High-performance HTTP server
- **Actix WebSocket**: Real-time bidirectional communication
- **Askama**: Compile-time template engine for type safety

## Integration with Claude Desktop

Add to Claude Desktop configuration:
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

- Sandboxed file operations with path traversal protection
- Input validation on all tool parameters
- Rate limiting framework architecture
- Docker security with non-root execution
- Structured error handling with `thiserror` and `anyhow`