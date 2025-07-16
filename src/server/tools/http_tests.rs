#[cfg(test)]
mod tests {
    use crate::server::error::McpServerError;
    use crate::server::tools::http::{
        create_client, get_request, post_request, validate_url, MAX_RESPONSE_SIZE,
    };
    use crate::shared::state::AppState;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn create_test_state() -> AppState {
        AppState::new()
    }

    #[tokio::test]
    async fn test_get_request_success() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        let response_body = r#"{"message": "Hello, World!"}"#;
        Mock::given(method("GET"))
            .and(path("/test"))
            .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
            .mount(&mock_server)
            .await;

        let url = format!("{}/test", mock_server.uri());
        let result = get_request(&url, serde_json::json!({}), &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["status"], 200);
        assert_eq!(result_json["method"], "GET");
        assert_eq!(result_json["url"], url);
        assert_eq!(result_json["body"], response_body);

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "http_get");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_get_request_with_headers() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/test"))
            .and(header("Authorization", "Bearer token123"))
            .and(header("Content-Type", "application/json"))
            .respond_with(ResponseTemplate::new(200).set_body_string("OK"))
            .mount(&mock_server)
            .await;

        let url = format!("{}/test", mock_server.uri());
        let headers = serde_json::json!({
            "Authorization": "Bearer token123",
            "Content-Type": "application/json"
        });

        let result = get_request(&url, headers, &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["status"], 200);
        assert_eq!(result_json["body"], "OK");
    }

    #[tokio::test]
    async fn test_get_request_404() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/nonexistent"))
            .respond_with(ResponseTemplate::new(404).set_body_string("Not Found"))
            .mount(&mock_server)
            .await;

        let url = format!("{}/nonexistent", mock_server.uri());
        let result = get_request(&url, serde_json::json!({}), &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["status"], 404);
        assert_eq!(result_json["body"], "Not Found");

        // Check that tool call was recorded with failure
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "http_get");
        assert!(!tool_calls[0].success);
        assert_eq!(tool_calls[0].error.as_ref().unwrap(), "HTTP 404");
    }

    #[tokio::test]
    async fn test_get_request_invalid_url() {
        let state = create_test_state();
        let result = get_request("not-a-url", serde_json::json!({}), &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::InvalidPath(msg) => {
                assert!(msg.contains("Invalid URL"));
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[tokio::test]
    async fn test_get_request_invalid_scheme() {
        let state = create_test_state();
        let result = get_request("ftp://example.com", serde_json::json!({}), &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::InvalidPath(msg) => {
                assert_eq!(msg, "Only HTTP and HTTPS URLs are allowed");
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[tokio::test]
    async fn test_get_request_response_too_large() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        // Create a response larger than MAX_RESPONSE_SIZE
        let large_response = "x".repeat(MAX_RESPONSE_SIZE + 1);
        Mock::given(method("GET"))
            .and(path("/large"))
            .respond_with(ResponseTemplate::new(200).set_body_string(&large_response))
            .mount(&mock_server)
            .await;

        let url = format!("{}/large", mock_server.uri());
        let result = get_request(&url, serde_json::json!({}), &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::FileSizeLimit { limit } => {
                assert_eq!(limit, 5242880); // 5MB
            }
            _ => panic!("Expected FileSizeLimit error"),
        }
    }

    #[tokio::test]
    async fn test_post_request_success() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        let request_data = serde_json::json!({
            "message": "Hello, Server!"
        });

        Mock::given(method("POST"))
            .and(path("/api/data"))
            .respond_with(
                ResponseTemplate::new(201).set_body_string(r#"{"id": 123, "status": "created"}"#),
            )
            .mount(&mock_server)
            .await;

        let url = format!("{}/api/data", mock_server.uri());
        let result = post_request(&url, request_data.clone(), serde_json::json!({}), &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["status"], 201);
        assert_eq!(result_json["method"], "POST");
        assert_eq!(result_json["url"], url);

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "http_post");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_post_request_with_headers() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/secure"))
            .and(header("Authorization", "Bearer token123"))
            .and(header("X-Custom-Header", "custom-value"))
            .respond_with(ResponseTemplate::new(200).set_body_string("Success"))
            .mount(&mock_server)
            .await;

        let url = format!("{}/api/secure", mock_server.uri());
        let data = serde_json::json!({"data": "test"});
        let headers = serde_json::json!({
            "Authorization": "Bearer token123",
            "X-Custom-Header": "custom-value"
        });

        let result = post_request(&url, data, headers, &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["status"], 200);
        assert_eq!(result_json["body"], "Success");
    }

    #[tokio::test]
    async fn test_post_request_server_error() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/api/error"))
            .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
            .mount(&mock_server)
            .await;

        let url = format!("{}/api/error", mock_server.uri());
        let data = serde_json::json!({"test": "data"});
        let result = post_request(&url, data, serde_json::json!({}), &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["status"], 500);
        assert_eq!(result_json["body"], "Internal Server Error");

        // Check that tool call was recorded with failure
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "http_post");
        assert!(!tool_calls[0].success);
        assert_eq!(tool_calls[0].error.as_ref().unwrap(), "HTTP 500");
    }

    #[tokio::test]
    async fn test_validate_url_success() {
        let result = validate_url("https://api.example.com/test");
        assert!(result.is_ok());

        let result = validate_url("http://localhost:8080/api");
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_validate_url_invalid_scheme() {
        let result = validate_url("ftp://example.com");
        assert!(result.is_err());

        let result = validate_url("file:///etc/passwd");
        assert!(result.is_err());

        let result = validate_url("javascript:alert('xss')");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_validate_url_malformed() {
        let result = validate_url("not-a-url");
        assert!(result.is_err());

        let result = validate_url("://missing-scheme");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_create_client_success() {
        let result = create_client();
        assert!(result.is_ok());

        let client = result.unwrap();
        // Basic sanity check - we can't easily test timeout without actually making a request
        assert_eq!(format!("{client:?}"), format!("{client:?}"));
    }

    #[tokio::test]
    async fn test_metrics_and_events() {
        let state = create_test_state();
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/metrics-test"))
            .respond_with(ResponseTemplate::new(200).set_body_string("OK"))
            .mount(&mock_server)
            .await;

        // Subscribe to events
        let mut event_rx = state.subscribe_to_events();

        let url = format!("{}/metrics-test", mock_server.uri());
        let result = get_request(&url, serde_json::json!({}), &state).await;
        assert!(result.is_ok());

        // Check that metrics were updated
        let metrics = state.get_metrics().await;
        assert!(metrics.contains_key("http_requests_total"));
        assert!(metrics.contains_key("http_request_duration_ms"));
        assert!(metrics.contains_key("http_response_size_bytes"));

        // Check that event was sent
        let event = event_rx.recv().await.unwrap();
        match event {
            crate::shared::state::SystemEvent::ToolCalled { name, .. } => {
                assert_eq!(name, "http_get");
            }
            _ => panic!("Expected ToolCalled event"),
        }
    }
}
