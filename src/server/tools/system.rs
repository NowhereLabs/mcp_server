use crate::server::error::{McpServerError, Result};
use crate::shared::state::{AppState, MetricValue, SystemEvent, ToolCall, ToolCallResult};
use chrono::Utc;
use std::time::Instant;
use sysinfo::{Disks, Networks, System};
use tracing::{info, warn};
use uuid::Uuid;

pub async fn get_system_info(info_type: &str, state: &AppState) -> Result<String> {
    let start_time = Instant::now();
    let _tool_call_id = Uuid::new_v4();

    info!("Getting system info: {}", info_type);

    let mut sys = System::new_all();
    sys.refresh_all();

    let result = match info_type {
        "cpu" => get_cpu_info(&sys)?,
        "memory" => get_memory_info(&sys)?,
        "disk" => get_disk_info(&sys)?,
        "network" => get_network_info(&sys)?,
        "processes" => get_process_info(&sys)?,
        "all" => get_all_info(&sys)?,
        _ => {
            return Err(McpServerError::System(format!(
                "Unknown info type: {info_type}"
            )))
        }
    };

    let execution_time = start_time.elapsed();

    // Record tool call in state
    let tool_call = ToolCall::new(
        "system_info".to_string(),
        serde_json::json!({ "info_type": info_type }),
    )
    .complete(
        ToolCallResult::Success(result.clone()),
        execution_time.as_millis() as u64,
    );

    state.add_tool_call(tool_call.clone()).await;

    // Update metrics
    state.update_metric("system_info_requests_total", MetricValue::Counter(1));
    state.update_metric(
        "system_info_duration_ms",
        MetricValue::Gauge(execution_time.as_millis() as f64),
    );

    // Send event
    let event = SystemEvent::ToolCalled {
        name: "system_info".to_string(),
        id: tool_call.id,
    };

    if let Err(e) = state.event_tx.send(event) {
        warn!("Failed to send event: {}", e);
    }

    Ok(serde_json::to_string_pretty(&result)?)
}

pub fn get_cpu_info(sys: &System) -> Result<serde_json::Value> {
    let cpus = sys.cpus();
    let cpu_info: Vec<serde_json::Value> = cpus
        .iter()
        .map(|cpu| {
            serde_json::json!({
                "name": cpu.name(),
                "vendor_id": cpu.vendor_id(),
                "brand": cpu.brand(),
                "frequency": cpu.frequency(),
                "usage": cpu.cpu_usage()
            })
        })
        .collect();

    let load_avg = System::load_average();
    Ok(serde_json::json!({
        "type": "cpu",
        "cpu_count": cpus.len(),
        "cpus": cpu_info,
        "global_usage": sys.global_cpu_usage(),
        "load_average": {
            "one": load_avg.one,
            "five": load_avg.five,
            "fifteen": load_avg.fifteen
        }
    }))
}

pub fn get_memory_info(sys: &System) -> Result<serde_json::Value> {
    Ok(serde_json::json!({
        "type": "memory",
        "total_memory": sys.total_memory(),
        "available_memory": sys.available_memory(),
        "used_memory": sys.used_memory(),
        "free_memory": sys.free_memory(),
        "total_swap": sys.total_swap(),
        "used_swap": sys.used_swap(),
        "free_swap": sys.free_swap(),
        "memory_usage_percent": (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
    }))
}

pub fn get_disk_info(_sys: &System) -> Result<serde_json::Value> {
    let disks = Disks::new_with_refreshed_list();
    let disk_info: Vec<serde_json::Value> = disks.iter().map(|disk| {
        serde_json::json!({
            "name": disk.name().to_string_lossy(),
            "file_system": disk.file_system().to_string_lossy(),
            "type": format!("{:?}", disk.kind()),
            "mount_point": disk.mount_point().display().to_string(),
            "total_space": disk.total_space(),
            "available_space": disk.available_space(),
            "used_space": disk.total_space() - disk.available_space(),
            "is_removable": disk.is_removable(),
            "usage_percent": if disk.total_space() > 0 {
                ((disk.total_space() - disk.available_space()) as f64 / disk.total_space() as f64) * 100.0
            } else {
                0.0
            }
        })
    }).collect();

    Ok(serde_json::json!({
        "type": "disk",
        "disk_count": disk_info.len(),
        "disks": disk_info
    }))
}

pub fn get_network_info(_sys: &System) -> Result<serde_json::Value> {
    let networks = Networks::new_with_refreshed_list();
    let network_info: Vec<serde_json::Value> = networks
        .iter()
        .map(|(name, network)| {
            serde_json::json!({
                "name": name,
                "received": network.total_received(),
                "transmitted": network.total_transmitted(),
                "packets_received": network.total_packets_received(),
                "packets_transmitted": network.total_packets_transmitted(),
                "errors_on_received": network.total_errors_on_received(),
                "errors_on_transmitted": network.total_errors_on_transmitted()
            })
        })
        .collect();

    Ok(serde_json::json!({
        "type": "network",
        "interface_count": network_info.len(),
        "interfaces": network_info
    }))
}

pub fn get_process_info(sys: &System) -> Result<serde_json::Value> {
    let mut processes: Vec<serde_json::Value> = sys
        .processes()
        .iter()
        .map(|(pid, process)| {
            serde_json::json!({
                "pid": pid.as_u32(),
                "name": process.name().to_string_lossy().to_string(),
                "cmd": process.cmd().iter().map(|s| s.to_string_lossy().to_string()).collect::<Vec<_>>(),
                "exe": process.exe().map(|p| p.display().to_string()),
                "cwd": process.cwd().map(|p| p.display().to_string()),
                "memory": process.memory(),
                "virtual_memory": process.virtual_memory(),
                "cpu_usage": process.cpu_usage(),
                "status": format!("{:?}", process.status()),
                "start_time": process.start_time()
            })
        })
        .collect();

    // Sort by CPU usage (descending) and limit to top 20
    processes.sort_by(|a, b| {
        let cpu_a = a["cpu_usage"].as_f64().unwrap_or(0.0);
        let cpu_b = b["cpu_usage"].as_f64().unwrap_or(0.0);
        cpu_b
            .partial_cmp(&cpu_a)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    processes.truncate(20);

    Ok(serde_json::json!({
        "type": "processes",
        "total_processes": sys.processes().len(),
        "top_processes": processes
    }))
}

pub fn get_all_info(sys: &System) -> Result<serde_json::Value> {
    Ok(serde_json::json!({
        "type": "all",
        "timestamp": Utc::now().to_rfc3339(),
        "system_name": System::name(),
        "kernel_version": System::kernel_version(),
        "os_version": System::os_version(),
        "host_name": System::host_name(),
        "cpu": get_cpu_info(sys)?,
        "memory": get_memory_info(sys)?,
        "disk": get_disk_info(sys)?,
        "network": get_network_info(sys)?,
        "processes": get_process_info(sys)?
    }))
}
