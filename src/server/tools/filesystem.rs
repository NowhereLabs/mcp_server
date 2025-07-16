use crate::server::error::{McpServerError, Result};
use crate::shared::state::{AppState, MetricValue, ToolCall};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tracing::{info, warn};
use uuid::Uuid;

pub const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB limit

pub fn validate_path(path: &str) -> Result<PathBuf> {
    let path = Path::new(path);

    // Canonicalize to prevent path traversal attacks
    let canonical = path
        .canonicalize()
        .map_err(|e| McpServerError::InvalidPath(format!("Cannot canonicalize path: {e}")))?;

    // Additional security checks can be added here
    // For example, restrict to specific directories

    Ok(canonical)
}

pub async fn read_file(path: &str, state: &AppState) -> Result<String> {
    let start_time = Instant::now();
    let tool_call_id = Uuid::new_v4();

    info!("Reading file: {}", path);

    let result = async {
        // Validate path
        let canonical_path = validate_path(path)?;

        // Check if file exists
        if !canonical_path.exists() {
            return Err(McpServerError::FileSystem(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "File not found",
            )));
        }

        // Check if it's a file (not a directory)
        if !canonical_path.is_file() {
            return Err(McpServerError::InvalidPath(
                "Path is not a file".to_string(),
            ));
        }

        // Check file size
        let metadata = fs::metadata(&canonical_path)?;
        if metadata.len() > MAX_FILE_SIZE {
            return Err(McpServerError::FileSizeLimit {
                limit: MAX_FILE_SIZE,
            });
        }

        // Read the file
        let content = fs::read_to_string(&canonical_path)?;

        Ok((content, canonical_path))
    }
    .await;

    let execution_time = start_time.elapsed();

    // Record tool call in state
    let tool_call = match &result {
        Ok((content, _)) => ToolCall {
            id: tool_call_id,
            name: "read_file".to_string(),
            tool_name: "read_file".to_string(),
            arguments: serde_json::json!({ "path": path }),
            result: Some(crate::shared::state::ToolCallResult::Success(
                serde_json::json!({ "content": content.clone(), "size": content.len() }),
            )),
            result_string: Some(format!("Read {} bytes", content.len())),
            execution_time,
            duration_ms: Some(execution_time.as_millis() as u64),
            timestamp: Utc::now(),
            success: true,
            error: None,
        },
        Err(e) => ToolCall {
            id: tool_call_id,
            name: "read_file".to_string(),
            tool_name: "read_file".to_string(),
            arguments: serde_json::json!({ "path": path }),
            result: Some(crate::shared::state::ToolCallResult::Error(e.to_string())),
            result_string: None,
            execution_time,
            duration_ms: Some(execution_time.as_millis() as u64),
            timestamp: Utc::now(),
            success: false,
            error: Some(e.to_string()),
        },
    };

    state.add_tool_call(tool_call).await;

    // Update metrics
    state.update_metric("file_reads_total", MetricValue::Counter(1));
    state.update_metric(
        "file_read_duration_ms",
        MetricValue::Histogram(vec![execution_time.as_millis() as f64]),
    );

    if let Ok((content, _)) = &result {
        state.update_metric(
            "file_read_bytes",
            MetricValue::Histogram(vec![content.len() as f64]),
        );
    }

    result.map(|(content, _)| content)
}

pub async fn write_file(path: &str, content: &str, state: &AppState) -> Result<String> {
    let start_time = Instant::now();
    let tool_call_id = Uuid::new_v4();

    info!("Writing file: {}", path);

    let result = async {
        // Validate path
        let canonical_path = validate_path(path).or_else(|_| {
            // If canonicalization fails, the file might not exist yet
            // Try to get the parent directory and validate it
            let path_buf = PathBuf::from(path);
            if let Some(parent) = path_buf.parent() {
                if parent.exists() {
                    Ok(path_buf)
                } else {
                    Err(McpServerError::InvalidPath(
                        "Parent directory does not exist".to_string(),
                    ))
                }
            } else {
                Err(McpServerError::InvalidPath("Invalid file path".to_string()))
            }
        })?;

        // Check content size
        if content.len() as u64 > MAX_FILE_SIZE {
            return Err(McpServerError::FileSizeLimit {
                limit: MAX_FILE_SIZE,
            });
        }

        // Create backup if file exists
        if canonical_path.exists() {
            let backup_path = canonical_path.with_extension("backup");
            if let Err(e) = fs::copy(&canonical_path, &backup_path) {
                warn!("Failed to create backup: {}", e);
            }
        }

        // Write the file atomically
        let temp_path = canonical_path.with_extension("tmp");
        fs::write(&temp_path, content)?;
        fs::rename(&temp_path, &canonical_path)?;

        Ok(canonical_path)
    }
    .await;

    let execution_time = start_time.elapsed();

    // Record tool call in state
    let tool_call = match &result {
        Ok(canonical_path) => ToolCall {
            id: tool_call_id,
            name: "write_file".to_string(),
            tool_name: "write_file".to_string(),
            arguments: serde_json::json!({ "path": path, "content_length": content.len() }),
            result: Some(crate::shared::state::ToolCallResult::Success(
                serde_json::json!({ "bytes_written": content.len(), "path": canonical_path.display().to_string() }),
            )),
            result_string: Some(format!("Wrote {} bytes", content.len())),
            execution_time,
            duration_ms: Some(execution_time.as_millis() as u64),
            timestamp: Utc::now(),
            success: true,
            error: None,
        },
        Err(e) => ToolCall {
            id: tool_call_id,
            name: "write_file".to_string(),
            tool_name: "write_file".to_string(),
            arguments: serde_json::json!({ "path": path, "content_length": content.len() }),
            result: Some(crate::shared::state::ToolCallResult::Error(e.to_string())),
            result_string: None,
            execution_time,
            duration_ms: Some(execution_time.as_millis() as u64),
            timestamp: Utc::now(),
            success: false,
            error: Some(e.to_string()),
        },
    };

    state.add_tool_call(tool_call).await;

    // Update metrics
    state.update_metric("file_writes_total", MetricValue::Counter(1));
    state.update_metric(
        "file_write_duration_ms",
        MetricValue::Histogram(vec![execution_time.as_millis() as f64]),
    );
    state.update_metric(
        "file_write_bytes",
        MetricValue::Histogram(vec![content.len() as f64]),
    );

    result.map(|canonical_path| {
        format!(
            "Successfully wrote {} bytes to {}",
            content.len(),
            canonical_path.display()
        )
    })
}

pub async fn list_directory(path: &str, state: &AppState) -> Result<String> {
    let start_time = Instant::now();
    let tool_call_id = Uuid::new_v4();

    info!("Listing directory: {}", path);

    let result = async {
        // Validate path
        let canonical_path = validate_path(path)?;

        // Check if it's a directory
        if !canonical_path.is_dir() {
            return Err(McpServerError::InvalidPath(
                "Path is not a directory".to_string(),
            ));
        }

        // Read directory contents
        let mut entries = Vec::new();
        let dir_entries = fs::read_dir(&canonical_path)?;

        for entry in dir_entries {
            let entry = entry?;
            let path = entry.path();
            let metadata = entry.metadata()?;

            let entry_info = serde_json::json!({
                "name": entry.file_name().to_string_lossy(),
                "path": path.display().to_string(),
                "is_file": metadata.is_file(),
                "is_dir": metadata.is_dir(),
                "size": metadata.len(),
                "modified": metadata.modified()
                    .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())
                    .unwrap_or(0)
            });

            entries.push(entry_info);
        }

        let result = serde_json::json!({
            "directory": canonical_path.display().to_string(),
            "entries": entries,
            "count": entries.len()
        });

        Ok((result, entries.len()))
    }
    .await;

    let execution_time = start_time.elapsed();

    // Record tool call in state
    let tool_call = match &result {
        Ok((_, entry_count)) => ToolCall {
            id: tool_call_id,
            name: "list_directory".to_string(),
            tool_name: "list_directory".to_string(),
            arguments: serde_json::json!({ "path": path }),
            result: Some(crate::shared::state::ToolCallResult::Success(
                serde_json::json!({ "entry_count": entry_count }),
            )),
            result_string: Some(format!("Listed {entry_count} entries")),
            execution_time,
            duration_ms: Some(execution_time.as_millis() as u64),
            timestamp: Utc::now(),
            success: true,
            error: None,
        },
        Err(e) => ToolCall {
            id: tool_call_id,
            name: "list_directory".to_string(),
            tool_name: "list_directory".to_string(),
            arguments: serde_json::json!({ "path": path }),
            result: Some(crate::shared::state::ToolCallResult::Error(e.to_string())),
            result_string: None,
            execution_time,
            duration_ms: Some(execution_time.as_millis() as u64),
            timestamp: Utc::now(),
            success: false,
            error: Some(e.to_string()),
        },
    };

    state.add_tool_call(tool_call).await;

    // Update metrics
    state.update_metric("directory_lists_total", MetricValue::Counter(1));
    state.update_metric(
        "directory_list_duration_ms",
        MetricValue::Histogram(vec![execution_time.as_millis() as f64]),
    );

    if let Ok((_, entry_count)) = &result {
        state.update_metric(
            "directory_entries_listed",
            MetricValue::Histogram(vec![*entry_count as f64]),
        );
    }

    result.map(|(result, _)| {
        serde_json::to_string_pretty(&result).unwrap_or_else(|_| "{}".to_string())
    })
}
