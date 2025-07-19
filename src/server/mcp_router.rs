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
use crate::tools::{file_search::FileSearchTool, ToolRegistry};

#[derive(Clone)]
pub struct McpRouter {
    state: AppState,
    tool_registry: ToolRegistry,
}

impl McpRouter {
    pub fn new(state: AppState) -> Self {
        let mut tool_registry = ToolRegistry::new();

        // Register available tools
        tool_registry.register(FileSearchTool);

        Self {
            state,
            tool_registry,
        }
    }
}

impl Router for McpRouter {
    fn name(&self) -> String {
        "rust-mcp-dashboard".to_string()
    }

    fn instructions(&self) -> String {
        format!(
            "A high-performance Rust MCP server with real-time dashboard. Available tools: {}",
            self.tool_registry.tool_count()
        )
    }

    fn capabilities(&self) -> ServerCapabilities {
        CapabilitiesBuilder::new()
            .with_tools(true)
            .with_resources(false, false)
            .with_prompts(false)
            .build()
    }

    fn list_tools(&self) -> Vec<Tool> {
        self.tool_registry
            .list_tools()
            .into_iter()
            .map(|tool_info| Tool {
                name: tool_info.name,
                description: tool_info.description,
                input_schema: tool_info.input_schema,
            })
            .collect()
    }

    fn call_tool(
        &self,
        tool_name: &str,
        arguments: Value,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<Content>, ToolError>> + Send + 'static>> {
        let state = self.state.clone();
        let tool_registry = self.tool_registry.clone();
        let tool_name = tool_name.to_string();
        let arguments = arguments.clone();

        Box::pin(async move {
            let start_time = std::time::Instant::now();

            // Log the tool call start
            let tool_call =
                crate::shared::state::ToolCall::new(tool_name.clone(), arguments.clone());
            let _tool_call_id = tool_call.id;
            let _ = state.record_tool_call(tool_call).await;

            // Execute the tool
            match tool_registry.call_tool(&tool_name, arguments.clone()).await {
                Ok(result) => {
                    let duration = start_time.elapsed().as_millis() as u64;

                    // Update tool call with success
                    let completed_call =
                        crate::shared::state::ToolCall::new(tool_name.clone(), arguments.clone())
                            .complete(
                                crate::shared::state::ToolCallResult::Success(result.clone()),
                                duration,
                            );
                    let _ = state.record_tool_call(completed_call).await;

                    // Format result for MCP response
                    let result_text = match result {
                        Value::String(s) => s,
                        _ => serde_json::to_string_pretty(&result)
                            .unwrap_or_else(|_| "Tool executed successfully".to_string()),
                    };

                    Ok(vec![Content::Text(TextContent {
                        text: result_text,
                        annotations: None,
                    })])
                }
                Err(e) => {
                    let duration = start_time.elapsed().as_millis() as u64;

                    // Update tool call with error
                    let failed_call =
                        crate::shared::state::ToolCall::new(tool_name.clone(), arguments.clone())
                            .complete(
                                crate::shared::state::ToolCallResult::Error(e.to_string()),
                                duration,
                            );
                    let _ = state.record_tool_call(failed_call).await;

                    // Convert our tool error to MCP tool error
                    let mcp_error = match e {
                        crate::server::error::ToolError::InvalidInput(msg) => {
                            ToolError::InvalidParameters(msg)
                        }
                        crate::server::error::ToolError::ToolNotFound(msg) => {
                            ToolError::InvalidParameters(format!("Tool not found: {msg}"))
                        }
                        crate::server::error::ToolError::ExecutionError(msg) => {
                            ToolError::ExecutionError(msg)
                        }
                        crate::server::error::ToolError::SerializationError(msg) => {
                            ToolError::ExecutionError(format!("Serialization error: {msg}"))
                        }
                    };

                    Err(mcp_error)
                }
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
