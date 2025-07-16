#[cfg(test)]
mod tests {
    use mcp_server::router::Router;
    use mcp_spec::{content::Content, handler::ToolError};
    use serde_json::json;

    use super::super::mcp_router::McpRouter;
    use crate::shared::state::AppState;

    #[tokio::test]
    async fn test_echo_tool() {
        let state = AppState::new();
        let router = McpRouter::new(state.clone());

        // Test echo tool with a simple message
        let result = router
            .call_tool("echo", json!({"message": "Hello, World!"}))
            .await;

        assert!(result.is_ok());
        let content = result.unwrap();
        assert_eq!(content.len(), 1);

        if let Content::Text(text_content) = &content[0] {
            assert_eq!(text_content.text, "Echo: Hello, World!");
        } else {
            panic!("Expected text content");
        }

        // Verify tool call was logged
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].name, "echo");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_echo_tool_missing_message() {
        let state = AppState::new();
        let router = McpRouter::new(state);

        // Test echo tool without message parameter
        let result = router.call_tool("echo", json!({})).await;

        assert!(result.is_err());
        if let Err(ToolError::InvalidParameters(msg)) = result {
            assert_eq!(msg, "Missing message");
        } else {
            panic!("Expected InvalidParameters error");
        }
    }

    #[tokio::test]
    async fn test_unknown_tool() {
        let state = AppState::new();
        let router = McpRouter::new(state);

        // Test calling a non-existent tool
        let result = router.call_tool("nonexistent", json!({})).await;

        assert!(result.is_err());
        if let Err(ToolError::InvalidParameters(msg)) = result {
            assert_eq!(msg, "Unknown tool: nonexistent");
        } else {
            panic!("Expected InvalidParameters error");
        }
    }

    #[tokio::test]
    async fn test_list_tools() {
        let state = AppState::new();
        let router = McpRouter::new(state);

        let tools = router.list_tools();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].name, "echo");
        assert_eq!(tools[0].description, "Echo back the provided message");
    }
}
