use std::env;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub security: SecurityConfig,
    pub rate_limiting: RateLimitingConfig,
    pub resource_limits: ResourceLimitsConfig,
    pub development: DevelopmentConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub dashboard_port: u16,
    pub dashboard_host: String,
    pub log_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub max_tool_execution_time_ms: u64,
    pub max_concurrent_tool_calls: usize,
    pub max_file_size_bytes: u64,
    pub allowed_file_extensions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitingConfig {
    pub requests_per_minute: u32,
    pub burst_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimitsConfig {
    pub max_http_response_size_bytes: u64,
    pub http_timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevelopmentConfig {
    pub enable_cors: bool,
    pub enable_debug_routes: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                dashboard_port: 8080,
                dashboard_host: "0.0.0.0".to_string(),
                log_level: "info".to_string(),
            },
            security: SecurityConfig {
                max_tool_execution_time_ms: 30000,
                max_concurrent_tool_calls: 10,
                max_file_size_bytes: 10 * 1024 * 1024, // 10MB
                allowed_file_extensions: vec!["txt", "json", "toml", "yaml", "yml", "md", "log"]
                    .into_iter()
                    .map(String::from)
                    .collect(),
            },
            rate_limiting: RateLimitingConfig {
                requests_per_minute: 60,
                burst_size: 10,
            },
            resource_limits: ResourceLimitsConfig {
                max_http_response_size_bytes: 5 * 1024 * 1024, // 5MB
                http_timeout_seconds: 30,
            },
            development: DevelopmentConfig {
                enable_cors: false,
                enable_debug_routes: false,
            },
        }
    }
}

impl Config {
    pub fn from_env() -> Result<Self, crate::server::error::McpServerError> {
        let mut config = Self::default();

        // Server configuration
        if let Ok(port) = env::var("DASHBOARD_PORT") {
            config.server.dashboard_port = port.parse().map_err(|_| {
                crate::server::error::McpServerError::Config("Invalid DASHBOARD_PORT".to_string())
            })?;
        }

        if let Ok(host) = env::var("DASHBOARD_HOST") {
            config.server.dashboard_host = host;
        }

        if let Ok(log_level) = env::var("RUST_LOG") {
            config.server.log_level = log_level;
        }

        // Security configuration
        if let Ok(timeout) = env::var("MAX_TOOL_EXECUTION_TIME_MS") {
            config.security.max_tool_execution_time_ms = timeout.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid MAX_TOOL_EXECUTION_TIME_MS".to_string(),
                )
            })?;
        }

        if let Ok(max_calls) = env::var("MAX_CONCURRENT_TOOL_CALLS") {
            config.security.max_concurrent_tool_calls = max_calls.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid MAX_CONCURRENT_TOOL_CALLS".to_string(),
                )
            })?;
        }

        if let Ok(max_size) = env::var("MAX_FILE_SIZE_BYTES") {
            config.security.max_file_size_bytes = max_size.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid MAX_FILE_SIZE_BYTES".to_string(),
                )
            })?;
        }

        if let Ok(extensions) = env::var("ALLOWED_FILE_EXTENSIONS") {
            config.security.allowed_file_extensions = extensions
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
        }

        // Rate limiting configuration
        if let Ok(rpm) = env::var("RATE_LIMIT_REQUESTS_PER_MINUTE") {
            config.rate_limiting.requests_per_minute = rpm.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid RATE_LIMIT_REQUESTS_PER_MINUTE".to_string(),
                )
            })?;
        }

        if let Ok(burst) = env::var("RATE_LIMIT_BURST_SIZE") {
            config.rate_limiting.burst_size = burst.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid RATE_LIMIT_BURST_SIZE".to_string(),
                )
            })?;
        }

        // Resource limits configuration
        if let Ok(max_size) = env::var("MAX_HTTP_RESPONSE_SIZE_BYTES") {
            config.resource_limits.max_http_response_size_bytes =
                max_size.parse().map_err(|_| {
                    crate::server::error::McpServerError::Config(
                        "Invalid MAX_HTTP_RESPONSE_SIZE_BYTES".to_string(),
                    )
                })?;
        }

        if let Ok(timeout) = env::var("HTTP_TIMEOUT_SECONDS") {
            config.resource_limits.http_timeout_seconds = timeout.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid HTTP_TIMEOUT_SECONDS".to_string(),
                )
            })?;
        }

        // Development configuration
        if let Ok(cors) = env::var("ENABLE_CORS") {
            config.development.enable_cors = cors.parse().map_err(|_| {
                crate::server::error::McpServerError::Config("Invalid ENABLE_CORS".to_string())
            })?;
        }

        if let Ok(debug) = env::var("ENABLE_DEBUG_ROUTES") {
            config.development.enable_debug_routes = debug.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid ENABLE_DEBUG_ROUTES".to_string(),
                )
            })?;
        }

        Ok(config)
    }

    pub fn validate(&self) -> Result<(), crate::server::error::McpServerError> {
        // Validate port range
        if self.server.dashboard_port == 0 {
            return Err(crate::server::error::McpServerError::Config(
                "Dashboard port must be between 1 and 65535".to_string(),
            ));
        }

        // Validate timeouts
        if self.security.max_tool_execution_time_ms == 0 {
            return Err(crate::server::error::McpServerError::Config(
                "Tool execution timeout must be greater than 0".to_string(),
            ));
        }

        if self.resource_limits.http_timeout_seconds == 0 {
            return Err(crate::server::error::McpServerError::Config(
                "HTTP timeout must be greater than 0".to_string(),
            ));
        }

        // Validate file size limits
        if self.security.max_file_size_bytes > 100 * 1024 * 1024 {
            // 100MB
            return Err(crate::server::error::McpServerError::Config(
                "Max file size cannot exceed 100MB".to_string(),
            ));
        }

        // Validate rate limiting
        if self.rate_limiting.requests_per_minute == 0 {
            return Err(crate::server::error::McpServerError::Config(
                "Rate limit requests per minute must be greater than 0".to_string(),
            ));
        }

        if self.rate_limiting.burst_size == 0 {
            return Err(crate::server::error::McpServerError::Config(
                "Rate limit burst size must be greater than 0".to_string(),
            ));
        }

        Ok(())
    }
}
