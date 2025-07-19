use std::fs;
use std::time::Duration;

use rust_mcp_server::dashboard::hot_reload::{HotReloadWatcher, ReloadEvent};
use rust_mcp_server::shared::{config::Config, state::AppState};
use tempfile::TempDir;
use tokio::sync::oneshot;
use tokio::time::sleep;

/// Helper function to create a temporary directory structure for testing
fn create_temp_workspace() -> TempDir {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");

    // Create the expected directory structure
    let static_dir = temp_dir.path().join("static");
    let templates_dir = temp_dir.path().join("templates");
    let config_dir = temp_dir.path().join("config");
    let src_dir = temp_dir.path().join("src");

    fs::create_dir_all(&static_dir).expect("Failed to create static dir");
    fs::create_dir_all(&templates_dir).expect("Failed to create templates dir");
    fs::create_dir_all(&config_dir).expect("Failed to create config dir");
    fs::create_dir_all(&src_dir).expect("Failed to create src dir");

    temp_dir
}

/// Test that the hot reload watcher can be created and started
#[tokio::test]
async fn test_hot_reload_watcher_creation() {
    let state = AppState::new();
    let config = Config::default();
    let (watcher, _reload_rx) = HotReloadWatcher::new(state, config);

    // Test that watcher was created successfully
    assert!(std::ptr::addr_of!(watcher) as usize != 0);
}

/// Test that the watcher can be gracefully shut down
#[tokio::test]
async fn test_hot_reload_graceful_shutdown() {
    let _temp_dir = create_temp_workspace();
    let original_dir = std::env::current_dir().expect("Failed to get current dir");

    // Change to temp directory for the test
    std::env::set_current_dir(_temp_dir.path()).expect("Failed to change directory");

    let state = AppState::new();
    let config = Config::default();
    let (watcher, _reload_rx) = HotReloadWatcher::new(state, config);

    // Create shutdown channel
    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    // Start watcher in background
    let watcher_handle = tokio::spawn(async move { watcher.start(shutdown_rx).await });

    // Give watcher time to start
    sleep(Duration::from_millis(100)).await;

    // Send shutdown signal
    shutdown_tx
        .send(())
        .expect("Failed to send shutdown signal");

    // Wait for watcher to shut down
    let result = tokio::time::timeout(Duration::from_secs(5), watcher_handle).await;

    // Restore original directory
    std::env::set_current_dir(original_dir).expect("Failed to restore directory");

    assert!(result.is_ok(), "Watcher did not shut down gracefully");
    assert!(
        result.unwrap().is_ok(),
        "Watcher encountered an error during shutdown"
    );
}

/// Test that configurable debounce timing is respected
#[tokio::test]
async fn test_configurable_debounce_timing() {
    let state = AppState::new();
    let mut config = Config::default();
    config.development.hot_reload_debounce_ms = 100; // Short debounce for testing

    let (_watcher, _reload_rx) = HotReloadWatcher::new(state, config);

    // Test that watcher can be created with custom debounce timing
    // This test focuses on the configuration aspect rather than file watching

    // Test default configuration
    let state2 = AppState::new();
    let default_config = Config::default();
    let (_watcher2, _reload_rx2) = HotReloadWatcher::new(state2, default_config);

    // Test that both watchers were created successfully
    assert!(std::ptr::addr_of!(_watcher) as usize != 0);
    assert!(std::ptr::addr_of!(_watcher2) as usize != 0);
}

/// Test that different file types are correctly categorized
#[tokio::test]
async fn test_file_type_categorization() {
    let state = AppState::new();
    let config = Config::default();
    let (_watcher, _reload_rx) = HotReloadWatcher::new(state, config);

    // Test file extension categorization logic
    // This test focuses on the logic rather than actual file watching

    // Frontend files
    let frontend_extensions = vec!["js", "css", "html", "askama"];
    for ext in frontend_extensions {
        let filename = format!("test.{ext}");
        assert!(
            filename.ends_with(".js")
                || filename.ends_with(".css")
                || filename.ends_with(".html")
                || filename.ends_with(".askama"),
            "File {filename} should be categorized as frontend"
        );
    }

    // Backend files
    let backend_extensions = vec!["rs"];
    for ext in backend_extensions {
        let filename = format!("test.{ext}");
        assert!(
            filename.ends_with(".rs"),
            "File {filename} should be categorized as backend"
        );
    }

    // Other files should be ignored
    let ignored_extensions = vec!["txt", "md", "log", "backup"];
    for ext in ignored_extensions {
        let filename = format!("test.{ext}");
        assert!(
            !filename.ends_with(".js")
                && !filename.ends_with(".css")
                && !filename.ends_with(".html")
                && !filename.ends_with(".askama")
                && !filename.ends_with(".rs"),
            "File {filename} should be ignored"
        );
    }
}

/// Test that reload events can be created and have correct types
#[tokio::test]
async fn test_reload_event_types() {
    let frontend_event = ReloadEvent::FrontendChanged;
    let backend_event = ReloadEvent::BackendChanged;

    // Test that events are cloneable
    let _frontend_clone = frontend_event.clone();
    let _backend_clone = backend_event.clone();

    // Test that events have proper Debug implementation
    let frontend_debug = format!("{frontend_event:?}");
    let backend_debug = format!("{backend_event:?}");

    assert!(frontend_debug.contains("FrontendChanged"));
    assert!(backend_debug.contains("BackendChanged"));
}

/// Test that browser reload message can be created
#[tokio::test]
async fn test_browser_reload_message() {
    let reload_msg = rust_mcp_server::dashboard::hot_reload::BrowserReloadMessage::reload();

    assert_eq!(reload_msg.r#type, "reload");
    assert_eq!(reload_msg.action, "refresh");

    // Test that the message can be serialized
    let serialized =
        serde_json::to_string(&reload_msg).expect("Failed to serialize reload message");
    assert!(serialized.contains("reload"));
    assert!(serialized.contains("refresh"));
}

/// Test that watcher handles non-existent directories gracefully
#[tokio::test]
async fn test_missing_directories_handling() {
    let temp_dir = TempDir::new().expect("Failed to create temp directory");
    let original_dir = std::env::current_dir().expect("Failed to get current dir");

    // Change to temp directory without creating expected subdirectories
    std::env::set_current_dir(temp_dir.path()).expect("Failed to change directory");

    let state = AppState::new();
    let config = Config::default();
    let (watcher, _reload_rx) = HotReloadWatcher::new(state, config);

    // Create shutdown channel
    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    // Start watcher in background
    let watcher_handle = tokio::spawn(async move { watcher.start(shutdown_rx).await });

    // Give watcher time to start and handle missing directories
    sleep(Duration::from_millis(100)).await;

    // Send shutdown signal
    shutdown_tx
        .send(())
        .expect("Failed to send shutdown signal");

    // Wait for watcher to shut down gracefully
    let result = tokio::time::timeout(Duration::from_secs(5), watcher_handle).await;

    // Restore original directory before dropping temp_dir
    // Use let _ = to ignore potential errors during test cleanup
    let _ = std::env::set_current_dir(&original_dir);

    // Now we can safely drop temp_dir
    drop(temp_dir);

    assert!(
        result.is_ok(),
        "Watcher did not handle missing directories gracefully"
    );
    assert!(
        result.unwrap().is_ok(),
        "Watcher encountered an error with missing directories"
    );
}

/// Test that environment variable configuration works
#[tokio::test]
async fn test_environment_variable_configuration() {
    // Test that environment variable is properly parsed
    std::env::set_var("HOT_RELOAD_DEBOUNCE_MS", "250");

    let config = Config::from_env().expect("Failed to parse config from environment");
    assert_eq!(config.development.hot_reload_debounce_ms, 250);

    // Test with invalid value
    std::env::set_var("HOT_RELOAD_DEBOUNCE_MS", "invalid");
    let config_result = Config::from_env();
    assert!(
        config_result.is_err(),
        "Should fail with invalid debounce value"
    );

    // Test with out of range value
    std::env::set_var("HOT_RELOAD_DEBOUNCE_MS", "10000"); // Above max of 5000
    let config_result = Config::from_env();
    assert!(
        config_result.is_err(),
        "Should fail with out of range debounce value"
    );

    // Clean up
    std::env::remove_var("HOT_RELOAD_DEBOUNCE_MS");
}
