// File search tool implementation with schemars

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use regex::Regex;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::{AsyncBufReadExt, BufReader};

use super::McpTool;
use crate::server::error::ToolError;

/// Input parameters for file search tool
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct FileSearchInput {
    /// The search pattern (supports regex)
    #[schemars(
        description = "Search pattern to match against file contents. Supports regular expressions.",
        regex(pattern = r"^.+$")
    )]
    pub pattern: String,

    /// Directory to search in
    #[schemars(
        description = "Directory path to search in. If not provided, searches in current directory."
    )]
    pub directory: Option<PathBuf>,

    /// Maximum number of results to return
    #[schemars(
        description = "Maximum number of search results to return",
        range(min = 1, max = 1000),
        default = "default_max_results"
    )]
    pub max_results: Option<u32>,

    /// File extensions to include (e.g., ["rs", "js", "py"])
    #[schemars(
        description = "File extensions to include in search. If empty, searches all files."
    )]
    pub extensions: Option<Vec<String>>,

    /// Case-sensitive search
    #[schemars(
        description = "Whether the search should be case-sensitive",
        default = "default_case_sensitive"
    )]
    pub case_sensitive: Option<bool>,
}

/// A single file match result
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct FileMatch {
    /// Path to the file containing the match
    #[schemars(description = "Absolute path to the file")]
    pub file_path: String,

    /// Line number where the match was found (1-based)
    #[schemars(description = "Line number where the match was found")]
    pub line_number: u32,

    /// The actual line content containing the match
    #[schemars(description = "The full line containing the match")]
    pub line_content: String,

    /// Column position of the match start (0-based)
    #[schemars(description = "Column position where the match starts")]
    pub column_start: u32,

    /// Column position of the match end (0-based)
    #[schemars(description = "Column position where the match ends")]
    pub column_end: u32,
}

/// Output from file search tool
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct FileSearchOutput {
    /// List of matching results
    #[schemars(description = "List of files and lines that match the search pattern")]
    pub matches: Vec<FileMatch>,

    /// Total number of files that were searched
    #[schemars(description = "Total number of files examined during search")]
    pub total_files_searched: u32,

    /// Search execution time in milliseconds
    #[schemars(description = "Time taken to complete the search in milliseconds")]
    pub search_duration_ms: u64,

    /// Timestamp when the search was performed
    #[schemars(description = "ISO 8601 timestamp when the search was executed")]
    pub timestamp: DateTime<Utc>,

    /// Whether the search was truncated due to max_results limit
    #[schemars(description = "True if there were more results than max_results")]
    pub truncated: bool,
}

fn default_max_results() -> Option<u32> {
    Some(100)
}

fn default_case_sensitive() -> Option<bool> {
    Some(false)
}

/// File search tool implementation
pub struct FileSearchTool;

#[async_trait]
impl McpTool for FileSearchTool {
    type Input = FileSearchInput;
    type Output = FileSearchOutput;

    fn name(&self) -> &'static str {
        "file_search"
    }

    fn description(&self) -> &'static str {
        "Search for text patterns in files using regular expressions. Supports filtering by file extensions and case-sensitive/insensitive matching."
    }

    async fn execute(&self, input: Self::Input) -> Result<Self::Output, ToolError> {
        let start_time = std::time::Instant::now();

        // Set defaults
        let max_results = input.max_results.unwrap_or(100);
        let case_sensitive = input.case_sensitive.unwrap_or(false);
        let search_dir = input.directory.unwrap_or_else(|| PathBuf::from("."));

        // Validate directory exists
        if !search_dir.exists() {
            return Err(ToolError::InvalidInput(format!(
                "Directory does not exist: {}",
                search_dir.display()
            )));
        }

        // Compile regex pattern
        let mut regex_flags = regex::RegexBuilder::new(&input.pattern);
        if !case_sensitive {
            regex_flags.case_insensitive(true);
        }

        let pattern = regex_flags
            .build()
            .map_err(|e| ToolError::InvalidInput(format!("Invalid regex pattern: {e}")))?;

        // Search files
        let mut matches = Vec::new();
        let mut total_files_searched = 0;
        let mut truncated = false;

        let search_result = self
            .search_directory(
                &search_dir,
                &pattern,
                &input.extensions,
                max_results,
                &mut matches,
                &mut total_files_searched,
            )
            .await;

        if let Err(e) = search_result {
            return Err(ToolError::ExecutionError(format!("Search failed: {e}")));
        }

        if matches.len() >= max_results as usize {
            truncated = true;
        }

        let duration = start_time.elapsed();

        Ok(FileSearchOutput {
            matches,
            total_files_searched,
            search_duration_ms: duration.as_millis() as u64,
            timestamp: Utc::now(),
            truncated,
        })
    }
}

impl FileSearchTool {
    async fn search_directory(
        &self,
        dir: &PathBuf,
        pattern: &Regex,
        extensions: &Option<Vec<String>>,
        max_results: u32,
        matches: &mut Vec<FileMatch>,
        total_files: &mut u32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut entries = fs::read_dir(dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            // Check if we've hit the limit
            if matches.len() >= max_results as usize {
                break;
            }

            let path = entry.path();

            if path.is_dir() {
                // Recursively search subdirectories
                Box::pin(self.search_directory(
                    &path,
                    pattern,
                    extensions,
                    max_results,
                    matches,
                    total_files,
                ))
                .await?;
            } else if path.is_file() {
                // Check file extension filter
                if let Some(exts) = extensions {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if !exts.iter().any(|e| e == ext) {
                            continue;
                        }
                    } else {
                        continue; // Skip files without extensions if extensions filter is provided
                    }
                }

                *total_files += 1;

                // Search file contents
                if let Err(e) = self.search_file(&path, pattern, matches, max_results).await {
                    eprintln!("Error searching file {}: {}", path.display(), e);
                    continue;
                }
            }
        }

        Ok(())
    }

    async fn search_file(
        &self,
        file_path: &PathBuf,
        pattern: &Regex,
        matches: &mut Vec<FileMatch>,
        max_results: u32,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let file = fs::File::open(file_path).await?;
        let reader = BufReader::new(file);
        let mut lines = reader.lines();
        let mut line_number = 1;

        while let Some(line) = lines.next_line().await? {
            // Check if we've hit the limit
            if matches.len() >= max_results as usize {
                break;
            }

            if let Some(mat) = pattern.find(&line) {
                matches.push(FileMatch {
                    file_path: file_path.to_string_lossy().to_string(),
                    line_number,
                    line_content: line.clone(),
                    column_start: mat.start() as u32,
                    column_end: mat.end() as u32,
                });
            }

            line_number += 1;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use tokio::fs;

    #[tokio::test]
    async fn test_file_search_basic() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        fs::write(&file_path, "Hello world\nError: something went wrong\nOK")
            .await
            .unwrap();

        let tool = FileSearchTool;
        let input = FileSearchInput {
            pattern: "Error.*".to_string(),
            directory: Some(temp_dir.path().to_path_buf()),
            max_results: Some(10),
            extensions: None,
            case_sensitive: Some(false),
        };

        let result = tool.execute(input).await.unwrap();

        assert_eq!(result.matches.len(), 1);
        assert_eq!(result.matches[0].line_number, 2);
        assert_eq!(
            result.matches[0].line_content,
            "Error: something went wrong"
        );
        assert_eq!(result.total_files_searched, 1);
        assert!(!result.truncated);
    }

    #[tokio::test]
    async fn test_file_search_schema_generation() {
        let input_schema = schemars::schema_for!(FileSearchInput);
        let output_schema = schemars::schema_for!(FileSearchOutput);

        // Verify schemas can be serialized
        let input_json = serde_json::to_value(&input_schema).unwrap();
        let output_json = serde_json::to_value(&output_schema).unwrap();

        // Check that required fields are present
        assert!(input_json["properties"]["pattern"].is_object());
        assert!(output_json["properties"]["matches"].is_object());
        assert!(output_json["properties"]["total_files_searched"].is_object());
    }
}
