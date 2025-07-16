#[cfg(test)]
mod tests {
    use crate::server::error::McpServerError;
    use crate::server::tools::system::{
        get_all_info, get_cpu_info, get_disk_info, get_memory_info, get_network_info,
        get_process_info, get_system_info,
    };
    use crate::shared::state::AppState;
    use sysinfo::System;

    fn create_test_state() -> AppState {
        AppState::new()
    }

    #[tokio::test]
    async fn test_get_system_info_cpu() {
        let state = create_test_state();
        let result = get_system_info("cpu", &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["type"], "cpu");
        assert!(result_json["cpu_count"].is_number());
        assert!(result_json["cpus"].is_array());
        assert!(result_json["global_usage"].is_number());
        assert!(result_json["load_average"].is_object());

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "system_info");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_get_system_info_memory() {
        let state = create_test_state();
        let result = get_system_info("memory", &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["type"], "memory");
        assert!(result_json["total_memory"].is_number());
        assert!(result_json["available_memory"].is_number());
        assert!(result_json["used_memory"].is_number());
        assert!(result_json["free_memory"].is_number());
        assert!(result_json["total_swap"].is_number());
        assert!(result_json["used_swap"].is_number());
        assert!(result_json["free_swap"].is_number());
        assert!(result_json["memory_usage_percent"].is_number());

        // Verify memory usage percentage is reasonable
        let usage_percent = result_json["memory_usage_percent"].as_f64().unwrap();
        assert!((0.0..=100.0).contains(&usage_percent));

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "system_info");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_get_system_info_disk() {
        let state = create_test_state();
        let result = get_system_info("disk", &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["type"], "disk");
        assert!(result_json["disk_count"].is_number());
        assert!(result_json["disks"].is_array());

        // Check disk array structure
        let disks = result_json["disks"].as_array().unwrap();
        for disk in disks {
            assert!(disk["name"].is_string());
            assert!(disk["file_system"].is_string());
            assert!(disk["type"].is_string());
            assert!(disk["mount_point"].is_string());
            assert!(disk["total_space"].is_number());
            assert!(disk["available_space"].is_number());
            assert!(disk["used_space"].is_number());
            assert!(disk["is_removable"].is_boolean());
            assert!(disk["usage_percent"].is_number());

            // Verify usage percentage is reasonable
            let usage_percent = disk["usage_percent"].as_f64().unwrap();
            assert!((0.0..=100.0).contains(&usage_percent));
        }

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "system_info");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_get_system_info_network() {
        let state = create_test_state();
        let result = get_system_info("network", &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["type"], "network");
        assert!(result_json["interface_count"].is_number());
        assert!(result_json["interfaces"].is_array());

        // Check network interface structure
        let interfaces = result_json["interfaces"].as_array().unwrap();
        for interface in interfaces {
            assert!(interface["name"].is_string());
            assert!(interface["received"].is_number());
            assert!(interface["transmitted"].is_number());
            assert!(interface["packets_received"].is_number());
            assert!(interface["packets_transmitted"].is_number());
            assert!(interface["errors_on_received"].is_number());
            assert!(interface["errors_on_transmitted"].is_number());
        }

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "system_info");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_get_system_info_processes() {
        let state = create_test_state();
        let result = get_system_info("processes", &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["type"], "processes");
        assert!(result_json["total_processes"].is_number());
        assert!(result_json["top_processes"].is_array());

        // Check process structure
        let processes = result_json["top_processes"].as_array().unwrap();
        assert!(processes.len() <= 20); // Should be limited to top 20

        for process in processes {
            assert!(process["pid"].is_number());
            assert!(process["name"].is_string());
            assert!(process["cmd"].is_array());
            assert!(process["memory"].is_number());
            assert!(process["virtual_memory"].is_number());
            assert!(process["cpu_usage"].is_number());
            assert!(process["status"].is_string());
            assert!(process["start_time"].is_number());
            // exe and cwd can be null
        }

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "system_info");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_get_system_info_all() {
        let state = create_test_state();
        let result = get_system_info("all", &state).await;

        assert!(result.is_ok());

        let result_str = result.unwrap();
        let result_json: serde_json::Value = serde_json::from_str(&result_str).unwrap();

        assert_eq!(result_json["type"], "all");
        assert!(result_json["timestamp"].is_string());

        // Check that all subsections are present
        assert!(result_json["cpu"].is_object());
        assert!(result_json["memory"].is_object());
        assert!(result_json["disk"].is_object());
        assert!(result_json["network"].is_object());
        assert!(result_json["processes"].is_object());

        // Check system info fields
        assert!(result_json["system_name"].is_string() || result_json["system_name"].is_null());
        assert!(
            result_json["kernel_version"].is_string() || result_json["kernel_version"].is_null()
        );
        assert!(result_json["os_version"].is_string() || result_json["os_version"].is_null());
        assert!(result_json["host_name"].is_string() || result_json["host_name"].is_null());

        // Verify subsection types
        assert_eq!(result_json["cpu"]["type"], "cpu");
        assert_eq!(result_json["memory"]["type"], "memory");
        assert_eq!(result_json["disk"]["type"], "disk");
        assert_eq!(result_json["network"]["type"], "network");
        assert_eq!(result_json["processes"]["type"], "processes");

        // Check that tool call was recorded
        let tool_calls = state.get_tool_calls(10).await;
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].tool_name, "system_info");
        assert!(tool_calls[0].success);
    }

    #[tokio::test]
    async fn test_get_system_info_invalid_type() {
        let state = create_test_state();
        let result = get_system_info("invalid_type", &state).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            McpServerError::System(msg) => {
                assert_eq!(msg, "Unknown info type: invalid_type");
            }
            _ => panic!("Expected System error"),
        }
    }

    #[tokio::test]
    async fn test_get_cpu_info() {
        let mut sys = System::new_all();
        sys.refresh_all();

        let result = get_cpu_info(&sys);
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info["type"], "cpu");
        assert!(info["cpu_count"].is_number());
        assert!(info["cpus"].is_array());
        assert!(info["global_usage"].is_number());
        assert!(info["load_average"].is_object());

        // Check CPU array structure
        let cpus = info["cpus"].as_array().unwrap();
        assert!(!cpus.is_empty());

        for cpu in cpus {
            assert!(cpu["name"].is_string());
            assert!(cpu["vendor_id"].is_string());
            assert!(cpu["brand"].is_string());
            assert!(cpu["frequency"].is_number());
            assert!(cpu["usage"].is_number());
        }
    }

    #[tokio::test]
    async fn test_get_memory_info() {
        let mut sys = System::new_all();
        sys.refresh_all();

        let result = get_memory_info(&sys);
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info["type"], "memory");

        // Check that memory values are reasonable
        let total = info["total_memory"].as_u64().unwrap();
        let used = info["used_memory"].as_u64().unwrap();
        let available = info["available_memory"].as_u64().unwrap();
        let free = info["free_memory"].as_u64().unwrap();

        assert!(total > 0);
        assert!(used <= total);
        assert!(available <= total);
        assert!(free <= total);

        let usage_percent = info["memory_usage_percent"].as_f64().unwrap();
        assert!((0.0..=100.0).contains(&usage_percent));
    }

    #[tokio::test]
    async fn test_get_disk_info() {
        let sys = System::new_all();

        let result = get_disk_info(&sys);
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info["type"], "disk");
        assert!(info["disk_count"].is_number());
        assert!(info["disks"].is_array());

        // Check disk structure
        let disks = info["disks"].as_array().unwrap();
        for disk in disks {
            let total = disk["total_space"].as_u64().unwrap();
            let available = disk["available_space"].as_u64().unwrap();
            let used = disk["used_space"].as_u64().unwrap();

            assert!(available <= total);
            assert!(used <= total);
            assert!(used + available <= total); // Allow for reserved space
        }
    }

    #[tokio::test]
    async fn test_get_network_info() {
        let sys = System::new_all();

        let result = get_network_info(&sys);
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info["type"], "network");
        assert!(info["interface_count"].is_number());
        assert!(info["interfaces"].is_array());

        // Network interfaces should have reasonable values
        let interfaces = info["interfaces"].as_array().unwrap();
        for interface in interfaces {
            let _received = interface["received"].as_u64().unwrap();
            let _transmitted = interface["transmitted"].as_u64().unwrap();
            let _packets_received = interface["packets_received"].as_u64().unwrap();
            let _packets_transmitted = interface["packets_transmitted"].as_u64().unwrap();

            // Basic sanity checks - removed useless comparisons for unsigned values
        }
    }

    #[tokio::test]
    async fn test_get_process_info() {
        let mut sys = System::new_all();
        sys.refresh_all();

        let result = get_process_info(&sys);
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info["type"], "processes");

        let total_processes = info["total_processes"].as_u64().unwrap();
        let top_processes = info["top_processes"].as_array().unwrap();

        assert!(total_processes > 0);
        assert!(top_processes.len() <= 20);
        assert!(top_processes.len() <= total_processes as usize);

        // Check that processes are sorted by CPU usage (descending)
        let mut prev_cpu_usage = f64::INFINITY;
        for process in top_processes {
            let cpu_usage = process["cpu_usage"].as_f64().unwrap();
            assert!(cpu_usage <= prev_cpu_usage);
            prev_cpu_usage = cpu_usage;
        }
    }

    #[tokio::test]
    async fn test_get_all_info() {
        let mut sys = System::new_all();
        sys.refresh_all();

        let result = get_all_info(&sys);
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info["type"], "all");

        // Check that all subsections are present and valid
        assert!(info["timestamp"].is_string());
        assert!(info["cpu"].is_object());
        assert!(info["memory"].is_object());
        assert!(info["disk"].is_object());
        assert!(info["network"].is_object());
        assert!(info["processes"].is_object());

        // Each subsection should have its correct type
        assert_eq!(info["cpu"]["type"], "cpu");
        assert_eq!(info["memory"]["type"], "memory");
        assert_eq!(info["disk"]["type"], "disk");
        assert_eq!(info["network"]["type"], "network");
        assert_eq!(info["processes"]["type"], "processes");
    }

    #[tokio::test]
    async fn test_metrics_and_events() {
        let state = create_test_state();

        // Subscribe to events
        let mut event_rx = state.subscribe_to_events();

        let result = get_system_info("cpu", &state).await;
        assert!(result.is_ok());

        // Check that metrics were updated
        let metrics = state.get_metrics().await;
        assert!(metrics.contains_key("system_info_requests_total"));
        assert!(metrics.contains_key("system_info_duration_ms"));

        // Check that event was sent
        let event = event_rx.recv().await.unwrap();
        match event {
            crate::shared::state::SystemEvent::ToolCalled { name, .. } => {
                assert_eq!(name, "system_info");
            }
            _ => panic!("Expected ToolCalled event"),
        }
    }
}
