use std::time::Duration;

use rust_mcp_server::shared::state::{AppState, MetricValue, ToolCall};
use tokio::time::sleep;

async fn setup_test_state() -> AppState {
    let state = AppState::new();

    // Add some mock data
    let tool_call = ToolCall::new(
        "test_tool".to_string(),
        serde_json::json!({"param": "value"}),
    );
    state.add_tool_call(tool_call).await;

    state.update_metric("test_metric", MetricValue::Counter(42));
    state.update_metric(
        "duration_metric",
        MetricValue::Histogram(vec![1.0, 2.0, 3.0]),
    );

    state
}

#[tokio::test]
async fn test_dashboard_state_integration() {
    let state = setup_test_state().await;

    // Test that we can retrieve tool calls
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 1);
    assert_eq!(tool_calls[0].name, "test_tool");

    // Test that we can retrieve metrics
    let metrics = state.get_metrics().await;
    assert_eq!(metrics.len(), 2);
    assert!(metrics.contains_key("test_metric"));
    assert!(metrics.contains_key("duration_metric"));

    // Test that metrics have correct values
    assert_eq!(metrics["test_metric"].as_number(), 42.0);
    assert_eq!(metrics["duration_metric"].as_number(), 3.0); // Last value in histogram
}

#[tokio::test]
async fn test_dashboard_concurrent_access() {
    let state = AppState::new();

    // Simulate concurrent dashboard and tool activity
    let mut handles = Vec::new();

    // Spawn tasks that add tool calls (simulating tool execution)
    for i in 0..5 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            for j in 0..3 {
                let tool_call = ToolCall::new(
                    format!("tool_{i}_{j}"),
                    serde_json::json!({"task": i, "iteration": j}),
                );
                state_clone.add_tool_call(tool_call).await;

                // Add some delay to simulate real work
                sleep(Duration::from_millis(10)).await;
            }
        });
        handles.push(handle);
    }

    // Spawn tasks that read state (simulating dashboard requests)
    for _i in 0..3 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            for _ in 0..10 {
                let _ = state_clone.get_tool_calls(10).await;
                let _ = state_clone.get_metrics().await;
                sleep(Duration::from_millis(5)).await;
            }
        });
        handles.push(handle);
    }

    // Wait for all tasks to complete
    for handle in handles {
        handle.await.unwrap();
    }

    // Verify all tool calls were recorded
    let tool_calls = state.get_tool_calls(20).await; // Increase limit to get all 15 calls
    assert_eq!(tool_calls.len(), 15); // 5 tasks × 3 iterations each

    // Verify all tool calls have unique IDs
    let mut ids = std::collections::HashSet::new();
    for call in &tool_calls {
        assert!(ids.insert(call.id));
    }
}

#[tokio::test]
async fn test_dashboard_event_streaming() {
    let state = AppState::new();

    // Subscribe to events
    let mut event_rx = state.subscribe_to_events();

    // Spawn a task that simulates tool execution
    let state_clone = state.clone();
    let producer = tokio::spawn(async move {
        for i in 0..3 {
            let tool_call = ToolCall::new(
                format!("streaming_tool_{i}"),
                serde_json::json!({"index": i}),
            );
            state_clone.record_tool_call(tool_call).await.unwrap();
            sleep(Duration::from_millis(20)).await;
        }
    });

    // Consume events with timeout
    let mut events_received = 0;
    let consumer = tokio::spawn(async move {
        let timeout = Duration::from_secs(2);
        while events_received < 3 {
            match tokio::time::timeout(timeout, event_rx.recv()).await {
                Ok(Ok(_event)) => {
                    events_received += 1;
                }
                Ok(Err(_)) => break, // Channel closed
                Err(_) => break,     // Timeout
            }
        }
        events_received
    });

    // Wait for both tasks
    let _ = producer.await;
    let received_count = consumer.await.unwrap();

    // Verify we received the expected number of events
    assert_eq!(received_count, 3);

    // Verify all tool calls were recorded
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 3);
}

#[tokio::test]
async fn test_dashboard_metrics_aggregation() {
    let state = AppState::new();

    // Add various metrics
    state.update_metric("requests_total", MetricValue::Counter(100));
    state.update_metric("success_rate", MetricValue::Gauge(95.5));
    state.update_metric(
        "response_times",
        MetricValue::Histogram(vec![10.0, 20.0, 15.0, 30.0, 25.0]),
    );

    // Test that we can retrieve and analyze metrics
    let metrics = state.get_metrics().await;
    assert_eq!(metrics.len(), 3);

    // Test counter
    assert_eq!(metrics["requests_total"].as_number(), 100.0);

    // Test gauge
    assert_eq!(metrics["success_rate"].as_number(), 95.5);

    // Test histogram (returns last value)
    assert_eq!(metrics["response_times"].as_number(), 25.0);

    // Test specific metric types
    match &metrics["requests_total"] {
        MetricValue::Counter(value) => assert_eq!(*value, 100),
        _ => panic!("Expected counter metric"),
    }

    match &metrics["success_rate"] {
        MetricValue::Gauge(value) => assert_eq!(*value, 95.5),
        _ => panic!("Expected gauge metric"),
    }

    match &metrics["response_times"] {
        MetricValue::Histogram(values) => {
            assert_eq!(values.len(), 5);
            assert_eq!(values[0], 10.0);
            assert_eq!(values[4], 25.0);
        }
        _ => panic!("Expected histogram metric"),
    }
}

#[tokio::test]
async fn test_dashboard_session_tracking() {
    let state = AppState::new();

    // Create multiple sessions
    let mut session_ids = Vec::new();
    for _i in 0..3 {
        let session = rust_mcp_server::shared::state::SessionInfo::new();
        let session_id = session.id;
        session_ids.push(session_id);
        state.active_sessions.insert(session_id, session);
    }

    // Verify sessions are tracked
    assert_eq!(state.active_sessions.len(), 3);

    // Simulate session activity
    for (i, session_id) in session_ids.iter().enumerate() {
        let mut session = state.active_sessions.get_mut(session_id).unwrap();
        for _ in 0..=i {
            session.update_activity();
        }
    }

    // Verify session activity was recorded
    for (i, session_id) in session_ids.iter().enumerate() {
        let session = state.active_sessions.get(session_id).unwrap();
        assert_eq!(session.request_count, i as u64 + 1);
    }

    // Clean up sessions
    for session_id in session_ids {
        state.active_sessions.remove(&session_id);
    }

    assert_eq!(state.active_sessions.len(), 0);
}

#[tokio::test]
async fn test_dashboard_error_resilience() {
    let state = AppState::new();

    // Test that the system handles various error conditions gracefully

    // Test with malformed tool calls
    let bad_tool_call = ToolCall::new(
        "".to_string(),          // Empty name
        serde_json::json!(null), // Null arguments
    );
    state.add_tool_call(bad_tool_call).await;

    // Test with extreme metric values
    state.update_metric("huge_counter", MetricValue::Counter(u64::MAX));
    state.update_metric("negative_gauge", MetricValue::Gauge(-999999.0));
    state.update_metric("empty_histogram", MetricValue::Histogram(vec![]));

    // Verify system still functions
    let tool_calls = state.get_tool_calls(10).await;
    assert_eq!(tool_calls.len(), 1);

    let metrics = state.get_metrics().await;
    assert_eq!(metrics.len(), 3);

    // Test that empty histogram returns 0
    assert_eq!(metrics["empty_histogram"].as_number(), 0.0);
}

#[tokio::test]
async fn test_dashboard_scalability() {
    let state = AppState::new();

    // Test with a large number of tool calls
    let num_calls = 1000;
    let mut handles = Vec::new();

    for i in 0..num_calls {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            let tool_call =
                ToolCall::new(format!("scale_test_{i}"), serde_json::json!({"index": i}));
            state_clone.add_tool_call(tool_call).await;
        });
        handles.push(handle);
    }

    // Wait for all calls to complete
    for handle in handles {
        handle.await.unwrap();
    }

    // Verify all calls were recorded
    let tool_calls = state.get_tool_calls(num_calls).await; // Use num_calls as limit to get all calls
    assert_eq!(tool_calls.len(), num_calls);

    // Verify performance is reasonable (should complete quickly)
    let start = std::time::Instant::now();
    let _ = state.get_tool_calls(10).await;
    let elapsed = start.elapsed();
    assert!(
        elapsed < Duration::from_millis(100),
        "Reading tool calls took too long: {elapsed:?}",
    );

    // Test metrics scaling
    for i in 0..100 {
        state.update_metric(&format!("metric_{i}"), MetricValue::Counter(i as u64));
    }

    let metrics = state.get_metrics().await;
    assert_eq!(metrics.len(), 100);
}
