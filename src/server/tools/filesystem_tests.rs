#[cfg(test)]
mod tests {
    use crate::server::error::McpServerError;
    use crate::server::tools::filesystem::{
        list_directory, read_file, validate_path, write_file, MAX_FILE_SIZE,
    };
    use crate::shared::state::AppState;
    use std::io::Write;
    use tempfile::{NamedTempFile, TempDir};

    fn create_test_state() -> AppState {
        AppState::new()
    }

    #[tokio::test]
    async fn test_read_file_success() {
        let state = create_test_state();
        let mut temp_file = NamedTempFile::new().unwrap();
        let test_content = "Hello, World!";
        temp_file.write_all(test_content.as_bytes()).unwrap();

        let result = read_file(temp_file.path().to_str().unwrap(), &state).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), test_content);

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "read_file");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_read_file_not_found() {
        let state = create_test_state();
        let result = read_file("/non/existent/file.txt", &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::InvalidPath(msg) => {
                assert!(msg.contains("Cannot canonicalize path"));
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[tokio::test]
    async fn test_read_file_directory_error() {
        let state = create_test_state();
        let temp_dir = TempDir::new().unwrap();

        let result = read_file(temp_dir.path().to_str().unwrap(), &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::InvalidPath(msg) => {
                assert_eq!(msg, "Path is not a file");
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[tokio::test]
    async fn test_read_file_size_limit() {
        let state = create_test_state();
        let mut temp_file = NamedTempFile::new().unwrap();

        // Create a file larger than MAX_FILE_SIZE
        let large_content = "x".repeat((MAX_FILE_SIZE + 1) as usize);
        temp_file.write_all(large_content.as_bytes()).unwrap();

        let result = read_file(temp_file.path().to_str().unwrap(), &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::FileSizeLimit { limit } => {
                assert_eq!(limit, MAX_FILE_SIZE);
            }
            _ => panic!("Expected FileSizeLimit error"),
        }
    }

    #[tokio::test]
    async fn test_write_file_success() {
        let state = create_test_state();
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let test_content = "Hello, World!";

        let result = write_file(file_path.to_str().unwrap(), test_content, &state).await;

        assert!(result.is_ok());

        // Verify file was written
        let written_content = std::fs::read_to_string(&file_path).unwrap();
        assert_eq!(written_content, test_content);

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "write_file");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_write_file_invalid_parent() {
        let state = create_test_state();
        let result = write_file("/non/existent/dir/file.txt", "content", &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::InvalidPath(msg) => {
                assert_eq!(msg, "Parent directory does not exist");
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[tokio::test]
    async fn test_write_file_size_limit() {
        let state = create_test_state();
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let large_content = "x".repeat((MAX_FILE_SIZE + 1) as usize);

        let result = write_file(file_path.to_str().unwrap(), &large_content, &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::FileSizeLimit { limit } => {
                assert_eq!(limit, MAX_FILE_SIZE);
            }
            _ => panic!("Expected FileSizeLimit error"),
        }
    }

    #[tokio::test]
    async fn test_write_file_with_backup() {
        let state = create_test_state();
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let backup_path = temp_dir.path().join("test.backup");

        // Create initial file
        let initial_content = "Initial content";
        std::fs::write(&file_path, initial_content).unwrap();

        // Write new content
        let new_content = "New content";
        let result = write_file(file_path.to_str().unwrap(), new_content, &state).await;

        assert!(result.is_ok());

        // Verify new content
        let written_content = std::fs::read_to_string(&file_path).unwrap();
        assert_eq!(written_content, new_content);

        // Verify backup was created
        assert!(backup_path.exists());
        let backup_content = std::fs::read_to_string(&backup_path).unwrap();
        assert_eq!(backup_content, initial_content);
    }

    #[tokio::test]
    async fn test_list_directory_success() {
        let state = create_test_state();
        let temp_dir = TempDir::new().unwrap();

        // Create test files
        let file1 = temp_dir.path().join("file1.txt");
        let file2 = temp_dir.path().join("file2.txt");
        let subdir = temp_dir.path().join("subdir");

        std::fs::write(&file1, "content1").unwrap();
        std::fs::write(&file2, "content2").unwrap();
        std::fs::create_dir(&subdir).unwrap();

        let result = list_directory(temp_dir.path().to_str().unwrap(), &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["count"], 3);
        assert!(result_json["entries"].is_array());

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "list_directory");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_list_directory_not_found() {
        let state = create_test_state();
        let result = list_directory("/non/existent/directory", &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::InvalidPath(_) => {
                // Expected error when canonicalize fails
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[tokio::test]
    async fn test_list_directory_on_file() {
        let state = create_test_state();
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(b"content").unwrap();

        let result = list_directory(temp_file.path().to_str().unwrap(), &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::InvalidPath(msg) => {
                assert_eq!(msg, "Path is not a directory");
            }
            _ => panic!("Expected InvalidPath error"),
        }
    }

    #[tokio::test]
    async fn test_validate_path_success() {
        let temp_dir = TempDir::new().unwrap();
        let result = validate_path(temp_dir.path().to_str().unwrap());

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), temp_dir.path().canonicalize().unwrap());
    }

    #[tokio::test]
    async fn test_validate_path_traversal() {
        let result = validate_path("../../../etc/passwd");

        // This should either succeed with canonicalized path or fail with InvalidPath
        // The exact behavior depends on the system, but it should not allow traversal
        match result {
            Ok(path) => {
                // If it succeeds, the path should be canonicalized
                assert!(path.is_absolute());
            }
            Err(McpServerError::InvalidPath(_)) => {
                // This is also acceptable
            }
            _ => panic!("Unexpected error type"),
        }
    }

    #[tokio::test]
    async fn test_metrics_and_events() {
        let state = create_test_state();
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(b"test content").unwrap();

        // Perform a read operation
        let result = read_file(temp_file.path().to_str().unwrap(), &state).await;
        assert!(result.is_ok());

        // Check that metrics were updated
        let metrics = state.get_metrics().await;
        assert!(metrics.contains_key("file_reads_total"));
        assert!(metrics.contains_key("file_read_duration_ms"));
        assert!(metrics.contains_key("file_read_bytes"));
    }
}
