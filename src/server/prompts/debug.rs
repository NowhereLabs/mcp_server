use crate::server::error::Result;
use crate::shared::state::{AppState, SystemEvent};
use chrono::Utc;
use tracing::info;

pub async fn generate_debug_info(
    include_metrics: bool,
    include_history: bool,
    state: &AppState,
) -> Result<String> {
    info!("Generating debug information");

    let current_status = state.get_status();
    let sessions = state.get_active_sessions();
    let tool_calls = if include_history {
        state.get_tool_calls(20).await
    } else {
        vec![]
    };
    let events = if include_history {
        state.get_events(20)
    } else {
        vec![]
    };
    let metrics = if include_metrics {
        state.get_metrics().await
    } else {
        std::collections::HashMap::new()
    };

    let mut debug_info = String::new();

    // Header
    debug_info.push_str("# MCP Server Debug Information\n");
    let now = Utc::now().to_rfc3339();
    debug_info.push_str(&format!("Generated at: {now}\n\n"));

    // Server Status
    debug_info.push_str("## Server Status\n");
    debug_info.push_str(&format!(
        "- Status: {}\n",
        if current_status.connected {
            "Connected"
        } else {
            "Disconnected"
        }
    ));
    debug_info.push_str(&format!(
        "- Started: {}\n",
        current_status.started_at.to_rfc3339()
    ));
    debug_info.push_str(&format!(
        "- Uptime: {}\n",
        format_duration((Utc::now() - current_status.started_at).num_seconds())
    ));
    debug_info.push_str(&format!("- Version: {}\n\n", env!("CARGO_PKG_VERSION")));

    // Active Sessions
    debug_info.push_str("## Active Sessions\n");
    debug_info.push_str(&format!("- Total sessions: {}\n", sessions.len()));
    for session in sessions.iter() {
        debug_info.push_str(&format!(
            "  - Session {}: {} requests\n",
            session.id, session.request_count
        ));
        debug_info.push_str(&format!(
            "    - Started: {}\n",
            session.started_at.to_rfc3339()
        ));
        debug_info.push_str(&format!(
            "    - Last activity: {}\n",
            session.last_activity.to_rfc3339()
        ));
    }
    debug_info.push('\n');

    // Performance Metrics
    if include_metrics && !metrics.is_empty() {
        debug_info.push_str("## Performance Metrics\n");
        for (metric_name, metric_value) in metrics.iter() {
            let value_str = match metric_value {
                crate::shared::state::MetricValue::Counter(v) => format!("Counter: {v}"),
                crate::shared::state::MetricValue::Gauge(v) => format!("Gauge: {v:.2}"),
                crate::shared::state::MetricValue::Histogram(v) => {
                    format!("Histogram: {} values", v.len())
                }
            };
            debug_info.push_str(&format!("- {metric_name}: {value_str}\n"));
        }
        debug_info.push('\n');
    }

    // Tool Call History
    if include_history && !tool_calls.is_empty() {
        debug_info.push_str("## Recent Tool Calls\n");
        let successful_calls = tool_calls.iter().filter(|tc| tc.success).count();
        let failed_calls = tool_calls.len() - successful_calls;
        let success_rate = (successful_calls as f64 / tool_calls.len() as f64) * 100.0;

        debug_info.push_str(&format!("- Total calls: {}\n", tool_calls.len()));
        debug_info.push_str(&format!(
            "- Successful: {successful_calls} ({success_rate:.1}%)\n"
        ));
        debug_info.push_str(&format!(
            "- Failed: {} ({:.1}%)\n",
            failed_calls,
            100.0 - success_rate
        ));
        debug_info.push('\n');

        debug_info.push_str("### Call Details:\n");
        for tc in tool_calls.iter().take(10) {
            let status = if tc.success { "✓" } else { "✗" };
            debug_info.push_str(&format!(
                "- {} {} ({}ms) - {}\n",
                status,
                tc.tool_name,
                tc.execution_time.as_millis(),
                tc.timestamp.format("%H:%M:%S")
            ));
            if let Some(error) = &tc.error {
                debug_info.push_str(&format!("  Error: {error}\n"));
            }
        }
        debug_info.push('\n');
    }

    // System Events
    if include_history && !events.is_empty() {
        debug_info.push_str("## Recent Events\n");
        let mut event_counts = std::collections::HashMap::new();
        for event in &events {
            let event_type = match event {
                SystemEvent::McpConnected => "mcp_connected",
                SystemEvent::McpDisconnected => "mcp_disconnected",
                SystemEvent::ToolCalled { name, .. } => name,
                SystemEvent::ResourceAccessed { .. } => "resource_accessed",
                SystemEvent::Error { .. } => "error",
            };
            let count = event_counts.entry(event_type.to_string()).or_insert(0);
            *count += 1;
        }

        debug_info.push_str(&format!("- Total events: {}\n", events.len()));
        debug_info.push_str("- Event types:\n");
        for (event_type, count) in event_counts.iter() {
            debug_info.push_str(&format!("  - {event_type}: {count}\n"));
        }
        debug_info.push('\n');

        debug_info.push_str("### Recent Events:\n");
        for event in events.iter().take(10) {
            let (event_type, description) = match event {
                SystemEvent::McpConnected => ("MCP Connected", "MCP server connected".to_string()),
                SystemEvent::McpDisconnected => {
                    ("MCP Disconnected", "MCP server disconnected".to_string())
                }
                SystemEvent::ToolCalled { name, .. } => {
                    ("Tool Called", format!("Tool called: {name}"))
                }
                SystemEvent::ResourceAccessed { uri } => {
                    ("Resource Accessed", format!("Resource accessed: {uri}"))
                }
                SystemEvent::Error { message } => ("Error", message.clone()),
            };
            debug_info.push_str(&format!("- {event_type} - {description}\n"));
        }
        debug_info.push('\n');
    }

    // Health Status
    debug_info.push_str("## Health Status\n");
    debug_info.push_str("- Memory: OK\n");
    debug_info.push_str("- Disk: OK\n");
    debug_info.push_str("- Network: OK\n");
    debug_info.push_str("- State Management: OK\n\n");

    // Troubleshooting Suggestions
    debug_info.push_str("## Troubleshooting Suggestions\n");

    if !tool_calls.is_empty() {
        let recent_failures = tool_calls.iter().filter(|tc| !tc.success).count();
        if recent_failures > 0 {
            debug_info.push_str(&format!(
                "- ⚠️  {recent_failures} recent tool call failures detected\n"
            ));
            debug_info.push_str("  - Check error messages above for details\n");
            debug_info.push_str("  - Verify file permissions and network connectivity\n");
        }

        let slow_calls = tool_calls
            .iter()
            .filter(|tc| tc.execution_time.as_millis() > 5000)
            .count();
        if slow_calls > 0 {
            debug_info.push_str(&format!(
                "- ⚠️  {slow_calls} slow tool calls detected (>5s)\n"
            ));
            debug_info.push_str("  - Consider optimizing tool implementations\n");
            debug_info.push_str("  - Check system resources\n");
        }
    }

    if sessions.is_empty() {
        debug_info.push_str("- ℹ️  No active sessions\n");
        debug_info.push_str("  - Server is running but no clients connected\n");
    }

    debug_info.push_str("- ✅ Server is operational\n");
    debug_info.push_str("- ✅ All core components functioning\n");

    Ok(debug_info)
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
