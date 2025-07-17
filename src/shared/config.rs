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
    pub websocket_allowed_origins: Vec<String>,
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
    pub hot_reload_debounce_ms: u64,
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
                websocket_allowed_origins: vec![
                    "http://localhost:8080".to_string(),
                    "http://127.0.0.1:8080".to_string(),
                ],
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
                hot_reload_debounce_ms: 500,
            },
        }
    }
}

impl Config {
    pub fn from_env() -> Result<Self, crate::server::error::McpServerError> {
        let mut config = Self::default();

        // Validate critical environment variables first
        Self::validate_env_vars()?;

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

        if let Ok(origins) = env::var("WEBSOCKET_ALLOWED_ORIGINS") {
            config.security.websocket_allowed_origins =
                origins.split(',').map(|s| s.trim().to_string()).collect();
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

        if let Ok(debounce) = env::var("HOT_RELOAD_DEBOUNCE_MS") {
            config.development.hot_reload_debounce_ms = debounce.parse().map_err(|_| {
                crate::server::error::McpServerError::Config(
                    "Invalid HOT_RELOAD_DEBOUNCE_MS".to_string(),
                )
            })?;
        }

        Ok(config)
    }

    /// Validate critical environment variables before parsing
    fn validate_env_vars() -> Result<(), crate::server::error::McpServerError> {
        // Validate port format if set
        if let Ok(port_str) = env::var("DASHBOARD_PORT") {
            if port_str.parse::<u16>().is_err() {
                return Err(crate::server::error::McpServerError::Config(
                    "DASHBOARD_PORT must be a valid port number (1-65535)".to_string(),
                ));
            }
        }

        // Validate host format if set
        if let Ok(host) = env::var("DASHBOARD_HOST") {
            if host.is_empty() {
                return Err(crate::server::error::McpServerError::Config(
                    "DASHBOARD_HOST cannot be empty".to_string(),
                ));
            }
            // Basic IP/hostname validation
            if !Self::is_valid_host(&host) {
                return Err(crate::server::error::McpServerError::Config(format!(
                    "DASHBOARD_HOST '{host}' is not a valid host format"
                )));
            }
        }

        // Validate numeric environment variables
        Self::validate_numeric_env("MAX_TOOL_EXECUTION_TIME_MS", 1000, 600000)?;
        Self::validate_numeric_env("MAX_CONCURRENT_TOOL_CALLS", 1, 100)?;
        Self::validate_numeric_env("MAX_FILE_SIZE_BYTES", 1024, 100 * 1024 * 1024)?;
        Self::validate_numeric_env("RATE_LIMIT_REQUESTS_PER_MINUTE", 1, 10000)?;
        Self::validate_numeric_env("RATE_LIMIT_BURST_SIZE", 1, 1000)?;
        Self::validate_numeric_env("MAX_HTTP_RESPONSE_SIZE_BYTES", 1024, 50 * 1024 * 1024)?;
        Self::validate_numeric_env("HTTP_TIMEOUT_SECONDS", 1, 300)?;

        // Validate boolean environment variables
        Self::validate_boolean_env("ENABLE_CORS")?;
        Self::validate_boolean_env("ENABLE_DEBUG_ROUTES")?;

        // Validate hot reload debounce timing
        Self::validate_numeric_env("HOT_RELOAD_DEBOUNCE_MS", 50, 5000)?;

        Ok(())
    }

    /// Validate numeric environment variable within range
    fn validate_numeric_env(
        var_name: &str,
        min: u64,
        max: u64,
    ) -> Result<(), crate::server::error::McpServerError> {
        if let Ok(value_str) = env::var(var_name) {
            match value_str.parse::<u64>() {
                Ok(value) => {
                    if value < min || value > max {
                        return Err(crate::server::error::McpServerError::Config(format!(
                            "{var_name} must be between {min} and {max}, got {value}"
                        )));
                    }
                }
                Err(_) => {
                    return Err(crate::server::error::McpServerError::Config(format!(
                        "{var_name} must be a valid number"
                    )));
                }
            }
        }
        Ok(())
    }

    /// Validate boolean environment variable
    fn validate_boolean_env(var_name: &str) -> Result<(), crate::server::error::McpServerError> {
        if let Ok(value_str) = env::var(var_name) {
            if value_str.parse::<bool>().is_err() {
                return Err(crate::server::error::McpServerError::Config(format!(
                    "{var_name} must be 'true' or 'false'"
                )));
            }
        }
        Ok(())
    }

    /// Basic host validation (IP address or hostname)
    fn is_valid_host(host: &str) -> bool {
        // Allow localhost variations
        if host == "localhost" || host == "0.0.0.0" || host == "127.0.0.1" || host == "::1" {
            return true;
        }

        // Basic IPv4 validation
        if let Ok(addr) = host.parse::<std::net::Ipv4Addr>() {
            return !addr.is_unspecified();
        }

        // Basic IPv6 validation
        if host.parse::<std::net::Ipv6Addr>().is_ok() {
            return true;
        }

        // Basic hostname validation (simplified)
        if host.len() > 253 {
            return false;
        }

        host.chars()
            .all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == '_')
    }

    pub fn validate(&self) -> Result<(), crate::server::error::McpServerError> {
        // Validate port range
        if self.server.dashboard_port == 0 {
            return Err(crate::server::error::McpServerError::Config(
                "Dashboard port must be between 1 and 65535".to_string(),
            ));
        }

        // Production hardening checks
        self.validate_production_hardening()?;

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

    /// Production hardening validation
    fn validate_production_hardening(&self) -> Result<(), crate::server::error::McpServerError> {
        // Check for insecure configurations in production
        if !self.is_development_mode() {
            // Warn about insecure CORS settings
            if self.development.enable_cors {
                eprintln!(
                    "WARNING: CORS is enabled in production mode. This may pose security risks."
                );
            }

            // Warn about debug routes in production
            if self.development.enable_debug_routes {
                return Err(crate::server::error::McpServerError::Config(
                    "Debug routes cannot be enabled in production mode".to_string(),
                ));
            }

            // Warn about binding to all interfaces in production
            if self.server.dashboard_host == "0.0.0.0" {
                eprintln!("WARNING: Server is binding to all interfaces (0.0.0.0) in production. Consider using a specific IP.");
            }

            // Ensure reasonable security limits in production
            if self.security.max_tool_execution_time_ms > 60000 {
                eprintln!("WARNING: Tool execution timeout is set to {}ms, which may be too high for production", 
                         self.security.max_tool_execution_time_ms);
            }

            if self.security.max_concurrent_tool_calls > 20 {
                eprintln!("WARNING: Max concurrent tool calls is set to {}, which may be too high for production", 
                         self.security.max_concurrent_tool_calls);
            }

            if self.security.max_file_size_bytes > 50 * 1024 * 1024 {
                eprintln!("WARNING: Max file size is set to {} bytes, which may be too high for production", 
                         self.security.max_file_size_bytes);
            }

            // Validate rate limiting is reasonable
            if self.rate_limiting.requests_per_minute > 1000 {
                eprintln!(
                    "WARNING: Rate limit of {} requests per minute may be too high for production",
                    self.rate_limiting.requests_per_minute
                );
            }
        }

        Ok(())
    }

    /// Check if we're in development mode based on environment
    fn is_development_mode(&self) -> bool {
        // Check for common development indicators
        env::var("RUST_LOG").is_ok_and(|log| log.contains("debug") || log.contains("trace")) ||
        env::var("CARGO_PKG_VERSION").is_ok() || // Cargo sets this during build
        self.development.enable_debug_routes ||
        (self.development.enable_cors && self.server.dashboard_host == "0.0.0.0")
    }
}
