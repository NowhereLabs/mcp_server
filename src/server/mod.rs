use crate::shared::state::AppState;
use mcp_server::{router::RouterService, ByteTransport, Server};

pub mod error;
pub mod mcp_router;
pub mod prompts;
pub mod resources;
pub mod tools;

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
