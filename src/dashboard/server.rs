use crate::dashboard::handlers;
use crate::dashboard::websocket;
use crate::shared::{config::Config, state::AppState};
use actix_files::Files;
use actix_web::{middleware, web, App, HttpServer};

// Allow dead_code: Public API convenience function for external consumers
// Provides simplified interface using default configuration
#[allow(dead_code)]
pub async fn run_dashboard(state: AppState) -> std::io::Result<()> {
    run_dashboard_with_config(state, Config::default()).await
}

pub async fn run_dashboard_with_config(state: AppState, config: Config) -> std::io::Result<()> {
    let bind_address = format!(
        "{}:{}",
        config.server.dashboard_host, config.server.dashboard_port
    );
    tracing::info!("Starting dashboard server on http://{}", bind_address);

    let _enable_cors = config.development.enable_cors;
    let enable_debug_routes = config.development.enable_debug_routes;
    let app = HttpServer::new(move || {
        let app_builder = App::new()
            .app_data(web::Data::new(state.clone()))
            .app_data(web::Data::new(config.clone()))
            .wrap(middleware::Logger::default())
            .wrap(middleware::NormalizePath::trim());

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
                    .route("/events", web::get().to(handlers::debug_events))
                    .configure(move |cfg| {
                        if enable_debug_routes {
                            cfg.route("/panic", web::get().to(handlers::debug_panic));
                        }
                    }),
            )
            // Real-time endpoints
            .route("/ws", web::get().to(websocket::websocket_handler))
            .route("/sse", web::get().to(websocket::sse_handler))
            // Static files
            .service(Files::new("/static", "./static").show_files_listing())
    });

    app.bind(&bind_address)?.run().await
}
