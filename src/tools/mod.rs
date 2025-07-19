// Tools module for MCP tools with schema generation
// This module contains the trait definition and tool registry

use crate::server::error::ToolError;
use async_trait::async_trait;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

pub mod file_search;
pub mod schemas;

/// Trait for MCP tools that can generate their own schemas
#[async_trait]
pub trait McpTool: Send + Sync {
    type Input: JsonSchema + for<'de> Deserialize<'de> + Send;
    type Output: JsonSchema + Serialize + Send;

    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;

    async fn execute(&self, input: Self::Input) -> Result<Self::Output, ToolError>;

    /// Generate JSON schema for the tool's input
    fn input_schema(&self) -> serde_json::Value {
        let schema = schemars::schema_for!(Self::Input);
        serde_json::to_value(&schema).unwrap()
    }

    /// Generate JSON schema for the tool's output
    fn output_schema(&self) -> serde_json::Value {
        let schema = schemars::schema_for!(Self::Output);
        serde_json::to_value(&schema).unwrap()
    }
}

/// Trait for dynamic tool calling (type-erased)
#[async_trait]
pub trait DynamicTool: Send + Sync {
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
    fn input_schema(&self) -> serde_json::Value;
    fn output_schema(&self) -> serde_json::Value;
    async fn call(&self, input: Value) -> Result<Value, ToolError>;
}

/// Wrapper to make McpTool into DynamicTool
pub struct ToolWrapper<T: McpTool> {
    tool: T,
}

impl<T: McpTool> ToolWrapper<T> {
    pub fn new(tool: T) -> Self {
        Self { tool }
    }
}

#[async_trait]
impl<T: McpTool> DynamicTool for ToolWrapper<T> {
    fn name(&self) -> &'static str {
        self.tool.name()
    }

    fn description(&self) -> &'static str {
        self.tool.description()
    }

    fn input_schema(&self) -> serde_json::Value {
        self.tool.input_schema()
    }

    fn output_schema(&self) -> serde_json::Value {
        self.tool.output_schema()
    }

    async fn call(&self, input: Value) -> Result<Value, ToolError> {
        let typed_input: T::Input =
            serde_json::from_value(input).map_err(|e| ToolError::InvalidInput(e.to_string()))?;

        let result = self.tool.execute(typed_input).await?;

        serde_json::to_value(result).map_err(|e| ToolError::SerializationError(e.to_string()))
    }
}

/// Tool registry for managing MCP tools
#[derive(Clone)]
pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn DynamicTool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
        }
    }

    /// Register a tool
    pub fn register<T: McpTool + 'static>(&mut self, tool: T) {
        let name = tool.name().to_string();
        let wrapped = ToolWrapper::new(tool);
        self.tools.insert(name, Arc::new(wrapped));
    }

    /// Get all registered tools
    pub fn list_tools(&self) -> Vec<ToolInfo> {
        self.tools
            .values()
            .map(|tool| ToolInfo {
                name: tool.name().to_string(),
                description: tool.description().to_string(),
                input_schema: tool.input_schema(),
                output_schema: tool.output_schema(),
            })
            .collect()
    }

    /// Call a tool by name
    pub async fn call_tool(&self, name: &str, input: Value) -> Result<Value, ToolError> {
        let tool = self
            .tools
            .get(name)
            .ok_or_else(|| ToolError::ToolNotFound(name.to_string()))?;

        tool.call(input).await
    }

    /// Get tool count
    pub fn tool_count(&self) -> usize {
        self.tools.len()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Information about a tool for MCP listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInfo {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    pub output_schema: serde_json::Value,
}
