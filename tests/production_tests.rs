// Production Tests
// Comprehensive testing for production-ready code

use serde_json::Value;
use std::fs;
use std::path::Path;

#[test]
fn test_production_build_artifacts() {
    // Test that all required build artifacts exist
    assert!(
        Path::new("static/js/dashboard.min.js").exists(),
        "Minified JS bundle should exist"
    );
    assert!(
        Path::new("static/css/output.css").exists(),
        "CSS bundle should exist"
    );
    assert!(
        Path::new("target/release/rust-mcp-server").exists(),
        "Release binary should exist"
    );
}

#[test]
fn test_bundle_size_optimization() {
    // Test that bundle size is within acceptable limits
    let metadata = fs::metadata("static/js/dashboard.min.js").expect("Bundle file should exist");
    let size_kb = metadata.len() / 1024;

    // Bundle should be under 50KB
    assert!(
        size_kb < 50,
        "Bundle size should be under 50KB, got {}KB",
        size_kb
    );

    // Bundle should be over 10KB (sanity check)
    assert!(
        size_kb > 10,
        "Bundle size should be over 10KB (sanity check), got {}KB",
        size_kb
    );
}

#[test]
fn test_bundle_metadata_exists() {
    // Test that bundle metadata is generated
    assert!(
        Path::new("static/js/bundle-meta.json").exists(),
        "Bundle metadata should exist"
    );

    // Test that metadata is valid JSON
    let metadata_content = fs::read_to_string("static/js/bundle-meta.json")
        .expect("Should be able to read bundle metadata");

    let metadata: Value =
        serde_json::from_str(&metadata_content).expect("Bundle metadata should be valid JSON");

    // Test that metadata contains expected fields
    assert!(
        metadata.get("inputs").is_some(),
        "Metadata should contain inputs"
    );
    assert!(
        metadata.get("outputs").is_some(),
        "Metadata should contain outputs"
    );

    // Test that outputs contain size information
    let outputs = metadata["outputs"]
        .as_object()
        .expect("Outputs should be object");
    assert!(!outputs.is_empty(), "Outputs should not be empty");

    for (_, output) in outputs {
        assert!(
            output.get("bytes").is_some(),
            "Output should contain bytes information"
        );
    }
}

#[test]
fn test_typescript_types_generated() {
    // Test that TypeScript types are generated
    let types_dir = Path::new("static/js/types/generated");
    assert!(types_dir.exists(), "Generated types directory should exist");

    // Test that key type files exist
    let key_files = [
        "McpStatus.ts",
        "SessionInfo.ts",
        "ToolCall.ts",
        "DashboardConfig.ts",
        "index.ts",
    ];

    for file in &key_files {
        let file_path = types_dir.join(file);
        assert!(
            file_path.exists(),
            "Generated type file {} should exist",
            file
        );

        // Test that file is not empty
        let content =
            fs::read_to_string(&file_path).expect(&format!("Should be able to read {}", file));
        assert!(
            !content.is_empty(),
            "Type file {} should not be empty",
            file
        );

        // Test that file contains TypeScript export
        assert!(
            content.contains("export interface") || content.contains("export type"),
            "Type file {} should contain TypeScript exports",
            file
        );
    }
}

#[test]
fn test_css_build_output() {
    // Test that CSS is built and optimized
    let css_file = Path::new("static/css/output.css");
    assert!(css_file.exists(), "CSS output file should exist");

    let css_content = fs::read_to_string(css_file).expect("Should be able to read CSS file");

    // Test that CSS is minified (no unnecessary whitespace)
    assert!(!css_content.contains("  "), "CSS should be minified");
    assert!(
        !css_content.contains("\n\n"),
        "CSS should not contain empty lines"
    );

    // Test that CSS contains expected classes
    assert!(
        css_content.contains("dashboard"),
        "CSS should contain dashboard styles"
    );
}

#[test]
fn test_production_binary_optimization() {
    // Test that the binary is optimized
    let binary_path = Path::new("target/release/rust-mcp-server");
    assert!(binary_path.exists(), "Release binary should exist");

    // Test binary size (should be reasonable for a web server)
    let metadata = fs::metadata(binary_path).expect("Should be able to read binary metadata");
    let size_mb = metadata.len() / (1024 * 1024);

    // Binary should be under 100MB
    assert!(
        size_mb < 100,
        "Binary should be under 100MB, got {}MB",
        size_mb
    );

    // Binary should be over 1MB (sanity check)
    assert!(
        size_mb > 1,
        "Binary should be over 1MB (sanity check), got {}MB",
        size_mb
    );
}

#[test]
fn test_security_configurations() {
    // Test that security configurations are in place

    // Test that .env files are not in production
    assert!(
        !Path::new(".env").exists(),
        ".env file should not exist in production"
    );
    assert!(
        !Path::new(".env.local").exists(),
        ".env.local file should not exist in production"
    );

    // Test that debug files are not included
    assert!(
        !Path::new("debug.log").exists(),
        "Debug log should not exist in production"
    );
    assert!(
        !Path::new("static/js/dashboard.min.js.map").exists(),
        "Source maps should not exist in production"
    );
}

#[test]
fn test_performance_optimizations() {
    // Test performance-related optimizations

    // Test that bundle contains performance monitoring
    let bundle_content =
        fs::read_to_string("static/js/dashboard.min.js").expect("Should be able to read bundle");

    // Should contain performance tracking (minified)
    assert!(
        bundle_content.contains("performance"),
        "Bundle should contain performance tracking"
    );

    // Should be minified (no unnecessary spaces)
    let lines: Vec<&str> = bundle_content.lines().collect();
    assert!(
        lines.len() < 100,
        "Minified bundle should have fewer than 100 lines"
    );
}

#[test]
fn test_error_handling_production() {
    // Test that error handling is production-ready

    let bundle_content =
        fs::read_to_string("static/js/dashboard.min.js").expect("Should be able to read bundle");

    // Should contain error handling
    assert!(
        bundle_content.contains("error"),
        "Bundle should contain error handling"
    );

    // Should not contain debug console logs in production
    assert!(
        !bundle_content.contains("console.log"),
        "Bundle should not contain console.log in production"
    );
    assert!(
        !bundle_content.contains("console.warn"),
        "Bundle should not contain console.warn in production"
    );
}

#[test]
fn test_component_loading_optimization() {
    // Test that components are optimized for loading

    if Path::new("static/js/bundle-meta.json").exists() {
        let metadata_content = fs::read_to_string("static/js/bundle-meta.json")
            .expect("Should be able to read bundle metadata");

        let metadata: Value =
            serde_json::from_str(&metadata_content).expect("Bundle metadata should be valid JSON");

        // Test that components are properly bundled
        let inputs = metadata["inputs"]
            .as_object()
            .expect("Inputs should be object");

        // Should have optimized components
        let has_optimized = inputs.keys().any(|k| k.contains("optimized"));
        assert!(has_optimized, "Bundle should contain optimized components");

        // Should have error handling
        let has_error_handling = inputs.keys().any(|k| k.contains("error"));
        assert!(has_error_handling, "Bundle should contain error handling");
    }
}

#[test]
fn test_production_manifest() {
    // Test that production manifest is generated correctly
    if Path::new("production-manifest.json").exists() {
        let manifest_content = fs::read_to_string("production-manifest.json")
            .expect("Should be able to read production manifest");

        let manifest: Value = serde_json::from_str(&manifest_content)
            .expect("Production manifest should be valid JSON");

        // Test required fields
        assert!(
            manifest.get("buildDate").is_some(),
            "Manifest should contain build date"
        );
        assert!(
            manifest.get("version").is_some(),
            "Manifest should contain version"
        );
        assert!(
            manifest.get("bundleSize").is_some(),
            "Manifest should contain bundle size"
        );
        assert!(
            manifest.get("optimizations").is_some(),
            "Manifest should contain optimizations"
        );
        assert!(
            manifest.get("features").is_some(),
            "Manifest should contain features"
        );

        // Test optimization flags
        let optimizations = manifest["optimizations"]
            .as_object()
            .expect("Optimizations should be object");
        assert_eq!(
            optimizations.get("bundleMinified"),
            Some(&Value::Bool(true)),
            "Bundle should be minified"
        );
        assert_eq!(
            optimizations.get("errorHandlerOptimized"),
            Some(&Value::Bool(true)),
            "Error handler should be optimized"
        );
        assert_eq!(
            optimizations.get("performanceMonitoringEnabled"),
            Some(&Value::Bool(true)),
            "Performance monitoring should be enabled"
        );
    }
}

#[test]
fn test_development_dependencies_excluded() {
    // Test that development dependencies are not included in production

    // Test that TypeScript source files are not in the bundle
    let bundle_content =
        fs::read_to_string("static/js/dashboard.min.js").expect("Should be able to read bundle");

    // Should not contain TypeScript-specific content
    assert!(
        !bundle_content.contains("// TypeScript"),
        "Bundle should not contain TypeScript comments"
    );
    assert!(
        !bundle_content.contains("interface "),
        "Bundle should not contain uncompiled interfaces"
    );
}

#[test]
fn test_memory_optimization() {
    // Test memory optimization features

    if Path::new("static/js/bundle-meta.json").exists() {
        let metadata_content = fs::read_to_string("static/js/bundle-meta.json")
            .expect("Should be able to read bundle metadata");

        let metadata: Value =
            serde_json::from_str(&metadata_content).expect("Bundle metadata should be valid JSON");

        // Test that bundle is efficiently sized
        let outputs = metadata["outputs"]
            .as_object()
            .expect("Outputs should be object");
        for (_, output) in outputs {
            let bytes = output["bytes"].as_u64().expect("Bytes should be number");

            // No single output should be excessively large
            assert!(
                bytes < 100_000,
                "Individual bundle output should be under 100KB"
            );
        }
    }
}
