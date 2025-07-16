use crate::server::error::{McpServerError, Result};
use crate::shared::state::{AppState, MetricValue, SystemEvent, ToolCall, ToolCallResult};
use reqwest;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tracing::{info, warn};
use uuid::Uuid;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
pub const MAX_RESPONSE_SIZE: usize = 5 * 1024 * 1024; // 5MB limit

pub fn validate_url(url: &str) -> Result<reqwest::Url> {
    let parsed_url = reqwest::Url::parse(url)
        .map_err(|e| McpServerError::InvalidPath(format!("Invalid URL: {e}")))?;

    // Basic URL validation
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(McpServerError::InvalidPath(
            "Only HTTP and HTTPS URLs are allowed".to_string(),
        ));
    }

    // Additional URL restrictions can be added here
    // For example, block private IP ranges, localhost, etc.

    Ok(parsed_url)
}

pub fn create_client() -> Result<reqwest::Client> {
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(McpServerError::Http)?;

    Ok(client)
}

pub async fn get_request(
    url: &str,
    headers: serde_json::Value,
    state: &AppState,
) -> Result<String> {
    let start_time = Instant::now();
    let _tool_call_id = Uuid::new_v4();

    info!("Making HTTP GET request to: {}", url);

    // Validate URL
    let validated_url = validate_url(url)?;

    // Create client
    let client = create_client()?;

    // Build request
    let mut request = client.get(validated_url);

    // Add headers if provided
    if let Some(headers_obj) = headers.as_object() {
        for (key, value) in headers_obj {
            if let Some(value_str) = value.as_str() {
                request = request.header(key, value_str);
            }
        }
    }

    // Execute request
    let response = request.send().await.map_err(McpServerError::Http)?;

    let status = response.status();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let body = response.text().await.map_err(McpServerError::Http)?;

    // Check response size
    if body.len() > MAX_RESPONSE_SIZE {
        return Err(McpServerError::FileSizeLimit {
            limit: MAX_RESPONSE_SIZE as u64,
        });
    }

    let execution_time = start_time.elapsed();

    let result = serde_json::json!({
        "url": url,
        "method": "GET",
        "status": status.as_u16(),
        "status_text": status.canonical_reason().unwrap_or("Unknown"),
        "headers": response_headers,
        "body": body,
        "size": body.len(),
        "execution_time_ms": execution_time.as_millis()
    });

    // Record tool call in state
    let tool_call = ToolCall::new(
        "http_get".to_string(),
        serde_json::json!({ "url": url, "headers": headers }),
    )
    .complete(
        if status.is_success() {
            ToolCallResult::Success(result.clone())
        } else {
            ToolCallResult::Error(format!("HTTP {}", status.as_u16()))
        },
        execution_time.as_millis() as u64,
    );

    let tool_call_id = tool_call.id;
    state.add_tool_call(tool_call).await;

    // Update metrics
    state.update_metric("http_requests_total", MetricValue::Counter(1));
    state.update_metric(
        "http_request_duration_ms",
        MetricValue::Gauge(execution_time.as_millis() as f64),
    );
    state.update_metric(
        "http_response_size_bytes",
        MetricValue::Gauge(body.len() as f64),
    );

    // Send event
    let event = SystemEvent::ToolCalled {
        name: "http_get".to_string(),
        id: tool_call_id,
    };

    if let Err(e) = state.event_tx.send(event) {
        warn!("Failed to send event: {}", e);
    }

    Ok(serde_json::to_string_pretty(&result)?)
}

pub async fn post_request(
    url: &str,
    data: serde_json::Value,
    headers: serde_json::Value,
    state: &AppState,
) -> Result<String> {
    let start_time = Instant::now();
    let _tool_call_id = Uuid::new_v4();

    info!("Making HTTP POST request to: {}", url);

    // Validate URL
    let validated_url = validate_url(url)?;

    // Create client
    let client = create_client()?;

    // Build request
    let mut request = client.post(validated_url).json(&data);

    // Add headers if provided
    if let Some(headers_obj) = headers.as_object() {
        for (key, value) in headers_obj {
            if let Some(value_str) = value.as_str() {
                request = request.header(key, value_str);
            }
        }
    }

    // Execute request
    let response = request.send().await.map_err(McpServerError::Http)?;

    let status = response.status();
    let response_headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let body = response.text().await.map_err(McpServerError::Http)?;

    // Check response size
    if body.len() > MAX_RESPONSE_SIZE {
        return Err(McpServerError::FileSizeLimit {
            limit: MAX_RESPONSE_SIZE as u64,
        });
    }

    let execution_time = start_time.elapsed();

    let result = serde_json::json!({
        "url": url,
        "method": "POST",
        "status": status.as_u16(),
        "status_text": status.canonical_reason().unwrap_or("Unknown"),
        "headers": response_headers,
        "body": body,
        "size": body.len(),
        "execution_time_ms": execution_time.as_millis()
    });

    // Record tool call in state
    let tool_call = ToolCall::new(
        "http_post".to_string(),
        serde_json::json!({ "url": url, "data": data, "headers": headers }),
    )
    .complete(
        if status.is_success() {
            ToolCallResult::Success(result.clone())
        } else {
            ToolCallResult::Error(format!("HTTP {}", status.as_u16()))
        },
        execution_time.as_millis() as u64,
    );

    let tool_call_id = tool_call.id;
    state.add_tool_call(tool_call).await;

    // Update metrics
    state.update_metric("http_requests_total", MetricValue::Counter(1));
    state.update_metric(
        "http_request_duration_ms",
        MetricValue::Gauge(execution_time.as_millis() as f64),
    );
    state.update_metric(
        "http_response_size_bytes",
        MetricValue::Gauge(body.len() as f64),
    );

    // Send event
    let event = SystemEvent::ToolCalled {
        name: "http_post".to_string(),
        id: tool_call_id,
    };

    if let Err(e) = state.event_tx.send(event) {
        warn!("Failed to send event: {}", e);
    }

    Ok(serde_json::to_string_pretty(&result)?)
}
