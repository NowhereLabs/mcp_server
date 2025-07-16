use rust_mcp_server::shared::state::{AppState, MetricValue, SystemEvent, ToolCall};

#[tokio::test]
async fn test_state_management() {
    let state = AppState::new();

    // Test basic state creation - server starts connected now
    assert!(state.mcp_status.load().connected);
    assert_eq!(state.active_sessions.len(), 0);
    assert_eq!(state.tool_calls.read().await.len(), 0);
}

#[tokio::test]
async fn test_tool_call_recording() {
    let state = AppState::new();

    // Create a tool call
    let tool_call = ToolCall::new("test_tool".to_string(), serde_json::json!({"arg": "value"}));

    // Record it
    state.add_tool_call(tool_call).await;

    // Verify it was recorded
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 1);
    assert_eq!(tool_calls[0].name, "test_tool");
    assert_eq!(tool_calls[0].tool_name, "test_tool");
}

#[tokio::test]
async fn test_event_broadcasting() {
    let state = AppState::new();
    let mut rx = state.subscribe_to_events();

    // Send an event
    let event = SystemEvent::McpConnected;
    state.send_event(event).unwrap();

    // Verify event was received
    let received = rx.recv().await.unwrap();
    assert!(matches!(received, SystemEvent::McpConnected));
}

#[tokio::test]
async fn test_metrics_collection() {
    let state = AppState::new();

    // Add some metrics
    state.update_metric("test_counter", MetricValue::Counter(1));
    state.update_metric("test_gauge", MetricValue::Gauge(42.0));
    state.update_metric(
        "test_histogram",
        MetricValue::Histogram(vec![1.0, 2.0, 3.0]),
    );

    // Retrieve metrics
    let metrics = state.get_metrics().await;
    assert_eq!(metrics.len(), 3);

    assert!(metrics.contains_key("test_counter"));
    assert!(metrics.contains_key("test_gauge"));
    assert!(metrics.contains_key("test_histogram"));

    // Verify metric values
    assert_eq!(metrics["test_counter"].as_number(), 1.0);
    assert_eq!(metrics["test_gauge"].as_number(), 42.0);
    assert_eq!(metrics["test_histogram"].as_number(), 3.0); // Last value in histogram
}

#[tokio::test]
async fn test_concurrent_operations() {
    let state = AppState::new();

    // Spawn multiple tasks that modify state concurrently
    let mut handles = Vec::new();
    for i in 0..10 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let tool_call = ToolCall::new(format!("tool_{i}"), serde_json::json!({"id": i}));
            state_clone.add_tool_call(tool_call).await;

            // Also update a metric
            state_clone.update_metric(&format!("counter_{i}"), MetricValue::Counter(i as u64));
        });
        handles.push(handle);
    }

    // Wait for all tasks to complete
    for handle in handles {
        handle.await.unwrap();
    }

    // Verify all operations completed
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 10);

    let metrics = state.get_metrics().await;
    assert_eq!(metrics.len(), 10);

    // Verify all tool calls have unique IDs
    let mut ids = std::collections::HashSet::new();
    for call in &tool_calls {
        assert!(ids.insert(call.id));
    }
}

#[tokio::test]
async fn test_session_management() {
    let state = AppState::new();

    // Create and add sessions
    let session1 = rust_mcp_server::shared::state::SessionInfo::new();
    let session2 = rust_mcp_server::shared::state::SessionInfo::new();
    let session1_id = session1.id;
    let session2_id = session2.id;

    state.active_sessions.insert(session1_id, session1);
    state.active_sessions.insert(session2_id, session2);

    // Verify sessions exist
    assert_eq!(state.active_sessions.len(), 2);
    assert!(state.active_sessions.contains_key(&session1_id));
    assert!(state.active_sessions.contains_key(&session2_id));

    // Update session activity
    {
        let mut session_ref = state.active_sessions.get_mut(&session1_id).unwrap();
        session_ref.update_activity();
        assert_eq!(session_ref.request_count, 1);
    }

    // Remove sessions
    state.active_sessions.remove(&session1_id);
    state.active_sessions.remove(&session2_id);
    assert_eq!(state.active_sessions.len(), 0);
}

#[tokio::test]
async fn test_mcp_status_updates() {
    let state = AppState::new();

    // Create new status
    let new_status = rust_mcp_server::shared::state::McpStatus {
        connected: true,
        started_at: chrono::Utc::now(),
        last_heartbeat: Some(chrono::Utc::now()),
        capabilities: vec!["tools".to_string(), "resources".to_string()],
        server_info: rust_mcp_server::shared::state::ServerInfo {
            name: "test-server".to_string(),
            version: "1.0.0".to_string(),
        },
    };

    // Update status
    state.mcp_status.store(std::sync::Arc::new(new_status));

    // Verify status was updated
    let current_status = state.mcp_status.load();
    assert!(current_status.connected);
    assert_eq!(current_status.server_info.name, "test-server");
    assert_eq!(current_status.server_info.version, "1.0.0");
    assert_eq!(current_status.capabilities.len(), 2);
}

#[tokio::test]
async fn test_tool_call_lifecycle() {
    let state = AppState::new();

    // Create a basic tool call
    let tool_call = ToolCall::new(
        "test_tool".to_string(),
        serde_json::json!({"param": "value"}),
    );

    // Verify initial state
    assert_eq!(tool_call.name, "test_tool");
    assert_eq!(tool_call.tool_name, "test_tool");
    assert!(!tool_call.success);
    assert!(tool_call.error.is_none());
    assert!(tool_call.result.is_none());

    // Complete the tool call
    let completed_call = tool_call.complete(
        rust_mcp_server::shared::state::ToolCallResult::Success(
            serde_json::json!({"result": "success"}),
        ),
        150, // 150ms duration
    );

    // Verify completed state
    assert!(completed_call.success);
    assert!(completed_call.error.is_none());
    assert!(completed_call.result.is_some());
    assert_eq!(completed_call.duration_ms, Some(150));

    // Record the completed call
    state.add_tool_call(completed_call).await;

    // Verify it was recorded
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 1);
    assert!(tool_calls[0].success);
}

#[tokio::test]
async fn test_error_handling() {
    let state = AppState::new();

    // Create a failed tool call
    let failed_call = ToolCall::new(
        "failing_tool".to_string(),
        serde_json::json!({"invalid": "params"}),
    )
    .complete(
        rust_mcp_server::shared::state::ToolCallResult::Error("Tool execution failed".to_string()),
        200, // 200ms duration
    );

    // Verify error state
    assert!(!failed_call.success);
    assert!(failed_call.error.is_some());
    assert_eq!(failed_call.error.as_ref().unwrap(), "Tool execution failed");

    // Record the failed call
    state.add_tool_call(failed_call).await;

    // Verify it was recorded
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 1);
    assert!(!tool_calls[0].success);
    assert!(tool_calls[0].error.is_some());
}
