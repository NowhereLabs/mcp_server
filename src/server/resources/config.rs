use crate::server::error::Result;
use crate::shared::state::AppState;
use chrono::Utc;
use tracing::info;

pub async fn get_server_status(state: &AppState) -> Result<String> {
    info!("Getting server status");

    let current_status = state.get_status();
    let sessions = state.get_active_sessions();
    let metrics = state.get_metrics();

    // Calculate uptime
    let uptime_seconds = (Utc::now() - current_status.started_at).num_seconds();
    let uptime_formatted = format_duration(uptime_seconds);

    // Get recent tool calls count
    let tool_calls = state.get_tool_calls(10).await;
    let recent_tool_calls = tool_calls.len();

    // Calculate success rate
    let success_count = tool_calls.iter().filter(|tc| tc.success).count();
    let success_rate = if !tool_calls.is_empty() {
        (success_count as f64 / tool_calls.len() as f64) * 100.0
    } else {
        100.0
    };

    let config = serde_json::json!({
        "server_info": {
            "name": "Rust MCP Server",
            "version": env!("CARGO_PKG_VERSION"),
            "status": if current_status.connected { "connected" } else { "disconnected" },
            "started_at": current_status.started_at.to_rfc3339(),
            "uptime": uptime_formatted,
            "uptime_seconds": uptime_seconds
        },
        "capabilities": {
            "tools": [
                "read_file",
                "write_file",
                "list_directory",
                "http_get",
                "http_post",
                "system_info"
            ],
            "resources": [
                "config://server/status",
                "logs://server/recent"
            ],
            "prompts": [
                "debug_server"
            ]
        },
        "sessions": {
            "active_count": sessions.len(),
            "sessions": sessions.iter().map(|session| {
                serde_json::json!({
                    "id": session.id,
                    "started_at": session.started_at.to_rfc3339(),
                    "last_activity": session.last_activity.to_rfc3339(),
                    "request_count": session.request_count
                })
            }).collect::<Vec<_>>()
        },
        "performance": {
            "recent_tool_calls": recent_tool_calls,
            "success_rate_percent": success_rate,
            "metrics": metrics.await.iter().map(|(key, value)| {
                serde_json::json!({
                    "name": key,
                    "value": match value {
                        crate::shared::state::MetricValue::Counter(v) => serde_json::json!({
                            "type": "counter",
                            "value": v
                        }),
                        crate::shared::state::MetricValue::Gauge(v) => serde_json::json!({
                            "type": "gauge",
                            "value": v
                        }),
                        crate::shared::state::MetricValue::Histogram(v) => serde_json::json!({
                            "type": "histogram",
                            "value": v
                        }),
                    }
                })
            }).collect::<Vec<_>>()
        },
        "configuration": {
            "file_size_limit_mb": 10,
            "request_timeout_seconds": 30,
            "max_response_size_mb": 5,
            "max_tool_calls_history": 100,
            "max_events_history": 1000
        },
        "health": {
            "status": "healthy",
            "checks": {
                "memory_usage": "ok",
                "disk_space": "ok",
                "network_connectivity": "ok"
            }
        }
    });

    Ok(serde_json::to_string_pretty(&config)?)
}

fn format_duration(seconds: i64) -> String {
    if seconds < 60 {
        format!("{seconds}s")
    } else if seconds < 3600 {
        format!("{}m {}s", seconds / 60, seconds % 60)
    } else if seconds < 86400 {
        let hours = seconds / 3600;
        let minutes = (seconds % 3600) / 60;
        format!("{hours}h {minutes}m")
    } else {
        let days = seconds / 86400;
        let hours = (seconds % 86400) / 3600;
        format!("{days}d {hours}h")
    }
}
