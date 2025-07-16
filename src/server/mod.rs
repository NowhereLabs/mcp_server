use mcp_server::{router::RouterService, ByteTransport, Server};

use crate::shared::state::AppState;

pub mod error;
pub mod mcp_router;

#[cfg(test)]
mod echo_test;

pub use mcp_router::McpRouter;

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
