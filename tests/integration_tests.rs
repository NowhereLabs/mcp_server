use rust_mcp_server::shared::state::AppState;

#[tokio::test]
async fn test_basic_state_operations() {
    let state = AppState::new();

    // Test basic state creation - server starts connected now
    assert!(state.mcp_status.load().connected);
    assert_eq!(state.active_sessions.len(), 0);
    assert_eq!(state.tool_calls.read().await.len(), 0);

    // Test event subscription
    let mut rx = state.subscribe_to_events();

    // Test sending an event
    use rust_mcp_server::shared::state::SystemEvent;
    let event = SystemEvent::McpConnected;
    state.send_event(event).unwrap();

    // Verify event was received
    let received = rx.recv().await.unwrap();
    assert!(matches!(received, SystemEvent::McpConnected));
}

#[tokio::test]
async fn test_concurrent_tool_calls() {
    let state = AppState::new();
    let mut handles = Vec::new();

    // Spawn multiple concurrent tool calls
    for i in 0..5 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let tool_call = rust_mcp_server::shared::state::ToolCall::new(
                format!("test_tool_{i}"),
                serde_json::json!({"test": i}),
            );
            state_clone.add_tool_call(tool_call).await;
        });
        handles.push(handle);
    }

    // Wait for all to complete
    for handle in handles {
        handle.await.unwrap();
    }

    // Verify all tool calls were recorded
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 5);

    // Verify they have unique IDs
    let mut ids = std::collections::HashSet::new();
    for call in &tool_calls {
        assert!(ids.insert(call.id));
    }
}

#[tokio::test]
async fn test_metrics_collection() {
    let state = AppState::new();

    // Add some metrics
    state.update_metric(
        "test_counter",
        rust_mcp_server::shared::state::MetricValue::Counter(1),
    );
    state.update_metric(
        "test_gauge",
        rust_mcp_server::shared::state::MetricValue::Gauge(42.0),
    );
    state.update_metric(
        "test_histogram",
        rust_mcp_server::shared::state::MetricValue::Histogram(vec![1.0, 2.0, 3.0]),
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
    assert_eq!(metrics["test_histogram"].as_number(), 3.0);
}

#[tokio::test]
async fn test_session_management() {
    let state = AppState::new();

    // Create and add a session
    let session = rust_mcp_server::shared::state::SessionInfo::new();
    let session_id = session.id;
    state.active_sessions.insert(session_id, session);

    // Verify session exists
    assert_eq!(state.active_sessions.len(), 1);
    assert!(state.active_sessions.contains_key(&session_id));

    // Update session activity
    {
        let mut session_ref = state.active_sessions.get_mut(&session_id).unwrap();
        session_ref.update_activity();
        assert_eq!(session_ref.request_count, 1);
    }

    // Remove session
    state.active_sessions.remove(&session_id);
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
    state
        .mcp_status
        .store(std::sync::Arc::new(new_status.clone()));

    // Verify status was updated
    let current_status = state.mcp_status.load();
    assert!(current_status.connected);
    assert_eq!(current_status.server_info.name, "test-server");
    assert_eq!(current_status.server_info.version, "1.0.0");
    assert_eq!(current_status.capabilities.len(), 2);
}
