use std::sync::Arc;

use arc_swap::ArcSwap;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

/// Core application state shared between MCP server and dashboard
///
/// This state uses concurrent data structures optimized for different access patterns:
/// - `mcp_status`: ArcSwap for frequently-read, rarely-updated data
/// - `active_sessions`: DashMap for concurrent session management
/// - `event_tx`: Broadcast channel for real-time event distribution
/// - `metrics`: DashMap for concurrent metrics collection
/// - `tool_calls`: RwLock for append-heavy tool call history
#[derive(Clone)]
pub struct AppState {
    /// Current MCP server status (connection, heartbeat, capabilities)
    pub mcp_status: Arc<ArcSwap<McpStatus>>,
    /// Active client sessions tracked by UUID
    pub active_sessions: Arc<DashMap<Uuid, SessionInfo>>,
    /// Event broadcaster for real-time updates
    pub event_tx: broadcast::Sender<SystemEvent>,
    /// System metrics collection
    pub metrics: Arc<DashMap<String, MetricValue>>,
    /// Tool call execution history
    pub tool_calls: Arc<RwLock<Vec<ToolCall>>>,
}

impl AppState {
    /// Create new application state with default values
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(1000);

        Self {
            mcp_status: Arc::new(ArcSwap::from_pointee(McpStatus::default())),
            active_sessions: Arc::new(DashMap::new()),
            event_tx,
            metrics: Arc::new(DashMap::new()),
            tool_calls: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Record a tool call execution and emit event
    pub async fn record_tool_call(
        &self,
        call: ToolCall,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Add to history
        self.tool_calls.write().await.push(call.clone());

        // Emit event (ignore if no subscribers)
        let _ = self.event_tx.send(SystemEvent::ToolCalled {
            name: call.name.clone(),
            id: call.id,
        });

        // Update metrics
        let metric_key = format!("tool_calls_{}", call.name);
        let counter = self
            .metrics
            .get(&metric_key)
            .map(|v| match v.value() {
                MetricValue::Counter(c) => *c,
                _ => 0,
            })
            .unwrap_or(0);

        self.metrics
            .insert(metric_key, MetricValue::Counter(counter + 1));

        Ok(())
    }

    /// Add a tool call to the history (for testing compatibility)
    #[allow(dead_code)]
    pub async fn add_tool_call(&self, call: ToolCall) {
        self.tool_calls.write().await.push(call);
    }

    /// Update a metric
    #[allow(dead_code)]
    pub fn update_metric(&self, key: &str, value: MetricValue) {
        self.metrics.insert(key.to_string(), value);
    }

    /// Get all metrics (for testing)
    #[allow(dead_code)]
    pub async fn get_metrics(&self) -> std::collections::HashMap<String, MetricValue> {
        self.metrics
            .iter()
            .map(|item| (item.key().clone(), item.value().clone()))
            .collect()
    }

    /// Send an event (for testing)
    // Allow dead_code: Test utility for manual event injection in unit tests
    #[allow(dead_code)]
    pub fn send_event(
        &self,
        event: SystemEvent,
    ) -> Result<(), broadcast::error::SendError<SystemEvent>> {
        self.event_tx.send(event).map(|_| ())
    }

    /// Send an event with details (for testing)
    // Allow dead_code: Compatibility layer for rich event system, converts detailed events to simple ones
    #[allow(dead_code)]
    pub fn send_event_details(
        &self,
        event: SystemEventDetails,
    ) -> Result<(), broadcast::error::SendError<SystemEvent>> {
        // Convert to regular SystemEvent for now - this is a compatibility method
        let simple_event = match event.event_type.as_str() {
            "file_read" | "file_write" | "directory_list" => SystemEvent::ToolCalled {
                name: event.event_type.clone(),
                id: event.id,
            },
            "http_request" => SystemEvent::ToolCalled {
                name: event.event_type.clone(),
                id: event.id,
            },
            "system_info" => SystemEvent::ToolCalled {
                name: event.event_type.clone(),
                id: event.id,
            },
            _ => SystemEvent::Error {
                message: event.description,
            },
        };

        self.event_tx.send(simple_event).map(|_| ())
    }

    /// Subscribe to events (for testing)
    // Allow dead_code: Test utility for event subscription and verification in unit tests
    #[allow(dead_code)]
    pub fn subscribe_to_events(&self) -> broadcast::Receiver<SystemEvent> {
        self.event_tx.subscribe()
    }

    /// Get current MCP status
    #[allow(dead_code)]
    pub fn get_status(&self) -> McpStatus {
        (**self.mcp_status.load()).clone()
    }

    /// Get active sessions
    #[allow(dead_code)]
    pub fn get_active_sessions(&self) -> Vec<SessionInfo> {
        self.active_sessions
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Get events (mock implementation for compatibility)
    #[allow(dead_code)]
    pub fn get_events(&self, _limit: usize) -> Vec<SystemEvent> {
        // In a real implementation, this would return stored events
        vec![]
    }

    /// Get tool calls with limit
    #[allow(dead_code)]
    pub async fn get_tool_calls(&self, limit: usize) -> Vec<ToolCall> {
        let calls = self.tool_calls.read().await;
        calls.iter().rev().take(limit).cloned().collect()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// MCP server connection and capability status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpStatus {
    /// Whether MCP server is currently connected
    pub connected: bool,
    /// Last heartbeat timestamp
    pub last_heartbeat: Option<DateTime<Utc>>,
    /// Server capabilities (tools, resources, prompts)
    pub capabilities: Vec<String>,
    /// Server identification information
    pub server_info: ServerInfo,
    /// When the server was started
    pub started_at: DateTime<Utc>,
}

impl Default for McpStatus {
    fn default() -> Self {
        Self {
            connected: true,
            last_heartbeat: Some(Utc::now()),
            capabilities: vec![
                "tools".to_string(),
                "resources".to_string(),
                "logging".to_string(),
            ],
            server_info: ServerInfo {
                name: "Rust MCP Server".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            started_at: Utc::now(),
        }
    }
}

/// Server identification information
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ServerInfo {
    /// Server name
    pub name: String,
    /// Server version
    pub version: String,
}

/// Information about an active client session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    /// Unique session identifier
    pub id: Uuid,
    /// When the session was started
    pub started_at: DateTime<Utc>,
    /// Number of requests processed in this session
    pub request_count: u64,
    /// Last activity timestamp
    pub last_activity: DateTime<Utc>,
}

impl SessionInfo {
    /// Create a new session with current timestamp
    pub fn new() -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            started_at: now,
            request_count: 0,
            last_activity: now,
        }
    }

    /// Update session with new activity
    // Allow dead_code: Session management infrastructure for tracking user activity and request counts
    #[allow(dead_code)]
    pub fn update_activity(&mut self) {
        self.last_activity = Utc::now();
        self.request_count += 1;
    }
}

impl Default for SessionInfo {
    fn default() -> Self {
        Self::new()
    }
}

/// Record of a tool call execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// Unique identifier for this tool call
    pub id: Uuid,
    /// Name of the tool that was called
    pub name: String,
    /// Tool name used in some legacy tests
    pub tool_name: String,
    /// Arguments passed to the tool
    pub arguments: serde_json::Value,
    /// When the tool was called
    pub timestamp: DateTime<Utc>,
    /// How long the tool took to execute (milliseconds)
    pub duration_ms: Option<u64>,
    /// Execution time (for compatibility)
    pub execution_time: std::time::Duration,
    /// Result of the tool execution
    pub result: Option<ToolCallResult>,
    /// Result string (for compatibility)
    pub result_string: Option<String>,
    /// Success flag
    pub success: bool,
    /// Error message
    pub error: Option<String>,
}

impl ToolCall {
    /// Create a new tool call record
    pub fn new(name: String, arguments: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.clone(),
            tool_name: name,
            arguments,
            timestamp: Utc::now(),
            duration_ms: None,
            execution_time: std::time::Duration::from_millis(0),
            result: None,
            result_string: None,
            success: false,
            error: None,
        }
    }

    /// Mark tool call as completed with result
    pub fn complete(mut self, result: ToolCallResult, duration_ms: u64) -> Self {
        self.result = Some(result.clone());
        self.duration_ms = Some(duration_ms);
        self.execution_time = std::time::Duration::from_millis(duration_ms);

        match result {
            ToolCallResult::Success(value) => {
                self.success = true;
                self.result_string = Some(value.to_string());
                self.error = None;
            }
            ToolCallResult::Error(msg) => {
                self.success = false;
                self.result_string = None;
                self.error = Some(msg);
            }
        }

        self
    }
}

/// Result of a tool call execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ToolCallResult {
    /// Tool executed successfully with result data
    Success(serde_json::Value),
    /// Tool execution failed with error message
    Error(String),
}

/// System events for real-time updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SystemEvent {
    /// MCP server connected
    McpConnected,
    /// MCP server disconnected
    McpDisconnected,
    /// A tool was called
    ToolCalled { name: String, id: Uuid },
    /// A resource was accessed
    ResourceAccessed { uri: String },
    /// System error occurred
    Error { message: String },
}

/// Extended system event with full details (for compatibility)
// Allow dead_code: Rich event type with metadata for future event system extensions
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemEventDetails {
    /// Unique identifier for this event
    pub id: Uuid,
    /// Type of event
    pub event_type: String,
    /// Human-readable description
    pub description: String,
    /// When the event occurred
    pub timestamp: DateTime<Utc>,
    /// Additional event metadata
    pub metadata: serde_json::Value,
}

/// Different types of metrics that can be collected
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MetricValue {
    /// Incrementing counter
    Counter(u64),
    /// Current value gauge
    Gauge(f64),
    /// Distribution of values
    Histogram(Vec<f64>),
}

impl MetricValue {
    /// Get the current value as a number
    // Allow dead_code: Utility for metric aggregation and display, converts all metric types to unified numeric value
    #[allow(dead_code)]
    pub fn as_number(&self) -> f64 {
        match self {
            MetricValue::Counter(c) => *c as f64,
            MetricValue::Gauge(g) => *g,
            MetricValue::Histogram(h) => h.last().copied().unwrap_or(0.0),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_app_state_creation() {
        let state = AppState::new();

        // Verify initial state - server starts connected
        assert!(state.mcp_status.load().connected);
        assert_eq!(state.active_sessions.len(), 0);
        assert_eq!(state.tool_calls.read().await.len(), 0);
    }

    #[tokio::test]
    async fn test_tool_call_recording() {
        let state = AppState::new();
        let tool_call = ToolCall::new("test_tool".to_string(), serde_json::json!({"arg": "value"}));

        // Record tool call
        state.record_tool_call(tool_call.clone()).await.unwrap();

        // Verify it was recorded
        let calls = state.tool_calls.read().await;
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].name, "test_tool");

        // Verify metric was updated
        let metric = state.metrics.get("tool_calls_test_tool").unwrap();
        assert_eq!(metric.as_number(), 1.0);
    }

    #[tokio::test]
    async fn test_session_management() {
        let state = AppState::new();
        let session = SessionInfo::new();
        let session_id = session.id;

        // Add session
        state.active_sessions.insert(session_id, session);

        // Verify session exists
        assert_eq!(state.active_sessions.len(), 1);
        assert!(state.active_sessions.contains_key(&session_id));

        // Update session activity
        let mut session_ref = state.active_sessions.get_mut(&session_id).unwrap();
        session_ref.update_activity();
        assert_eq!(session_ref.request_count, 1);
    }

    #[tokio::test]
    async fn test_event_broadcasting() {
        let state = AppState::new();
        let mut rx = state.event_tx.subscribe();

        // Send event
        let event = SystemEvent::McpConnected;
        state.event_tx.send(event).unwrap();

        // Verify event was received
        let received = rx.recv().await.unwrap();
        assert!(matches!(received, SystemEvent::McpConnected));
    }

    #[tokio::test]
    async fn test_mcp_status_update() {
        let state = AppState::new();

        // Update status
        let new_status = McpStatus {
            connected: true,
            last_heartbeat: Some(Utc::now()),
            capabilities: vec!["tools".to_string()],
            server_info: ServerInfo {
                name: "test-server".to_string(),
                version: "1.0.0".to_string(),
            },
            started_at: Utc::now(),
        };

        state.mcp_status.store(Arc::new(new_status.clone()));

        // Verify status was updated
        let current_status = state.mcp_status.load();
        assert!(current_status.connected);
        assert_eq!(current_status.server_info.name, "test-server");
    }

    #[tokio::test]
    async fn test_concurrent_access() {
        let state = AppState::new();

        // Spawn multiple tasks that access state concurrently
        let mut handles = Vec::new();
        for i in 0..10 {
            let state_clone = state.clone();
            let handle = tokio::spawn(async move {
                let tool_call = ToolCall::new(format!("tool_{i}"), serde_json::json!({"id": i}));
                state_clone.record_tool_call(tool_call).await.unwrap();

                let session = SessionInfo::new();
                state_clone.active_sessions.insert(session.id, session);
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        for handle in handles {
            handle.await.unwrap();
        }

        // Verify all operations completed
        assert_eq!(state.tool_calls.read().await.len(), 10);
        assert_eq!(state.active_sessions.len(), 10);
    }
}
