use actix_web::{web, HttpRequest, HttpResponse, Result};
use actix_ws::Message;
use futures_util::StreamExt;

use crate::shared::state::{AppState, SystemEvent};

pub async fn websocket_handler(
    req: HttpRequest,
    stream: web::Payload,
    data: web::Data<AppState>,
) -> Result<HttpResponse> {
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
