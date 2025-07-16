# Rust MCP Server with Web Dashboard

A high-performance Model Context Protocol (MCP) server implementation in Rust with a real-time web dashboard for monitoring and control.

## Features

- **MCP Protocol Support**: Full implementation of the Model Context Protocol for AI assistant integration
- **Real-time Web Dashboard**: Monitor server status, tool executions, and metrics
- **Tool Suite**: File system operations, HTTP requests, and system information tools
- **WebSocket & SSE Support**: Real-time updates to connected dashboard clients
- **Thread-safe State Management**: Efficient concurrent access using Arc, RwLock, and DashMap
- **Docker Support**: Easy deployment with Docker and docker-compose

## Quick Start

### Prerequisites

- Rust 1.82+ (for development)
- Docker & Docker Compose (for containerized deployment)

### Running with Docker (Recommended)

```bash
# Build and run with docker-compose
docker-compose up --build

# Access the dashboard at http://localhost:8080
```

### Running Locally

```bash
# Build the project
cargo build --release

# Run tests
cargo test

# Start the server
cargo run --release

# Access the dashboard at http://localhost:8080
```

## Available Tools

The MCP server provides the following tools:

1. **read_file**: Read contents of a file
2. **write_file**: Write content to a file
3. **list_directory**: List directory contents
4. **http_get**: Make HTTP GET requests
5. **http_post**: Make HTTP POST requests
6. **system_info**: Get system information

## Dashboard Features

- **Live Server Status**: Real-time connection and health monitoring
- **Performance Metrics**: Tool execution statistics and response times
- **Tool Execution**: Interactive buttons to test each tool
- **Event History**: Live feed of server events and tool executions
- **Session Tracking**: Monitor active client sessions

## Architecture

```
src/
├── main.rs              # Application entry point
├── shared/              # Shared state management
│   ├── state.rs         # Core AppState implementation
│   └── mod.rs
├── server/              # MCP server implementation
│   ├── handler.rs       # Request handling
│   ├── tools/           # Tool implementations
│   ├── resources/       # Resource management
│   └── prompts/         # Prompt handling
└── dashboard/           # Web dashboard
    ├── server.rs        # HTTP server
    ├── handlers.rs      # Request handlers
    └── websocket.rs     # WebSocket support
```

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
cargo test

# Run specific test suites
cargo test --test basic_integration
cargo test --test dashboard_tests

# Test MCP protocol compliance
./test_mcp_server.sh
```

## Configuration

### Environment Variables

- `RUST_LOG`: Set logging level (default: `info`)
- `RUST_BACKTRACE`: Enable backtrace on panic (default: `1`)

### Claude Desktop Integration

To use with Claude Desktop, copy the provided configuration:

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

## Development

### Adding New Tools

1. Implement the tool in `src/server/tools/`
2. Register it in the tool handler
3. Add tests for the new functionality
4. Update the dashboard UI if needed

### Code Quality

```bash
# Format code
cargo fmt

# Run linter
cargo clippy -- -D warnings

# Check for security issues
cargo audit
```

## Security Considerations

- File operations are sandboxed to prevent directory traversal
- Input validation on all tool parameters
- Rate limiting framework in place
- Runs as non-root user in Docker

## License

[Your License Here]

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Acknowledgments

Built with:
- [Actix Web](https://actix.rs/) - High-performance web framework
- [Tokio](https://tokio.rs/) - Asynchronous runtime
- [DashMap](https://github.com/xacrimon/dashmap) - Concurrent HashMap
- [Askama](https://github.com/djc/askama) - Type-safe templates