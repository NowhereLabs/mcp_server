// TypeScript compilation tests for generated types

use std::fs;
use std::process::Command;
use tempfile::TempDir;

#[test]
fn test_typescript_types_exist() {
    let generated_dir = std::path::Path::new("static/js/types/generated");

    // Check if generated types directory exists
    assert!(
        generated_dir.exists(),
        "Generated types directory should exist"
    );

    // Check if key type files exist
    let key_files = [
        "McpStatus.ts",
        "SessionInfo.ts",
        "ToolCall.ts",
        "DashboardConfig.ts",
        "index.ts",
    ];

    for file in &key_files {
        let file_path = generated_dir.join(file);
        assert!(
            file_path.exists(),
            "Generated type file {} should exist",
            file
        );
    }
}

#[test]
fn test_typescript_compilation() {
    let generated_dir = std::path::Path::new("static/js/types/generated");

    // Skip test if TypeScript files don't exist
    if !generated_dir.exists() {
        println!("Skipping TypeScript compilation test - generated types not found");
        return;
    }

    // Create a temporary test file that imports generated types
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let test_file = temp_dir.path().join("test.ts");

    let test_content = r#"
import { McpStatus, SessionInfo, ToolCall, DashboardMetrics } from '../../../../../static/js/types/generated';

// Test that types can be used
const status: McpStatus = {
    connected: true,
    last_heartbeat: null,
    capabilities: ['tools'],
    server_info: {
        name: 'test',
        version: '1.0.0'
    },
    started_at: '2025-01-01T00:00:00Z'
};

const session: SessionInfo = {
    id: 'test-id',
    started_at: '2025-01-01T00:00:00Z',
    request_count: 0,
    last_activity: '2025-01-01T00:00:00Z'
};

const toolCall: ToolCall = {
    id: 'test-id',
    name: 'test-tool',
    tool_name: 'test-tool',
    arguments: {},
    timestamp: '2025-01-01T00:00:00Z',
    duration_ms: 100,
    execution_time: 100,
    result: null,
    result_string: null,
    success: true,
    error: null
};

const metrics: DashboardMetrics = {
    total_sessions: 1,
    active_sessions: 1,
    total_tool_calls: 1,
    successful_tool_calls: 1,
    failed_tool_calls: 0,
    average_response_time_ms: 100.0,
    uptime_seconds: 3600
};

console.log('Types compile successfully');
"#;

    fs::write(&test_file, test_content).expect("Failed to write test file");

    // Check if tsc is available
    let tsc_check = Command::new("npx").args(&["tsc", "--version"]).output();

    if tsc_check.is_err() {
        println!("Skipping TypeScript compilation test - tsc not available");
        return;
    }

    // Run TypeScript compiler on test file
    let output = Command::new("npx")
        .args(&[
            "tsc",
            "--noEmit",
            "--skipLibCheck",
            test_file.to_str().unwrap(),
        ])
        .output()
        .expect("Failed to run TypeScript compiler");

    if !output.status.success() {
        println!("TypeScript compilation failed:");
        println!("stdout: {}", String::from_utf8_lossy(&output.stdout));
        println!("stderr: {}", String::from_utf8_lossy(&output.stderr));
        panic!("TypeScript compilation failed");
    }

    println!("TypeScript compilation successful");
}

#[test]
fn test_generated_types_are_valid_typescript() {
    let generated_dir = std::path::Path::new("static/js/types/generated");

    // Skip test if TypeScript files don't exist
    if !generated_dir.exists() {
        println!("Skipping TypeScript validation test - generated types not found");
        return;
    }

    // Read each generated TypeScript file and check basic syntax
    let type_files = [
        "McpStatus.ts",
        "SessionInfo.ts",
        "ToolCall.ts",
        "DashboardConfig.ts",
    ];

    for file in &type_files {
        let file_path = generated_dir.join(file);
        if !file_path.exists() {
            continue;
        }

        let content = fs::read_to_string(&file_path).expect(&format!("Failed to read {}", file));

        // Check basic TypeScript syntax
        assert!(
            content.contains("export interface") || content.contains("export type"),
            "File {} should contain TypeScript export statements",
            file
        );

        // Check that braces are balanced
        let open_braces = content.matches('{').count();
        let close_braces = content.matches('}').count();
        assert_eq!(
            open_braces, close_braces,
            "File {} should have balanced braces",
            file
        );

        // Check that file doesn't contain obvious syntax errors
        assert!(
            !content.contains("undefined"),
            "File {} should not contain undefined types",
            file
        );
        assert!(
            !content.contains("null,"),
            "File {} should not contain trailing null",
            file
        );
    }
}

#[test]
fn test_generated_types_structure() {
    let generated_dir = std::path::Path::new("static/js/types/generated");

    // Skip test if TypeScript files don't exist
    if !generated_dir.exists() {
        println!("Skipping TypeScript structure test - generated types not found");
        return;
    }

    // Test McpStatus structure
    let mcp_status_file = generated_dir.join("McpStatus.ts");
    if mcp_status_file.exists() {
        let content = fs::read_to_string(&mcp_status_file).expect("Failed to read McpStatus.ts");

        assert!(
            content.contains("connected: boolean"),
            "McpStatus should have connected field"
        );
        assert!(
            content.contains("last_heartbeat: string | null"),
            "McpStatus should have last_heartbeat field"
        );
        assert!(
            content.contains("capabilities: string[]"),
            "McpStatus should have capabilities field"
        );
        assert!(
            content.contains("server_info: ServerInfo"),
            "McpStatus should have server_info field"
        );
    }

    // Test SessionInfo structure
    let session_info_file = generated_dir.join("SessionInfo.ts");
    if session_info_file.exists() {
        let content =
            fs::read_to_string(&session_info_file).expect("Failed to read SessionInfo.ts");

        assert!(
            content.contains("id: string"),
            "SessionInfo should have id field"
        );
        assert!(
            content.contains("started_at: string"),
            "SessionInfo should have started_at field"
        );
        assert!(
            content.contains("request_count: number"),
            "SessionInfo should have request_count field"
        );
    }

    // Test ToolCall structure
    let tool_call_file = generated_dir.join("ToolCall.ts");
    if tool_call_file.exists() {
        let content = fs::read_to_string(&tool_call_file).expect("Failed to read ToolCall.ts");

        assert!(
            content.contains("name: string"),
            "ToolCall should have name field"
        );
        assert!(
            content.contains("timestamp: string"),
            "ToolCall should have timestamp field"
        );
        assert!(
            content.contains("success: boolean"),
            "ToolCall should have success field"
        );
    }
}

#[test]
fn test_index_exports_all_types() {
    let generated_dir = std::path::Path::new("static/js/types/generated");
    let index_file = generated_dir.join("index.ts");

    // Skip test if files don't exist
    if !index_file.exists() {
        println!("Skipping index exports test - index.ts not found");
        return;
    }

    let content = fs::read_to_string(&index_file).expect("Failed to read index.ts");

    // Check that index.ts exports all generated types
    let expected_exports = ["McpStatus", "SessionInfo", "ToolCall", "DashboardConfig"];

    for export in &expected_exports {
        assert!(
            content.contains(&format!("export * from './{}'", export)),
            "index.ts should export from {}",
            export
        );
    }
}
