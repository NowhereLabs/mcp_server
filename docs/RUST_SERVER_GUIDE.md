# Rust MCP Server Development Guide

This guide provides comprehensive documentation for developing, testing, and maintaining the Rust MCP server implementation. It covers the specific architecture, patterns, and best practices used in this project.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [State Management](#state-management)
4. [MCP Protocol Implementation](#mcp-protocol-implementation)
5. [Dashboard Integration](#dashboard-integration)
6. [Tool Development](#tool-development)
7. [Testing Strategies](#testing-strategies)
8. [Performance Optimization](#performance-optimization)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)

## Architecture Overview

The Rust MCP server follows a modular architecture designed for high performance and maintainability:

```
src/
├── main.rs              # Application entry point with CLI handling
├── server/              # MCP protocol implementation
│   ├── mod.rs          # Server creation and transport setup
│   ├── mcp_router.rs   # Router implementing MCP capabilities
│   └── error.rs        # Custom error types
├── dashboard/           # Web interface
│   ├── server.rs       # Actix Web server setup
│   ├── handlers.rs     # REST API endpoints
│   ├── websocket.rs    # WebSocket actor for real-time updates
│   └── types.rs        # Dashboard-specific types
├── shared/              # Shared components
│   ├── state.rs        # Application state with concurrent structures
│   ├── config.rs       # Environment-based configuration
│   └── types.rs        # Shared type definitions
└── tools/              # MCP tool implementations
    ├── mod.rs          # Tool registry and trait definitions
    └── file_search.rs  # Example tool implementation
```

### Key Design Principles

1. **Concurrency-First**: Uses lock-free data structures where possible
2. **Type Safety**: Leverages Rust's type system for compile-time guarantees
3. **Real-time Updates**: Event-driven architecture with broadcast channels
4. **Modular Tools**: Plugin-like tool system for easy extension

## Core Components

### Application Entry Point (`main.rs`)

The main function orchestrates the entire application lifecycle:

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenvy::dotenv().ok();
    
    // Parse CLI arguments
    let cli = Cli::parse();
    
    // Initialize shared state
    let state = AppState::new();
    
    // Start appropriate servers based on mode
    match cli.mode {
        Mode::MpcOnly => start_mcp_server(state).await,
        Mode::Dashboard => start_dashboard(state, cli.dev).await,
        Mode::Both => start_both(state, cli.dev).await,
    }
}
```

**Claude Code Command:** `/dev-server` starts the server in development mode

### CLI Configuration

The server uses `clap` for command-line argument parsing:

```rust
#[derive(Parser)]
#[command(name = "rust-mcp-server")]
struct Cli {
    /// Run in development mode with hot-reload
    #[arg(long, global = true)]
    dev: bool,
    
    /// Operation mode: mcp-only, dashboard, or both
    #[arg(long, value_enum, default_value = "both")]
    mode: Mode,
}
```

## State Management

### AppState Architecture (`shared/state.rs`)

The `AppState` struct is the central hub for all shared application data, using different concurrent structures optimized for specific access patterns:

```rust
#[derive(Clone)]
pub struct AppState {
    /// Lock-free reads for frequently accessed status
    pub mcp_status: Arc<ArcSwap<McpStatus>>,
    
    /// Concurrent hashmap for session management
    pub active_sessions: Arc<DashMap<Uuid, SessionInfo>>,
    
    /// Broadcast channel for real-time events
    pub event_tx: broadcast::Sender<SystemEvent>,
    
    /// Metrics collection with atomic updates
    pub metrics: Arc<DashMap<String, MetricValue>>,
    
    /// Tool call history with bounded size
    pub tool_calls: Arc<RwLock<Vec<ToolCall>>>,
}
```

### Concurrent Data Structure Choices

1. **ArcSwap for MCP Status**
   - Used for data that's read frequently but updated rarely
   - Provides lock-free reads with atomic pointer swaps
   ```rust
   // Reading (no locks!)
   let status = state.mcp_status.load();
   
   // Updating
   state.mcp_status.store(Arc::new(new_status));
   ```

2. **DashMap for Sessions and Metrics**
   - Thread-safe hashmap with fine-grained locking
   - Perfect for concurrent access to independent entries
   ```rust
   // Add session
   state.active_sessions.insert(session_id, session_info);
   
   // Update metric
   state.metrics.alter(&metric_name, |_, v| v + 1);
   ```

3. **RwLock for Tool Calls**
   - Allows multiple concurrent readers
   - Single writer for appending new calls
   ```rust
   // Read tool calls
   let calls = state.tool_calls.read().await;
   
   // Add new call (with automatic history limit)
   state.add_tool_call(tool_call).await;
   ```

### Event Broadcasting

The event system enables real-time updates across components:

```rust
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum SystemEvent {
    McpConnected,
    McpDisconnected,
    ToolExecuted { name: String, duration_ms: u64 },
    SessionCreated { id: Uuid },
    SessionClosed { id: Uuid },
    MetricUpdated { name: String, value: f64 },
}

// Broadcasting an event
state.send_event(SystemEvent::ToolExecuted {
    name: "file_search".to_string(),
    duration_ms: 45,
})?;

// Subscribing to events
let mut rx = state.subscribe_to_events();
while let Ok(event) = rx.recv().await {
    // Handle event
}
```

## MCP Protocol Implementation

### Router Implementation (`server/mcp_router.rs`)

The `McpRouter` implements the MCP protocol's `Router` trait:

```rust
impl Router for McpRouter {
    fn name(&self) -> String {
        "rust-mcp-dashboard".to_string()
    }
    
    fn capabilities(&self) -> ServerCapabilities {
        CapabilitiesBuilder::new()
            .with_tools(true)
            .with_resources(true)
            .with_prompts(true)
            .build()
    }
    
    fn list_tools(&self) -> Pin<Box<dyn Future<Output = Vec<Tool>> + Send + '_>> {
        Box::pin(async move {
            self.tool_registry.list_tools()
        })
    }
    
    fn call_tool(&self, name: &str, args: Value) -> Pin<Box<dyn Future<Output = Result<Vec<Content>, ToolError>> + Send + '_>> {
        let state = self.state.clone();
        let registry = self.tool_registry.clone();
        let name = name.to_string();
        
        Box::pin(async move {
            // Record tool call
            let tool_call = ToolCall::new(name.clone(), args.clone());
            state.add_tool_call(tool_call).await;
            
            // Execute tool
            match registry.execute(&name, args).await {
                Ok(result) => Ok(vec![Content::Text(TextContent { text: result })]),
                Err(e) => Err(ToolError::ExecutionError(e.to_string())),
            }
        })
    }
}
```

### Server Creation (`server/mod.rs`)

The server module provides factory functions for creating MCP servers:

```rust
pub async fn create_mcp_server(
    state: AppState,
) -> anyhow::Result<Server<RouterService<McpRouter>>> {
    let router = McpRouter::new(state);
    let router_service = RouterService(router);
    let server = Server::new(router_service);
    Ok(server)
}

pub fn create_stdio_transport() -> ByteTransport<tokio::io::Stdin, tokio::io::Stdout> {
    ByteTransport::new(tokio::io::stdin(), tokio::io::stdout())
}
```

## Dashboard Integration

### Actix Web Server (`dashboard/server.rs`)

The dashboard uses Actix Web for high-performance HTTP handling:

```rust
pub async fn create_dashboard_server(
    state: AppState,
    dev_mode: bool,
) -> std::io::Result<Server> {
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .wrap(middleware::Logger::default())
            .wrap(create_cors(dev_mode))
            .service(web::scope("/api")
                .route("/status", web::get().to(handlers::get_status))
                .route("/metrics", web::get().to(handlers::get_metrics))
                .route("/sessions", web::get().to(handlers::get_sessions))
                .route("/tools", web::get().to(handlers::get_tools))
                .route("/tool-calls", web::get().to(handlers::get_tool_calls))
            )
            .route("/ws", web::get().to(websocket::websocket_handler))
            .service(Files::new("/static", "./static"))
            .route("/", web::get().to(handlers::index))
    })
    .bind((config.dashboard_host.as_str(), config.dashboard_port))?
    .run()
}
```

### WebSocket Actor (`dashboard/websocket.rs`)

Real-time updates are handled through WebSocket connections:

```rust
pub struct WsSession {
    id: Uuid,
    state: AppState,
    event_rx: Option<broadcast::Receiver<SystemEvent>>,
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;
    
    fn started(&mut self, ctx: &mut Self::Context) {
        // Subscribe to events
        self.event_rx = Some(self.state.subscribe_to_events());
        
        // Start event forwarding
        self.forward_events(ctx);
        
        // Register session
        self.state.active_sessions.insert(
            self.id,
            SessionInfo::new("websocket"),
        );
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => ctx.pong(&msg),
            Ok(ws::Message::Text(text)) => {
                // Handle incoming messages
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    self.handle_client_message(client_msg, ctx);
                }
            }
            _ => (),
        }
    }
}
```

## Tool Development

### Tool Registry Pattern (`tools/mod.rs`)

Tools follow a trait-based plugin architecture:

```rust
#[async_trait]
pub trait McpTool: Send + Sync {
    /// Unique identifier for the tool
    fn name(&self) -> &'static str;
    
    /// Human-readable description
    fn description(&self) -> &'static str;
    
    /// JSON Schema for input parameters
    fn input_schema(&self) -> Value;
    
    /// Execute the tool with given parameters
    async fn execute(&self, params: Value) -> Result<String>;
}

pub struct ToolRegistry {
    tools: HashMap<String, Box<dyn McpTool>>,
}

impl ToolRegistry {
    pub fn register<T: McpTool + 'static>(&mut self, tool: T) {
        self.tools.insert(tool.name().to_string(), Box::new(tool));
    }
    
    pub async fn execute(&self, name: &str, params: Value) -> Result<String> {
        self.tools
            .get(name)
            .ok_or_else(|| anyhow!("Tool not found: {}", name))?
            .execute(params)
            .await
    }
}
```

### Example Tool Implementation (`tools/file_search.rs`)

**Claude Code Command:** `/add-mcp-tool` generates this structure

```rust
pub struct FileSearchTool;

#[async_trait]
impl McpTool for FileSearchTool {
    fn name(&self) -> &'static str {
        "file_search"
    }
    
    fn description(&self) -> &'static str {
        "Search for files by pattern in a directory"
    }
    
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Directory to search in"
                },
                "pattern": {
                    "type": "string",
                    "description": "File pattern to match"
                }
            },
            "required": ["pattern"]
        })
    }
    
    async fn execute(&self, params: Value) -> Result<String> {
        let path = params["path"].as_str().unwrap_or(".");
        let pattern = params["pattern"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing pattern parameter"))?;
        
        // Implementation using tokio::fs
        let entries = find_files(path, pattern).await?;
        Ok(serde_json::to_string_pretty(&entries)?)
    }
}
```

## Testing Strategies

### Unit Testing Pattern

Each module includes unit tests alongside the implementation:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_app_state_creation() {
        let state = AppState::new();
        
        // Verify initial state
        assert!(state.mcp_status.load().connected);
        assert_eq!(state.active_sessions.len(), 0);
    }
    
    #[tokio::test]
    async fn test_concurrent_metrics() {
        let state = AppState::new();
        let handles: Vec<_> = (0..10)
            .map(|i| {
                let state = state.clone();
                tokio::spawn(async move {
                    state.update_metric(
                        format!("test_metric_{}", i % 3),
                        MetricValue::Counter(1),
                    );
                })
            })
            .collect();
        
        for handle in handles {
            handle.await.unwrap();
        }
        
        // Verify all metrics were recorded
        assert!(state.metrics.len() <= 3);
    }
}
```

### Integration Testing (`tests/integration_tests.rs`)

**Claude Code Command:** `/run-tests` executes all tests

```rust
#[tokio::test]
async fn test_mcp_server_lifecycle() {
    let state = AppState::new();
    
    // Create server
    let server = create_mcp_server(state.clone()).await.unwrap();
    
    // Verify capabilities
    let router = McpRouter::new(state);
    let capabilities = router.capabilities();
    assert!(capabilities.tools.is_some());
    assert!(capabilities.resources.is_some());
}

#[tokio::test]
async fn test_tool_execution_flow() {
    let state = AppState::new();
    let mut registry = ToolRegistry::new();
    registry.register(FileSearchTool);
    
    // Execute tool
    let params = json!({
        "pattern": "*.rs"
    });
    
    let result = registry.execute("file_search", params).await;
    assert!(result.is_ok());
    
    // Verify tool call was recorded
    let calls = state.get_tool_calls(10).await;
    assert!(!calls.is_empty());
}
```

### WebSocket Testing (`tests/websocket_tests.rs`)

```rust
#[tokio::test]
async fn test_websocket_connection() {
    let state = AppState::new();
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/ws", web::get().to(websocket_handler))
    ).await;
    
    // Connect to WebSocket
    let req = test::TestRequest::get()
        .uri("/ws")
        .header("Upgrade", "websocket")
        .to_request();
    
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::SWITCHING_PROTOCOLS);
}
```

## Performance Optimization

### Lock-Free Patterns

1. **Status Updates with ArcSwap**
   ```rust
   // Instead of RwLock<McpStatus>
   pub fn update_status(&self, new_status: McpStatus) {
       self.mcp_status.store(Arc::new(new_status));
   }
   ```

2. **Metrics with Atomic Operations**
   ```rust
   pub fn increment_counter(&self, name: &str) {
       self.metrics.alter(name, |_, v| match v {
           MetricValue::Counter(n) => MetricValue::Counter(n + 1),
           _ => v,
       });
   }
   ```

### Bounded Collections

Prevent memory growth with automatic cleanup:

```rust
pub async fn add_tool_call(&self, tool_call: ToolCall) {
    let mut calls = self.tool_calls.write().await;
    calls.push(tool_call);
    
    // Keep only last 1000 calls
    if calls.len() > 1000 {
        calls.drain(0..calls.len() - 1000);
    }
}
```

### Efficient Serialization

Use `serde` with optimized formats:

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WebSocketMessage {
    Status(McpStatus),
    Metrics(HashMap<String, MetricValue>),
    Event(SystemEvent),
}
```

## Error Handling

### Custom Error Types (`server/error.rs`)

```rust
#[derive(Debug, thiserror::Error)]
pub enum McpError {
    #[error("Tool not found: {0}")]
    ToolNotFound(String),
    
    #[error("Invalid parameters: {0}")]
    InvalidParams(String),
    
    #[error("Execution failed: {0}")]
    ExecutionError(#[from] anyhow::Error),
}

pub type Result<T> = std::result::Result<T, McpError>;
```

### Error Propagation Pattern

```rust
async fn execute_tool(&self, name: &str, params: Value) -> Result<String> {
    // Validate tool exists
    let tool = self.tools
        .get(name)
        .ok_or_else(|| McpError::ToolNotFound(name.to_string()))?;
    
    // Validate parameters
    validate_params(&params, tool.input_schema())
        .map_err(|e| McpError::InvalidParams(e.to_string()))?;
    
    // Execute with error propagation
    tool.execute(params)
        .await
        .map_err(McpError::ExecutionError)
}
```

## Best Practices

### 1. State Management

**DO:**
- Use appropriate concurrent structures for access patterns
- Clone `Arc`s, not the inner data
- Keep critical sections small

**DON'T:**
- Hold locks across await points
- Use blocking operations in async contexts
- Share mutable state without synchronization

### 2. Tool Development

**DO:**
- Validate inputs against schema
- Return structured errors
- Keep tools focused on single responsibilities
- Write comprehensive tests

**DON'T:**
- Perform blocking I/O without `tokio::task::spawn_blocking`
- Ignore parameter validation
- Mix business logic with protocol handling

### 3. Testing

**Claude Code Commands:**
- `/run-tests` - Run complete test suite
- `/pr-ready` - Validate before committing

**DO:**
- Test concurrent access patterns
- Use `tokio::test` for async tests
- Mock external dependencies
- Test error conditions

**DON'T:**
- Use `std::thread::sleep` in async tests
- Ignore flaky tests
- Test implementation details

### 4. Performance

**DO:**
- Profile before optimizing
- Use appropriate data structures
- Batch operations when possible
- Monitor metrics in production

**DON'T:**
- Premature optimization
- Ignore memory growth
- Block the tokio runtime

### 5. Code Organization

**DO:**
- Keep modules focused
- Use clear naming conventions
- Document public APIs
- Follow Rust idioms

**DON'T:**
- Create deep module hierarchies
- Mix concerns in single modules
- Skip documentation

## Development Workflow Integration

### Adding New Features

1. **Start Development**
   ```bash
   /dev-server  # Claude Code command
   ```

2. **Create New Tool**
   ```bash
   /add-mcp-tool my_tool  # Claude Code command
   ```

3. **Test Implementation**
   ```bash
   /run-tests  # Claude Code command
   ```

4. **Prepare for PR**
   ```bash
   /pr-ready  # Claude Code command
   ```

### Debugging Issues

1. **Type Issues**
   ```bash
   /sync-types  # Claude Code command
   ```

2. **WebSocket Problems**
   ```bash
   /debug-ws  # Claude Code command
   ```

3. **Performance Analysis**
   ```bash
   cargo flamegraph
   cargo bench
   ```

## Conclusion

This Rust MCP server implementation demonstrates modern Rust patterns for building high-performance, concurrent systems. By following these guidelines and leveraging the provided tooling, you can effectively develop, test, and maintain the server while ensuring reliability and performance.