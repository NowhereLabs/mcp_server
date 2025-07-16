mod dashboard;
mod server;
mod shared;

use std::sync::Arc;

use clap::{Parser, Subcommand};
use shared::{
    config::Config,
    state::{AppState, McpStatus, ServerInfo},
};

#[derive(Parser)]
#[command(name = "rust-mcp-server")]
#[command(about = "A Rust MCP server with web dashboard")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Start MCP server on stdin/stdout
    Mcp,
    /// Start web dashboard on HTTP port 8080
    Dashboard,
    /// Start both MCP server and dashboard
    Both,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment variables
    dotenvy::dotenv().ok();

    // Load and validate configuration
    let config = Config::from_env().map_err(|e| format!("Configuration error: {e}"))?;
    config
        .validate()
        .map_err(|e| format!("Configuration validation error: {e}"))?;

    // Initialize logging with configuration
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("rust_mcp_server=debug".parse()?),
        )
        .init();

    tracing::info!("Configuration loaded successfully");
    tracing::debug!("Server config: {:?}", config.server);

    let cli = Cli::parse();

    // Create shared state with configuration
    let state = AppState::new();

    // Update MCP status to show server is running
    {
        let new_status = McpStatus {
            connected: true,
            last_heartbeat: Some(chrono::Utc::now()),
            capabilities: vec![
                "tools".to_string(),
                "resources".to_string(),
                "prompts".to_string(),
            ],
            server_info: ServerInfo {
                name: "rust-mcp-dashboard".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            started_at: chrono::Utc::now(),
        };

        state.mcp_status.store(Arc::new(new_status));
    }

    // Send initial events
    let _ = state
        .event_tx
        .send(shared::state::SystemEvent::McpConnected);

    match cli.command {
        Commands::Mcp => {
            println!("Starting MCP server on stdin/stdout");

            // Create and run official MCP server
            let mcp_server = server::create_mcp_server(state.clone()).await?;
            let transport = server::create_stdio_transport();

            if let Err(e) = mcp_server.run(transport).await {
                tracing::error!("MCP server error: {}", e);
            }
        }
        Commands::Dashboard => {
            println!(
                "✅ Dashboard server starting at http://{}:{}",
                config.server.dashboard_host, config.server.dashboard_port
            );
            println!("✅ MCP server tools and resources available");
            println!("✅ Real-time monitoring active");

            if let Err(e) = dashboard::server::run_dashboard_with_config(state, config).await {
                tracing::error!("Dashboard server error: {}", e);
            }
        }
        Commands::Both => {
            println!("Starting both MCP server and dashboard");
            println!("✅ MCP server on stdin/stdout");
            println!(
                "✅ Dashboard server at http://{}:{}",
                config.server.dashboard_host, config.server.dashboard_port
            );

            // Create and run official MCP server
            let mcp_server = server::create_mcp_server(state.clone()).await?;
            let transport = server::create_stdio_transport();

            // Run both servers concurrently
            tokio::select! {
                _ = mcp_server.run(transport) => {},
                _ = dashboard::server::run_dashboard_with_config(state, config) => {},
                _ = tokio::signal::ctrl_c() => {
                    tracing::info!("Received shutdown signal");
                }
            }
        }
    }

    Ok(())
}
