use std::sync::Arc;

use actix_web::{web, HttpResponse, Result};
use askama::Template;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::shared::{
    config::Config,
    state::{AppState, ToolCall, ToolCallResult},
};

#[derive(Template)]
#[template(path = "dashboard.html")]
struct DashboardTemplate {
    title: String,
    version: String,
}

#[derive(Template)]
#[template(path = "components/status.html")]
struct StatusTemplate {
    status_class: String,
    status_text: String,
    server_name: String,
    server_version: String,
    capabilities: Vec<String>,
    started_at: String,
    last_heartbeat: String,
    has_heartbeat: bool,
    active_sessions: usize,
    total_tool_calls: usize,
}

#[derive(Template)]
#[template(path = "components/tools.html")]
struct ToolsTemplate {
    tools: Vec<ToolInfo>,
}

#[derive(Template)]
#[template(path = "components/tool_calls.html")]
struct ToolCallsTemplate {
    tool_calls: Vec<FormattedToolCall>,
}

#[derive(Template)]
#[template(path = "components/metrics.html")]
struct MetricsTemplate {
    metrics: DashboardMetrics,
}

#[derive(Serialize)]
struct ToolInfo {
    name: String,
    description: String,
    category: String,
}

#[derive(Serialize)]
struct FormattedToolCall {
    name: String,
    duration_ms: String,
    formatted_timestamp: String,
    status_class: String,
    success: bool,
    error: String,
    has_error: bool,
    result_string: String,
    has_result: bool,
}

#[derive(Serialize)]
struct DashboardMetrics {
    total_tool_calls: usize,
    success_rate: f64,
    active_sessions: usize,
    avg_duration_ms: f64,
    tools_available: usize,
    resources_available: usize,
}

pub async fn index() -> Result<HttpResponse> {
    let template = DashboardTemplate {
        title: "MCP Server Dashboard".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };

    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(template.render().map_err(|e| {
            tracing::error!("Template rendering error: {}", e);
            actix_web::error::ErrorInternalServerError("Template rendering failed")
        })?))
}

pub async fn health_check() -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now()
    })))
}

pub async fn get_status(data: web::Data<AppState>) -> Result<HttpResponse> {
    let mut status = data.mcp_status.load().as_ref().clone();
    let active_sessions = data.active_sessions.len();
    let total_tool_calls = data.tool_calls.read().await.len();

    // Update heartbeat to current time for real-time updates
    status.last_heartbeat = Some(chrono::Utc::now());

    // Update the stored status
    data.mcp_status.store(Arc::new(status.clone()));

    let template = StatusTemplate {
        status_class: if status.connected {
            "connected".to_string()
        } else {
            "disconnected".to_string()
        },
        status_text: if status.connected {
            "Connected".to_string()
        } else {
            "Disconnected".to_string()
        },
        server_name: status.server_info.name.clone(),
        server_version: status.server_info.version.clone(),
        capabilities: status.capabilities.clone(),
        started_at: status
            .started_at
            .format("%Y-%m-%d %H:%M:%S UTC")
            .to_string(),
        last_heartbeat: status
            .last_heartbeat
            .map(|hb| hb.format("%Y-%m-%d %H:%M:%S UTC").to_string())
            .unwrap_or_else(|| "Never".to_string()),
        has_heartbeat: status.last_heartbeat.is_some(),
        active_sessions,
        total_tool_calls,
    };

    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(template.render().map_err(|e| {
            tracing::error!("Template rendering error: {}", e);
            actix_web::error::ErrorInternalServerError("Template rendering failed")
        })?))
}

pub async fn get_metrics(data: web::Data<AppState>) -> Result<HttpResponse> {
    let tool_calls = data.tool_calls.read().await;
    let total_calls = tool_calls.len();

    let successful_calls = tool_calls
        .iter()
        .filter(|call| matches!(call.result, Some(ToolCallResult::Success(_))))
        .count();

    let avg_duration = if !tool_calls.is_empty() {
        tool_calls
            .iter()
            .filter_map(|call| call.duration_ms)
            .sum::<u64>() as f64
            / tool_calls.len() as f64
    } else {
        0.0
    };

    let success_rate = if total_calls > 0 {
        (successful_calls as f64 / total_calls as f64) * 100.0
    } else {
        100.0
    };

    let metrics = DashboardMetrics {
        total_tool_calls: total_calls,
        success_rate: (success_rate * 10.0).round() / 10.0, // Round to 1 decimal place
        active_sessions: data.active_sessions.len(),
        avg_duration_ms: avg_duration.round(),
        tools_available: 1,     // echo
        resources_available: 0, // disabled
    };

    let template = MetricsTemplate { metrics };

    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(template.render().map_err(|e| {
            tracing::error!("Template rendering error: {}", e);
            actix_web::error::ErrorInternalServerError("Template rendering failed")
        })?))
}

pub async fn get_tool_calls(data: web::Data<AppState>) -> Result<HttpResponse> {
    let calls = data.tool_calls.read().await;
    let recent_calls: Vec<FormattedToolCall> = calls
        .iter()
        .rev()
        .take(20)
        .map(|call| FormattedToolCall {
            name: call.name.clone(),
            duration_ms: call
                .duration_ms
                .map(|d| format!("{d}ms"))
                .unwrap_or_else(|| "pending".to_string()),
            formatted_timestamp: call.timestamp.format("%H:%M:%S").to_string(),
            status_class: if call.success {
                "success".to_string()
            } else {
                "error".to_string()
            },
            success: call.success,
            error: call
                .error
                .clone()
                .unwrap_or_else(|| "Unknown error".to_string()),
            has_error: call.error.is_some(),
            result_string: call
                .result_string
                .clone()
                .unwrap_or_else(|| "No result".to_string()),
            has_result: call.result_string.is_some(),
        })
        .collect();

    let template = ToolCallsTemplate {
        tool_calls: recent_calls,
    };

    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(template.render().map_err(|e| {
            tracing::error!("Template rendering error: {}", e);
            actix_web::error::ErrorInternalServerError("Template rendering failed")
        })?))
}

pub async fn list_tools(_data: web::Data<AppState>) -> Result<HttpResponse> {
    let tools = vec![ToolInfo {
        name: "echo".to_string(),
        description: "Echo back the provided message".to_string(),
        category: "utility".to_string(),
    }];

    let template = ToolsTemplate { tools };

    Ok(HttpResponse::Ok()
        .content_type("text/html")
        .body(template.render().map_err(|e| {
            tracing::error!("Template rendering error: {}", e);
            actix_web::error::ErrorInternalServerError("Template rendering failed")
        })?))
}

pub async fn list_resources(_data: web::Data<AppState>) -> Result<HttpResponse> {
    // Resources are disabled in this simplified MCP server
    let resources: Vec<serde_json::Value> = vec![];

    Ok(HttpResponse::Ok().json(resources))
}

pub async fn get_events(_data: web::Data<AppState>) -> Result<HttpResponse> {
    // Return recent events from the event log
    let events = vec![serde_json::json!({
        "timestamp": chrono::Utc::now(),
        "type": "info",
        "message": "Dashboard server started"
    })];

    Ok(HttpResponse::Ok().json(events))
}

pub async fn get_sessions(data: web::Data<AppState>) -> Result<HttpResponse> {
    let sessions: Vec<_> = data
        .active_sessions
        .iter()
        .map(|entry| {
            let session = entry.value();
            serde_json::json!({
                "id": session.id,
                "started_at": session.started_at,
                "request_count": session.request_count,
                "last_activity": session.last_activity
            })
        })
        .collect();

    Ok(HttpResponse::Ok().json(sessions))
}

#[derive(Deserialize)]
pub struct ExecuteToolRequest {
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(Serialize)]
pub struct ExecuteToolResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub tool_call_id: String,
}

pub async fn execute_tool(
    data: web::Data<AppState>,
    payload: web::Json<ExecuteToolRequest>,
) -> Result<HttpResponse> {
    let tool_call_id = Uuid::new_v4();
    let start_time = std::time::Instant::now();

    // Create initial tool call record
    let mut tool_call = ToolCall::new(payload.name.clone(), payload.arguments.clone());
    tool_call.id = tool_call_id;

    // Execute the tool based on its name
    let result: Result<serde_json::Value, String> = match payload.name.as_str() {
        "echo" => match payload.arguments.get("message").and_then(|v| v.as_str()) {
            Some(message) => {
                Ok(serde_json::json!({"echoed": message, "message": format!("Echo: {message}")}))
            }
            None => Err("Missing message parameter".to_string()),
        },
        _ => {
            let error_msg = format!(
                "Unknown tool: {} (only 'echo' tool is available)",
                payload.name
            );
            tool_call.result = Some(ToolCallResult::Error(error_msg.clone()));
            tool_call.success = false;
            tool_call.error = Some(error_msg.clone());
            data.record_tool_call(tool_call).await.unwrap_or_else(|e| {
                tracing::error!("Failed to record tool call: {e}");
            });

            return Ok(HttpResponse::BadRequest().json(ExecuteToolResponse {
                success: false,
                result: None,
                error: Some(error_msg),
                tool_call_id: tool_call_id.to_string(),
            }));
        }
    };

    // Complete the tool call with result
    let duration = start_time.elapsed();
    tool_call.duration_ms = Some(duration.as_millis() as u64);

    let response = match result {
        Ok(result_data) => {
            tool_call.result = Some(ToolCallResult::Success(result_data.clone()));
            tool_call.success = true;
            tool_call.result_string = Some(result_data.to_string());
            ExecuteToolResponse {
                success: true,
                result: Some(result_data),
                error: None,
                tool_call_id: tool_call_id.to_string(),
            }
        }
        Err(error) => {
            let error_msg = error.to_string();
            tool_call.result = Some(ToolCallResult::Error(error_msg.clone()));
            tool_call.success = false;
            tool_call.error = Some(error_msg.clone());
            ExecuteToolResponse {
                success: false,
                result: None,
                error: Some(error_msg),
                tool_call_id: tool_call_id.to_string(),
            }
        }
    };

    // Record the tool call
    data.record_tool_call(tool_call).await.unwrap_or_else(|e| {
        tracing::error!("Failed to record tool call: {e}");
    });

    Ok(HttpResponse::Ok().json(response))
}

pub async fn get_config(config: web::Data<Config>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(config.get_ref()))
}

pub async fn debug_config(config: web::Data<Config>) -> Result<HttpResponse> {
    // Filter sensitive environment variables
    let sensitive_prefixes = ["API_", "SECRET_", "TOKEN_", "KEY_", "PASSWORD_", "AUTH_"];
    let sensitive_names = ["HOME", "USER", "USERNAME", "PATH"];

    let filtered_env: std::collections::HashMap<String, String> = std::env::vars()
        .filter(|(key, _)| {
            let key_upper = key.to_uppercase();
            !sensitive_prefixes
                .iter()
                .any(|prefix| key_upper.starts_with(prefix))
                && !sensitive_names.iter().any(|name| key_upper == *name)
        })
        .collect();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "config": config.get_ref(),
        "env_vars": filtered_env
    })))
}

pub async fn debug_state(data: web::Data<AppState>) -> Result<HttpResponse> {
    let status = data.mcp_status.load();
    let active_sessions = data.active_sessions.len();
    let tool_calls = data.tool_calls.read().await;
    let tool_calls_count = tool_calls.len();

    Ok(HttpResponse::Ok().json(serde_json::json!({
        "mcp_status": {
            "connected": status.connected,
            "capabilities": status.capabilities,
            "server_info": status.server_info,
            "started_at": status.started_at,
            "last_heartbeat": status.last_heartbeat
        },
        "active_sessions": active_sessions,
        "total_tool_calls": tool_calls_count,
        "uptime_seconds": chrono::Utc::now().signed_duration_since(status.started_at).num_seconds()
    })))
}

pub async fn debug_events(data: web::Data<AppState>) -> Result<HttpResponse> {
    Ok(HttpResponse::Ok().json(serde_json::json!({
        "event_tx_receiver_count": data.event_tx.receiver_count(),
        "message": "Event system status"
    })))
}

pub async fn get_heartbeat(data: web::Data<AppState>) -> Result<HttpResponse> {
    let status = data.mcp_status.load().as_ref().clone();

    let heartbeat_data = serde_json::json!({
        "timestamp": status.last_heartbeat,
        "connected": status.connected,
        "uptime_seconds": chrono::Utc::now().signed_duration_since(status.started_at).num_seconds(),
        "active_sessions": data.active_sessions.len(),
        "total_tool_calls": data.tool_calls.read().await.len()
    });

    Ok(HttpResponse::Ok()
        .content_type("application/json")
        .body(heartbeat_data.to_string()))
}
