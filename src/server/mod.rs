//! MCP protocol server implementation.
//!
//! Provides the Model Context Protocol server using the official MCP SDK,
//! with support for tools, resources, and prompts.

use mcp_server::{router::RouterService, ByteTransport, Server};

use crate::shared::state::AppState;

pub mod error;
pub mod mcp_router;

pub use mcp_router::McpRouter;

/// Creates a new MCP server instance with the given application state.
pub async fn create_mcp_server(
    state: AppState,
) -> anyhow::Result<Server<RouterService<McpRouter>>> {
    let router = McpRouter::new(state);
    let router_service = RouterService(router);
    let server = Server::new(router_service);
    Ok(server)
}

/// Creates a stdio transport for MCP communication.
pub fn create_stdio_transport() -> ByteTransport<tokio::io::Stdin, tokio::io::Stdout> {
    ByteTransport::new(tokio::io::stdin(), tokio::io::stdout())
}
