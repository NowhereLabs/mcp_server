# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Running
```bash
# Full build with all assets (recommended)
./scripts/build.sh

# Build Rust only
cargo build --release

# Run the server
cargo run --release

# Run with specific mode
cargo run --release -- --mode=mcp-only    # MCP server only
cargo run --release -- --mode=dashboard   # Dashboard only
cargo run --release -- --mode=both        # Both (default)

# Watch CSS changes during development
npm run watch-css

# Build JavaScript components
npm run build-js:dev   # Development build with sourcemaps
npm run build-js:prod  # Production build, minified

# Docker deployment
docker-compose -f docker/docker-compose.yml up --build
```

### Testing
```bash
# Run all Rust tests
cargo test

# Run specific test file
cargo test --test integration_tests
cargo test --test dashboard_tests

# Run tests for specific module
cargo test shared::state::tests::

# Run JavaScript tests
npm test                    # Run all Vitest tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Generate coverage report

# Run tests with output
cargo test -- --nocapture
```

### Code Quality
```bash
# Format code
cargo fmt

# Run linter (strict mode)
cargo clippy -- -D warnings

# Check for security vulnerabilities
cargo audit

# Check dependencies are up to date
cargo outdated
```

## Architecture Overview

This is a high-performance Rust MCP server with real-time web dashboard. The codebase follows a modular architecture with clear separation of concerns.

### Core Architecture

1. **`src/shared/`** - Shared state and configuration
   - `state.rs`: Thread-safe `AppState` using performance-optimized concurrent structures:
     - `ArcSwap<McpStatus>` for lock-free reads of server status
     - `DashMap<Uuid, Session>` for concurrent session management
     - `RwLock<Vec<ToolCall>>` for tool call history (auto-limited to 1000 entries)
     - `broadcast::Sender<Event>` for real-time event distribution
   - `config.rs`: Environment-based configuration with defaults

2. **`src/server/`** - MCP protocol implementation
   - `mod.rs`: MCP server setup using official SDK
   - `mcp_router.rs`: Router implementation with tool registry
   - `echo_test.rs`: Example echo tool implementation
   - `error.rs`: Custom error types for MCP operations

3. **`src/dashboard/`** - Web interface
   - `server.rs`: Actix Web server with security headers
   - `handlers.rs`: REST API endpoints (GET /api/status, /api/metrics, etc.)
   - `websocket.rs`: WebSocket actor for real-time updates
   - Templates in `templates/` using Askama for type-safe rendering

4. **`src/main.rs`** - Application entry point
   - Command-line argument parsing (mode selection)
   - Concurrent server spawning
   - Graceful shutdown handling

### State Management Patterns

The `AppState` is designed for high-concurrency scenarios:
- Read-heavy data uses lock-free structures (ArcSwap)
- Write-heavy data uses appropriate locking (RwLock, DashMap)
- Events are broadcast to all connected clients
- Automatic cleanup prevents unbounded growth

### Adding New MCP Tools

Currently, the server implements an "echo" tool. To add new tools:

1. Create a new file in `src/server/` (e.g., `my_tool.rs`)
2. Implement the tool handler function with signature:
   ```rust
   pub async fn handle_my_tool(params: Value) -> Result<ToolResult>
   ```
3. Register in `mcp_router.rs`:
   - Add to the `list_tools()` method
   - Add case in `call_tool()` method
4. Add tests in the same file or create a test module

### Frontend Development

The dashboard uses:
- **Tailwind CSS**: Utility-first styling (config in `config/tailwind.config.js`)
- **Alpine.js**: Reactive components (source in `static/js/`)
- **Askama**: Type-safe templates (in `templates/`)

JavaScript components are bundled with ESBuild and tested with Vitest.

### Configuration

Key environment variables:
- `RUST_LOG`: Logging level (e.g., `rust-mcp-server=debug`)
- `DASHBOARD_HOST`: Dashboard bind address (default: `127.0.0.1`)
- `DASHBOARD_PORT`: Dashboard port (default: `8080`)
- `ENABLE_CORS`: Enable CORS for development (default: `false`)

### Docker Deployment

Multi-stage build process:
1. Node.js stage: Builds CSS and JavaScript assets
2. Rust stage: Compiles the binary
3. Runtime stage: Minimal image with just the binary and assets

The `docker/` directory contains all Docker-related files including nginx configuration for reverse proxy setup.

## Project Structure

```
.
├── config/           # All configuration files
├── docker/          # Docker and deployment files  
├── scripts/         # Build and utility scripts
├── src/            
│   ├── dashboard/   # Web interface implementation
│   ├── server/      # MCP protocol implementation
│   └── shared/      # Shared state and types
├── static/          # Frontend assets (CSS, JS)
├── templates/       # Askama HTML templates
└── tests/           # Integration and UI tests
```

## Integration with Claude Desktop

Configure in Claude Desktop settings:
```json
{
  "mcpServers": {
    "rust-mcp-dashboard": {
      "command": "cargo",
      "args": ["run", "--release"],
      "cwd": "/path/to/mcp_server"
    }
  }
}
```