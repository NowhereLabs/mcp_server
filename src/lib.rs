//! A high-performance Model Context Protocol (MCP) server with real-time monitoring dashboard.
//!
//! This crate implements the MCP specification for Claude Desktop integration while providing
//! a web-based dashboard for observability and debugging.
//!
//! ## Operation Modes
//!
//! The server supports three operation modes:
//! - **MCP only**: Communicates via stdin/stdout for Claude Desktop integration
//! - **Dashboard only**: Runs the web interface without MCP server
//! - **Both**: Runs MCP server and dashboard concurrently (default)
//!
//! ## State Management
//!
//! The architecture uses lock-free and concurrent data structures for high performance:
//! - [`ArcSwap`](https://docs.rs/arc-swap) for frequently-read server status
//! - [`DashMap`](https://docs.rs/dashmap) for concurrent session/metrics access
//! - [`RwLock`](tokio::sync::RwLock) for append-heavy tool call history
//! - [`broadcast`](tokio::sync::broadcast) channels for real-time events
//!
//! ## Tools
//!
//! Currently implements:
//! - `file_search`: Search for files by pattern in a directory
//!
//! New tools can be added by implementing handlers in the [`server::mcp_router`] module.
//!
//! ## Configuration
//!
//! Configuration is handled via environment variables:
//! - `RUST_LOG`: Logging level (default: `info`)
//! - `DASHBOARD_HOST`: Dashboard bind address (default: `127.0.0.1`)
//! - `DASHBOARD_PORT`: Dashboard port (default: `8080`)
//!
//! See [`shared::config::Config`] for all available options.
//!
//! ## Performance
//!
//! - Tool call history is bounded to 1000 entries to prevent memory growth
//! - Event broadcasting uses a 1000-message buffer
//! - Concurrent data structures minimize lock contention
//! - WebSocket connections are pooled for efficiency

pub mod dashboard;
pub mod server;
pub mod shared;
pub mod tools;
