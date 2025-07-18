use actix_web::{web, HttpRequest, HttpResponse, Result};
use actix_ws::Message;
use futures_util::StreamExt;
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::shared::{
    config::Config,
    state::{AppState, SystemEvent},
};

/// Rate limiter for WebSocket connections
#[derive(Clone)]
pub struct WebSocketRateLimiter {
    connections: Arc<RwLock<HashMap<IpAddr, Vec<Instant>>>>,
    max_connections_per_ip: usize,
    time_window: Duration,
}

impl WebSocketRateLimiter {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            max_connections_per_ip: 10, // Max 10 connections per IP
            time_window: Duration::from_secs(60), // Per minute
        }
    }

    /// Check if IP is allowed to connect
    pub async fn check_rate_limit(&self, ip: IpAddr) -> bool {
        let now = Instant::now();
        let mut connections = self.connections.write().await;
        
        // Clean old entries
        let entry = connections.entry(ip).or_insert_with(Vec::new);
        entry.retain(|&timestamp| now.duration_since(timestamp) < self.time_window);
        
        // Check if under limit
        if entry.len() >= self.max_connections_per_ip {
            return false;
        }
        
        // Add new connection
        entry.push(now);
        true
    }

    /// Clean up expired entries periodically
    pub async fn cleanup(&self) {
        let now = Instant::now();
        let mut connections = self.connections.write().await;
        
        connections.retain(|_, timestamps| {
            timestamps.retain(|&timestamp| now.duration_since(timestamp) < self.time_window);
            !timestamps.is_empty()
        });
    }
}

lazy_static::lazy_static! {
    static ref RATE_LIMITER: WebSocketRateLimiter = WebSocketRateLimiter::new();
}

/// Validate WebSocket origin header
fn validate_websocket_origin(req: &HttpRequest, config: &Config) -> bool {
    // In development mode, allow all origins
    if config.development.enable_cors {
        return true;
    }

    // Check if origin header is present
    let origin = match req.headers().get("Origin") {
        Some(origin) => match origin.to_str() {
            Ok(origin_str) => origin_str,
            Err(_) => return false,
        },
        None => return false, // No origin header
    };

    // Check if origin is in allowed list
    config
        .security
        .websocket_allowed_origins
        .contains(&origin.to_string())
}

pub async fn websocket_handler(
    req: HttpRequest,
    stream: web::Payload,
    data: web::Data<AppState>,
    config: web::Data<Config>,
) -> Result<HttpResponse> {
    // Extract client IP address
    let client_ip = req
        .connection_info()
        .peer_addr()
        .and_then(|addr| addr.parse::<std::net::SocketAddr>().ok())
        .map(|addr| addr.ip())
        .unwrap_or_else(|| std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1)));

    // Check rate limit
    if !RATE_LIMITER.check_rate_limit(client_ip).await {
        tracing::warn!(
            "WebSocket connection rejected due to rate limit: IP {}",
            client_ip
        );
        return Ok(HttpResponse::TooManyRequests().json(serde_json::json!({
            "error": "Rate limit exceeded",
            "message": "Too many WebSocket connections from this IP address"
        })));
    }

    // Validate origin before establishing WebSocket connection
    if !validate_websocket_origin(&req, &config) {
        tracing::warn!(
            "WebSocket connection rejected due to invalid origin: {:?}",
            req.headers().get("Origin")
        );
        return Ok(HttpResponse::Forbidden().body("Invalid origin"));
    }

    let (res, mut session, mut msg_stream) = actix_ws::handle(&req, stream)?;

    let state = data.get_ref().clone();
    let mut event_rx = state.event_tx.subscribe();

    actix_web::rt::spawn(async move {
        loop {
            tokio::select! {
                Some(msg) = msg_stream.next() => {
                    match msg {
                        Ok(Message::Text(text)) => {
                            // Handle client messages
                            tracing::debug!("Received WS message: {}", text);
                        }
                        Ok(Message::Close(_)) => break,
                        _ => {}
                    }
                }
                Ok(event) = event_rx.recv() => {
                    let event_json = match event {
                        SystemEvent::McpConnected => {
                            serde_json::json!({
                                "type": "mcp_connected",
                                "timestamp": chrono::Utc::now()
                            })
                        }
                        SystemEvent::McpDisconnected => {
                            serde_json::json!({
                                "type": "mcp_disconnected",
                                "timestamp": chrono::Utc::now()
                            })
                        }
                        SystemEvent::ToolCalled { name, id } => {
                            serde_json::json!({
                                "type": "tool_called",
                                "name": name,
                                "id": id,
                                "timestamp": chrono::Utc::now()
                            })
                        }
                        SystemEvent::ResourceAccessed { uri } => {
                            serde_json::json!({
                                "type": "resource_accessed",
                                "uri": uri,
                                "timestamp": chrono::Utc::now()
                            })
                        }
                        SystemEvent::Error { message } => {
                            serde_json::json!({
                                "type": "error",
                                "message": message,
                                "timestamp": chrono::Utc::now()
                            })
                        }
                        SystemEvent::Custom(payload) => {
                            // Parse the custom payload if it's JSON, otherwise wrap it
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&payload) {
                                json
                            } else {
                                serde_json::json!({
                                    "type": "custom",
                                    "payload": payload,
                                    "timestamp": chrono::Utc::now()
                                })
                            }
                        }
                    };

                    if session.text(event_json.to_string()).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    Ok(res)
}

pub async fn sse_handler(data: web::Data<AppState>) -> Result<HttpResponse> {
    let mut event_rx = data.event_tx.subscribe();

    let stream = async_stream::stream! {
        while let Ok(event) = event_rx.recv().await {
            let event_data = match event {
                SystemEvent::McpConnected => {
                    format!("event: mcp_connected\ndata: {}\n\n", serde_json::json!({
                        "type": "connected",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "html": format!(
                            r#"<div class="alert alert-success" hx-swap-oob="afterbegin:#events-container">
                                <span class="timestamp">{}</span>
                                <span class="message">MCP Server Connected</span>
                            </div>"#,
                            chrono::Utc::now().format("%H:%M:%S")
                        )
                    }))
                }
                SystemEvent::McpDisconnected => {
                    format!("event: mcp_disconnected\ndata: {}\n\n", serde_json::json!({
                        "type": "disconnected",
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "html": format!(
                            r#"<div class="alert alert-warning" hx-swap-oob="afterbegin:#events-container">
                                <span class="timestamp">{}</span>
                                <span class="message">MCP Server Disconnected</span>
                            </div>"#,
                            chrono::Utc::now().format("%H:%M:%S")
                        )
                    }))
                }
                SystemEvent::ToolCalled { name, id } => {
                    format!("event: tool_called\ndata: {}\n\n", serde_json::json!({
                        "type": "tool_called",
                        "name": name,
                        "id": id,
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "html": format!(
                            r#"<div class="tool-call-event" hx-swap-oob="afterbegin:#tool-calls-live">
                                <div class="tool-call">
                                    <span class="timestamp">{}</span>
                                    <span class="tool-name">{}</span>
                                    <span class="tool-id">#{}</span>
                                    <span class="status executing">Executing...</span>
                                </div>
                            </div>"#,
                            chrono::Utc::now().format("%H:%M:%S"),
                            name,
                            id
                        )
                    }))
                }
                SystemEvent::ResourceAccessed { uri } => {
                    format!("event: resource_accessed\ndata: {}\n\n", serde_json::json!({
                        "type": "resource_accessed",
                        "uri": uri,
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "html": format!(
                            r#"<div class="resource-event" hx-swap-oob="afterbegin:#resources-live">
                                <span class="timestamp">{}</span>
                                <span class="resource-uri">{}</span>
                                <span class="status accessed">Accessed</span>
                            </div>"#,
                            chrono::Utc::now().format("%H:%M:%S"),
                            uri
                        )
                    }))
                }
                SystemEvent::Error { message } => {
                    format!("event: error\ndata: {}\n\n", serde_json::json!({
                        "type": "error",
                        "message": message,
                        "timestamp": chrono::Utc::now().to_rfc3339(),
                        "html": format!(
                            r#"<div class="alert alert-error" hx-swap-oob="afterbegin:#events-container">
                                <span class="timestamp">{}</span>
                                <span class="message">Error: {}</span>
                            </div>"#,
                            chrono::Utc::now().format("%H:%M:%S"),
                            message
                        )
                    }))
                }
                SystemEvent::Custom(payload) => {
                    // For SSE, emit custom events as-is if they're JSON
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&payload) {
                        format!("event: custom\ndata: {json}\n\n")
                    } else {
                        let json_data = serde_json::json!({
                            "type": "custom",
                            "payload": payload,
                            "timestamp": chrono::Utc::now().to_rfc3339()
                        });
                        format!("event: custom\ndata: {json_data}\n\n")
                    }
                }
            };

            yield Ok::<_, actix_web::Error>(web::Bytes::from(event_data));
        }
    };

    Ok(HttpResponse::Ok()
        .content_type("text/event-stream")
        .insert_header(("Cache-Control", "no-cache"))
        .insert_header(("Connection", "keep-alive"))
        .streaming(stream))
}
