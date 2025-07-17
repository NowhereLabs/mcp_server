use actix_files::Files;
use actix_web::{middleware, web, App, HttpServer};

use crate::dashboard::handlers;
use crate::dashboard::hot_reload::{HotReloadWatcher, ReloadEvent};
use crate::dashboard::websocket;
use crate::shared::{config::Config, state::AppState};

// Security middleware for CSP headers
fn add_security_headers() -> middleware::DefaultHeaders {
    middleware::DefaultHeaders::new()
        .add((
            "Content-Security-Policy",
            "default-src 'self'; \
             script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; \
             style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; \
             font-src 'self' https://fonts.gstatic.com; \
             img-src 'self' data:; \
             connect-src 'self' ws: wss:; \
             frame-ancestors 'none'; \
             base-uri 'self'; \
             form-action 'self';",
        ))
        .add(("X-Content-Type-Options", "nosniff"))
        .add(("X-Frame-Options", "DENY"))
        .add(("X-XSS-Protection", "1; mode=block"))
        .add(("Referrer-Policy", "strict-origin-when-cross-origin"))
}

// Allow dead_code: Public API convenience function for external consumers
// Provides simplified interface using default configuration
#[allow(dead_code)]
pub async fn run_dashboard(state: AppState) -> std::io::Result<()> {
    run_dashboard_with_config(state, Config::default(), false).await
}

pub async fn run_dashboard_with_config(
    state: AppState,
    config: Config,
    dev_mode: bool,
) -> std::io::Result<()> {
    let bind_address = format!(
        "{}:{}",
        config.server.dashboard_host, config.server.dashboard_port
    );
    tracing::info!("Starting dashboard server on http://{}", bind_address);
    if dev_mode {
        tracing::info!("🔥 Hot-reload enabled - file changes will trigger automatic refresh");

        // Create shutdown channel for hot reload watcher
        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();

        // Start hot reload watcher
        let (watcher, mut reload_rx) = HotReloadWatcher::new(state.clone(), config.clone());
        let watcher_handle = tokio::spawn(async move {
            if let Err(e) = watcher.start(shutdown_rx).await {
                tracing::error!("Failed to start hot reload watcher: {}", e);
            }
        });

        // Spawn task to handle reload events
        let state_clone = state.clone();
        tokio::spawn(async move {
            while let Ok(event) = reload_rx.recv().await {
                match event {
                    ReloadEvent::FrontendChanged => {
                        // Broadcast reload message to all connected WebSocket clients
                        let reload_msg =
                            crate::dashboard::hot_reload::BrowserReloadMessage::reload();
                        let _ =
                            state_clone
                                .event_tx
                                .send(crate::shared::state::SystemEvent::Custom(
                                    serde_json::to_string(&reload_msg).unwrap_or_default(),
                                ));
                    }
                    ReloadEvent::BackendChanged => {
                        tracing::info!("⚠️  Backend files changed - manual restart required (run with cargo-watch for auto-restart)");
                    }
                }
            }
        });

        // Handle graceful shutdown of watcher on app termination
        tokio::spawn(async move {
            tokio::signal::ctrl_c()
                .await
                .expect("Failed to listen for ctrl+c");
            tracing::info!("Shutting down hot-reload watcher...");
            let _ = shutdown_tx.send(());
            let _ = watcher_handle.await;
        });
    }

    let _enable_cors = config.development.enable_cors;
    let _enable_debug_routes = config.development.enable_debug_routes;
    let app = HttpServer::new(move || {
        let app_data_dev_mode = dev_mode;
        let app_builder = App::new()
            .app_data(web::Data::new(state.clone()))
            .app_data(web::Data::new(config.clone()))
            .app_data(web::Data::new(app_data_dev_mode))
            .wrap(middleware::Logger::default())
            .wrap(middleware::NormalizePath::trim())
            .wrap(add_security_headers());

        // For now, skip conditional CORS middleware due to type complexity
        // TODO: Add proper CORS handling with actix-cors crate
        app_builder
            // Dashboard routes
            .route("/", web::get().to(handlers::index))
            .route("/health", web::get().to(handlers::health_check))
            // API routes
            .service(
                web::scope("/api")
                    .route("/status", web::get().to(handlers::get_status))
                    .route("/heartbeat", web::get().to(handlers::get_heartbeat))
                    .route("/metrics", web::get().to(handlers::get_metrics))
                    .route("/tools", web::get().to(handlers::list_tools))
                    .route("/tools/execute", web::post().to(handlers::execute_tool))
                    .route("/tool-calls", web::get().to(handlers::get_tool_calls))
                    .route("/resources", web::get().to(handlers::list_resources))
                    .route("/events", web::get().to(handlers::get_events))
                    .route("/sessions", web::get().to(handlers::get_sessions))
                    .route("/config", web::get().to(handlers::get_config)),
            )
            // Debug routes (if enabled)
            .service(
                web::scope("/debug")
                    .route("/config", web::get().to(handlers::debug_config))
                    .route("/state", web::get().to(handlers::debug_state))
                    .route("/events", web::get().to(handlers::debug_events)),
            )
            // Real-time endpoints
            .route("/ws", web::get().to(websocket::websocket_handler))
            .route("/sse", web::get().to(websocket::sse_handler))
            // Static files
            .service(Files::new("/static", "./static").show_files_listing())
    });

    app.bind(&bind_address)?.run().await
}
