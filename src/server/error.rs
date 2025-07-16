use thiserror::Error;

// Allow dead_code: Comprehensive error type system for future functionality
// Many variants represent planned error conditions not yet implemented
#[allow(dead_code)]
#[derive(Error, Debug)]
pub enum McpServerError {
    #[error("File system operation failed: {0}")]
    FileSystem(#[from] std::io::Error),

    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    #[error("State management error: {0}")]
    State(String),

    #[error("Tool execution timeout")]
    Timeout,

    #[error("Permission denied: {0}")]
    Permission(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("File size limit exceeded: {limit} bytes")]
    FileSizeLimit { limit: u64 },

    #[error("Rate limit exceeded for {endpoint}")]
    RateLimit { endpoint: String },

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("System information error: {0}")]
    System(String),

    #[error("Resource not found: {0}")]
    ResourceNotFound(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Tool execution failed: {0}")]
    ToolExecution(String),

    #[error("Prompt not found: {name}")]
    PromptNotFound { name: String },

    #[error("Invalid arguments: {0}")]
    InvalidArguments(String),

    #[error("MCP protocol error: {0}")]
    Protocol(String),

    #[error("Authentication failed: {0}")]
    Authentication(String),

    #[error("Internal server error: {0}")]
    Internal(String),
}

// Allow dead_code: Structured error handling utilities for API responses and retry logic
// Provides error categorization, codes, and behavioral metadata
#[allow(dead_code)]
impl McpServerError {
    pub fn error_code(&self) -> &'static str {
        match self {
            McpServerError::FileSystem(_) => "FILESYSTEM_ERROR",
            McpServerError::Http(_) => "HTTP_ERROR",
            McpServerError::State(_) => "STATE_ERROR",
            McpServerError::Timeout => "TIMEOUT",
            McpServerError::Permission(_) => "PERMISSION_DENIED",
            McpServerError::InvalidPath(_) => "INVALID_PATH",
            McpServerError::FileSizeLimit { .. } => "FILE_SIZE_LIMIT",
            McpServerError::RateLimit { .. } => "RATE_LIMIT",
            McpServerError::Config(_) => "CONFIGURATION_ERROR",
            McpServerError::Serialization(_) => "SERIALIZATION_ERROR",
            McpServerError::System(_) => "SYSTEM_ERROR",
            McpServerError::ResourceNotFound(_) => "RESOURCE_NOT_FOUND",
            McpServerError::ToolNotFound(_) => "TOOL_NOT_FOUND",
            McpServerError::ToolExecution(_) => "TOOL_EXECUTION_FAILED",
            McpServerError::PromptNotFound { .. } => "PROMPT_NOT_FOUND",
            McpServerError::InvalidArguments(_) => "INVALID_ARGUMENTS",
            McpServerError::Protocol(_) => "PROTOCOL_ERROR",
            McpServerError::Authentication(_) => "AUTHENTICATION_ERROR",
            McpServerError::Internal(_) => "INTERNAL_ERROR",
        }
    }

    pub fn is_user_error(&self) -> bool {
        matches!(
            self,
            McpServerError::InvalidArguments(_)
                | McpServerError::ResourceNotFound(_)
                | McpServerError::PromptNotFound { .. }
                | McpServerError::ToolNotFound(_)
                | McpServerError::Authentication(_)
                | McpServerError::Permission(_)
                | McpServerError::InvalidPath(_)
                | McpServerError::FileSizeLimit { .. }
        )
    }

    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            McpServerError::Http(_)
                | McpServerError::Timeout
                | McpServerError::Internal(_)
                | McpServerError::RateLimit { .. }
        )
    }
}

// Note: MCP error conversion can be added when mcp_spec types are stabilized

pub type Result<T> = std::result::Result<T, McpServerError>;

#[macro_export]
macro_rules! ensure {
    ($cond:expr, $error:expr) => {
        if !$cond {
            return Err($error);
        }
    };
}
