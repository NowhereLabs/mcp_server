use crate::server::error::Result;
use crate::shared::state::AppState;
use chrono::Utc;
use tracing::info;

pub async fn get_recent_logs(state: &AppState) -> Result<String> {
    info!("Getting recent logs");

    let tool_calls = state.get_tool_calls(50).await;
    let events = state.get_events(100);

    // Process tool calls
    let processed_tool_calls: Vec<serde_json::Value> = tool_calls
        .iter()
        .map(|tc| {
            serde_json::json!({
                "id": tc.id,
                "tool_name": tc.tool_name,
                "timestamp": tc.timestamp.to_rfc3339(),
                "execution_time_ms": tc.execution_time.as_millis(),
                "success": tc.success,
                "result": tc.result,
                "error": tc.error,
                "arguments": tc.arguments
            })
        })
        .collect();

    // Process events
    let processed_events: Vec<serde_json::Value> = events
        .iter()
        .map(|event| match event {
            crate::shared::state::SystemEvent::ToolCalled { name, id } => {
                serde_json::json!({
                    "id": id,
                    "event_type": "tool_called",
                    "description": format!("Tool '{}' was called", name),
                    "timestamp": Utc::now().to_rfc3339(),
                    "metadata": {"tool_name": name}
                })
            }
            crate::shared::state::SystemEvent::ResourceAccessed { uri } => {
                serde_json::json!({
                    "id": uuid::Uuid::new_v4(),
                    "event_type": "resource_accessed",
                    "description": format!("Resource '{}' was accessed", uri),
                    "timestamp": Utc::now().to_rfc3339(),
                    "metadata": {"uri": uri}
                })
            }
            crate::shared::state::SystemEvent::Error { message } => {
                serde_json::json!({
                    "id": uuid::Uuid::new_v4(),
                    "event_type": "error",
                    "description": message,
                    "timestamp": Utc::now().to_rfc3339(),
                    "metadata": {}
                })
            }
            crate::shared::state::SystemEvent::McpConnected => {
                serde_json::json!({
                    "id": uuid::Uuid::new_v4(),
                    "event_type": "mcp_connected",
                    "description": "MCP server connected",
                    "timestamp": Utc::now().to_rfc3339(),
                    "metadata": {}
                })
            }
            crate::shared::state::SystemEvent::McpDisconnected => {
                serde_json::json!({
                    "id": uuid::Uuid::new_v4(),
                    "event_type": "mcp_disconnected",
                    "description": "MCP server disconnected",
                    "timestamp": Utc::now().to_rfc3339(),
                    "metadata": {}
                })
            }
        })
        .collect();

    // Calculate statistics
    let total_tool_calls = tool_calls.len();
    let successful_calls = tool_calls.iter().filter(|tc| tc.success).count();
    let failed_calls = total_tool_calls - successful_calls;
    let success_rate = if total_tool_calls > 0 {
        (successful_calls as f64 / total_tool_calls as f64) * 100.0
    } else {
        0.0
    };

    // Calculate average execution time
    let avg_execution_time = if !tool_calls.is_empty() {
        let total_time: u128 = tool_calls
            .iter()
            .map(|tc| tc.execution_time.as_millis())
            .sum();
        total_time as f64 / tool_calls.len() as f64
    } else {
        0.0
    };

    // Group tool calls by type
    let mut tool_usage = std::collections::HashMap::new();
    for tc in &tool_calls {
        let entry = tool_usage.entry(tc.tool_name.clone()).or_insert(0);
        *entry += 1;
    }

    // Group events by type
    let mut event_counts = std::collections::HashMap::new();
    for event in &events {
        let event_type = match event {
            crate::shared::state::SystemEvent::ToolCalled { .. } => "tool_called",
            crate::shared::state::SystemEvent::ResourceAccessed { .. } => "resource_accessed",
            crate::shared::state::SystemEvent::Error { .. } => "error",
            crate::shared::state::SystemEvent::McpConnected => "mcp_connected",
            crate::shared::state::SystemEvent::McpDisconnected => "mcp_disconnected",
        };
        let entry = event_counts.entry(event_type.to_string()).or_insert(0);
        *entry += 1;
    }

    // Get recent errors
    let recent_errors: Vec<serde_json::Value> = tool_calls
        .iter()
        .filter(|tc| !tc.success)
        .take(10)
        .map(|tc| {
            serde_json::json!({
                "id": tc.id,
                "tool_name": tc.tool_name,
                "timestamp": tc.timestamp.to_rfc3339(),
                "error": tc.error,
                "arguments": tc.arguments
            })
        })
        .collect();

    let logs = serde_json::json!({
        "summary": {
            "timestamp": Utc::now().to_rfc3339(),
            "total_tool_calls": total_tool_calls,
            "successful_calls": successful_calls,
            "failed_calls": failed_calls,
            "success_rate_percent": success_rate,
            "average_execution_time_ms": avg_execution_time,
            "total_events": events.len()
        },
        "tool_usage": tool_usage,
        "event_counts": event_counts,
        "recent_tool_calls": processed_tool_calls,
        "recent_events": processed_events,
        "recent_errors": recent_errors,
        "performance_metrics": {
            "fastest_call": tool_calls.iter()
                .min_by_key(|tc| tc.execution_time)
                .map(|tc| serde_json::json!({
                    "tool_name": tc.tool_name,
                    "execution_time_ms": tc.execution_time.as_millis(),
                    "timestamp": tc.timestamp.to_rfc3339()
                })),
            "slowest_call": tool_calls.iter()
                .max_by_key(|tc| tc.execution_time)
                .map(|tc| serde_json::json!({
                    "tool_name": tc.tool_name,
                    "execution_time_ms": tc.execution_time.as_millis(),
                    "timestamp": tc.timestamp.to_rfc3339()
                }))
        }
    });

    Ok(serde_json::to_string_pretty(&logs)?)
}
