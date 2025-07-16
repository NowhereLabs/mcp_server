use std::{future::Future, pin::Pin};

use mcp_server::router::{CapabilitiesBuilder, Router};
use mcp_spec::{
    content::{Content, TextContent},
    handler::{PromptError, ResourceError, ToolError},
    prompt::Prompt,
    protocol::ServerCapabilities,
    resource::Resource,
    tool::Tool,
};
use serde_json::Value;

use crate::shared::state::AppState;

#[derive(Clone)]
pub struct McpRouter {
    state: AppState,
}

impl McpRouter {
    pub fn new(state: AppState) -> Self {
        Self { state }
    }
}

impl Router for McpRouter {
    fn name(&self) -> String {
        "rust-mcp-dashboard".to_string()
    }

    fn instructions(&self) -> String {
        "A simple Rust MCP server with an echo tool for testing.".to_string()
    }

    fn capabilities(&self) -> ServerCapabilities {
        CapabilitiesBuilder::new()
            .with_tools(true)
            .with_resources(false, false)
            .with_prompts(false)
            .build()
    }

    fn list_tools(&self) -> Vec<Tool> {
        vec![Tool {
            name: "echo".to_string(),
            description: "Echo back the provided message".to_string(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "The message to echo back"
                    }
                },
                "required": ["message"]
            }),
        }]
    }

    fn call_tool(
        &self,
        tool_name: &str,
        arguments: Value,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<Content>, ToolError>> + Send + 'static>> {
        let state = self.state.clone();
        let tool_name = tool_name.to_string();

        Box::pin(async move {
            match tool_name.as_str() {
                "echo" => {
                    let message = arguments
                        .get("message")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| {
                            ToolError::InvalidParameters("Missing message".to_string())
                        })?;

                    // Log the tool call to shared state
                    let tool_call = crate::shared::state::ToolCall::new(
                        "echo".to_string(),
                        serde_json::json!({
                            "message": message
                        }),
                    )
                    .complete(
                        crate::shared::state::ToolCallResult::Success(serde_json::json!({
                            "echoed": message
                        })),
                        1,
                    );

                    let _ = state.record_tool_call(tool_call).await;

                    Ok(vec![Content::Text(TextContent {
                        text: format!("Echo: {message}"),
                        annotations: None,
                    })])
                }
                _ => Err(ToolError::InvalidParameters(format!(
                    "Unknown tool: {tool_name}"
                ))),
            }
        })
    }

    fn list_resources(&self) -> Vec<Resource> {
        vec![]
    }

    fn read_resource(
        &self,
        uri: &str,
    ) -> Pin<Box<dyn Future<Output = Result<String, ResourceError>> + Send + 'static>> {
        let uri = uri.to_string();
        Box::pin(async move {
            Err(ResourceError::NotFound(format!(
                "Resource not found: {uri}"
            )))
        })
    }

    fn list_prompts(&self) -> Vec<Prompt> {
        vec![]
    }

    fn get_prompt(
        &self,
        name: &str,
    ) -> Pin<Box<dyn Future<Output = Result<String, PromptError>> + Send + 'static>> {
        let name = name.to_string();
        Box::pin(async move { Err(PromptError::NotFound(format!("Prompt not found: {name}"))) })
    }
}
