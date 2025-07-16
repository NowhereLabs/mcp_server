use crate::shared::state::AppState;
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
use std::{future::Future, pin::Pin};

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
        "A Rust MCP server providing filesystem, HTTP, and system tools with a web dashboard for monitoring.".to_string()
    }

    fn capabilities(&self) -> ServerCapabilities {
        CapabilitiesBuilder::new()
            .with_tools(false)
            .with_resources(false, false)
            .with_prompts(false)
            .build()
    }

    fn list_tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "filesystem".to_string(),
                description:
                    "Perform filesystem operations including reading, writing, and listing files"
                        .to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "operation": {
                            "type": "string",
                            "enum": ["read", "write", "list"],
                            "description": "The filesystem operation to perform"
                        },
                        "path": {
                            "type": "string",
                            "description": "File or directory path"
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write (required for write operation)"
                        }
                    },
                    "required": ["operation", "path"]
                }),
            },
            Tool {
                name: "http".to_string(),
                description: "Make HTTP requests (GET and POST) to external services".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "method": {
                            "type": "string",
                            "enum": ["GET", "POST"],
                            "description": "HTTP method to use"
                        },
                        "url": {
                            "type": "string",
                            "description": "URL to request"
                        },
                        "headers": {
                            "type": "object",
                            "description": "HTTP headers to include",
                            "additionalProperties": {"type": "string"}
                        },
                        "data": {
                            "type": "object",
                            "description": "JSON data to send (for POST requests)"
                        }
                    },
                    "required": ["method", "url"]
                }),
            },
            Tool {
                name: "system".to_string(),
                description:
                    "Get system information including CPU, memory, disk, network, and process data"
                        .to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "info_type": {
                            "type": "string",
                            "enum": ["cpu", "memory", "disk", "network", "processes", "all"],
                            "description": "Type of system information to retrieve"
                        }
                    },
                    "required": ["info_type"]
                }),
            },
        ]
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
                "filesystem" => {
                    let operation = arguments
                        .get("operation")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| {
                            ToolError::InvalidParameters("Missing operation".to_string())
                        })?;

                    let path = arguments
                        .get("path")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| ToolError::InvalidParameters("Missing path".to_string()))?;

                    match operation {
                        "read" => {
                            match crate::server::tools::filesystem::read_file(path, &state).await {
                                Ok(content) => Ok(vec![Content::Text(TextContent {
                                    text: content,
                                    annotations: None,
                                })]),
                                Err(e) => Err(ToolError::ExecutionError(e.to_string())),
                            }
                        }
                        "write" => {
                            let content = arguments
                                .get("content")
                                .and_then(|v| v.as_str())
                                .ok_or_else(|| {
                                    ToolError::InvalidParameters(
                                        "Missing content for write operation".to_string(),
                                    )
                                })?;

                            match crate::server::tools::filesystem::write_file(
                                path, content, &state,
                            )
                            .await
                            {
                                Ok(result) => Ok(vec![Content::Text(TextContent {
                                    text: result,
                                    annotations: None,
                                })]),
                                Err(e) => Err(ToolError::ExecutionError(e.to_string())),
                            }
                        }
                        "list" => {
                            match crate::server::tools::filesystem::list_directory(path, &state)
                                .await
                            {
                                Ok(result) => Ok(vec![Content::Text(TextContent {
                                    text: result,
                                    annotations: None,
                                })]),
                                Err(e) => Err(ToolError::ExecutionError(e.to_string())),
                            }
                        }
                        _ => Err(ToolError::InvalidParameters(format!(
                            "Unknown operation: {operation}"
                        ))),
                    }
                }
                "http" => {
                    let method = arguments
                        .get("method")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| {
                            ToolError::InvalidParameters("Missing method".to_string())
                        })?;

                    let url = arguments
                        .get("url")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| ToolError::InvalidParameters("Missing url".to_string()))?;

                    let headers = arguments
                        .get("headers")
                        .cloned()
                        .unwrap_or_else(|| serde_json::json!({}));

                    match method.to_uppercase().as_str() {
                        "GET" => {
                            match crate::server::tools::http::get_request(url, headers, &state)
                                .await
                            {
                                Ok(result) => Ok(vec![Content::Text(TextContent {
                                    text: result,
                                    annotations: None,
                                })]),
                                Err(e) => Err(ToolError::ExecutionError(e.to_string())),
                            }
                        }
                        "POST" => {
                            let data = arguments
                                .get("data")
                                .cloned()
                                .unwrap_or_else(|| serde_json::json!({}));

                            match crate::server::tools::http::post_request(
                                url, data, headers, &state,
                            )
                            .await
                            {
                                Ok(result) => Ok(vec![Content::Text(TextContent {
                                    text: result,
                                    annotations: None,
                                })]),
                                Err(e) => Err(ToolError::ExecutionError(e.to_string())),
                            }
                        }
                        _ => Err(ToolError::InvalidParameters(format!(
                            "Unsupported HTTP method: {method}"
                        ))),
                    }
                }
                "system" => {
                    let info_type = arguments
                        .get("info_type")
                        .and_then(|v| v.as_str())
                        .ok_or_else(|| {
                            ToolError::InvalidParameters("Missing info_type".to_string())
                        })?;

                    match crate::server::tools::system::get_system_info(info_type, &state).await {
                        Ok(result) => Ok(vec![Content::Text(TextContent {
                            text: result,
                            annotations: None,
                        })]),
                        Err(e) => Err(ToolError::ExecutionError(e.to_string())),
                    }
                }
                _ => Err(ToolError::InvalidParameters(format!(
                    "Unknown tool: {tool_name}"
                ))),
            }
        })
    }

    fn list_resources(&self) -> Vec<Resource> {
        vec![
            Resource {
                uri: "config://server".to_string(),
                name: "Server Configuration".to_string(),
                description: Some("Current server configuration and settings".to_string()),
                mime_type: "application/json".to_string(),
                annotations: None,
            },
            Resource {
                uri: "logs://server".to_string(),
                name: "Server Logs".to_string(),
                description: Some("Recent server log entries".to_string()),
                mime_type: "application/json".to_string(),
                annotations: None,
            },
        ]
    }

    fn read_resource(
        &self,
        uri: &str,
    ) -> Pin<Box<dyn Future<Output = Result<String, ResourceError>> + Send + 'static>> {
        let state = self.state.clone();
        let uri = uri.to_string();

        Box::pin(async move {
            match uri.as_str() {
                "config://server" => {
                    match crate::server::resources::config::get_server_status(&state).await {
                        Ok(config) => Ok(config),
                        Err(e) => Err(ResourceError::ExecutionError(e.to_string())),
                    }
                }
                "logs://server" => {
                    match crate::server::resources::logs::get_recent_logs(&state).await {
                        Ok(logs) => Ok(logs),
                        Err(e) => Err(ResourceError::ExecutionError(e.to_string())),
                    }
                }
                _ => Err(ResourceError::NotFound(format!(
                    "Resource not found: {uri}"
                ))),
            }
        })
    }

    fn list_prompts(&self) -> Vec<Prompt> {
        vec![Prompt {
            name: "debug".to_string(),
            description: Some("Generate debug information for troubleshooting".to_string()),
            arguments: None,
        }]
    }

    fn get_prompt(
        &self,
        name: &str,
    ) -> Pin<Box<dyn Future<Output = Result<String, PromptError>> + Send + 'static>> {
        let state = self.state.clone();
        let name = name.to_string();

        Box::pin(async move {
            match name.as_str() {
                "debug" => {
                    match crate::server::prompts::debug::generate_debug_info(true, true, &state)
                        .await
                    {
                        Ok(debug_info) => Ok(debug_info),
                        Err(e) => Err(PromptError::InternalError(e.to_string())),
                    }
                }
                _ => Err(PromptError::NotFound(format!("Prompt not found: {name}"))),
            }
        })
    }
}
