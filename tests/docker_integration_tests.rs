use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::timeout;

fn unique_image_name(base: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    format!("{}-{}", base, timestamp)
}

#[tokio::test]
async fn test_docker_build_succeeds() {
    let image_name = unique_image_name("rust-mcp-server-test");

    let output = Command::new("docker")
        .args(&["build", "-f", "docker/Dockerfile", "-t", &image_name, "."])
        .output()
        .expect("Failed to execute docker build command");

    // Clean up after test
    let _ = Command::new("docker")
        .args(&["rmi", "-f", &image_name])
        .output();

    assert!(
        output.status.success(),
        "Docker build failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[tokio::test]
async fn test_docker_container_starts_and_responds() {
    let image_name = unique_image_name("rust-mcp-server-test");
    let container_name = unique_image_name("rust-mcp-server-test-container");

    // Build the image first
    println!("Building Docker image: {}", image_name);
    let build_output = Command::new("docker")
        .args(&["build", "-f", "docker/Dockerfile", "-t", &image_name, "."])
        .output()
        .expect("Failed to execute docker build command");

    if !build_output.status.success() {
        eprintln!("Docker build stderr: {}", String::from_utf8_lossy(&build_output.stderr));
        eprintln!("Docker build stdout: {}", String::from_utf8_lossy(&build_output.stdout));
    }

    assert!(
        build_output.status.success(),
        "Docker build failed: {}",
        String::from_utf8_lossy(&build_output.stderr)
    );
    
    // Verify image exists
    let image_check = Command::new("docker")
        .args(&["images", "-q", &image_name])
        .output()
        .expect("Failed to check docker images");
    
    assert!(
        !image_check.stdout.is_empty(),
        "Docker image {} was not created",
        image_name
    );

    // Start the container
    let container_output = Command::new("docker")
        .args(&[
            "run",
            "-d",
            "--name",
            &container_name,
            "-p",
            "8081:8080",
            &image_name,
        ])
        .output()
        .expect("Failed to start docker container");

    assert!(
        container_output.status.success(),
        "Docker container failed to start: {}",
        String::from_utf8_lossy(&container_output.stderr)
    );

    // Wait for container to be ready
    tokio::time::sleep(Duration::from_secs(10)).await;

    // Test health endpoint
    let health_check = timeout(Duration::from_secs(30), async {
        let client = reqwest::Client::new();
        let mut attempts = 0;

        while attempts < 10 {
            if let Ok(response) = client.get("http://localhost:8081/health").send().await {
                if response.status().is_success() {
                    return Ok(());
                }
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
            attempts += 1;
        }

        Err("Health check failed after 10 attempts")
    })
    .await;

    // Cleanup: Stop and remove container
    let _ = Command::new("docker")
        .args(&["stop", &container_name])
        .output();

    let _ = Command::new("docker")
        .args(&["rm", &container_name])
        .output();

    // Remove test image
    let _ = Command::new("docker").args(&["rmi", &image_name]).output();

    assert!(
        health_check.is_ok(),
        "Container did not respond to health check within timeout"
    );
}

#[tokio::test]
async fn test_docker_container_runs_with_correct_uid() {
    let image_name = unique_image_name("rust-mcp-server-test-uid");

    // Build the image first
    let build_output = Command::new("docker")
        .args(&["build", "-f", "docker/Dockerfile", "-t", &image_name, "."])
        .output()
        .expect("Failed to execute docker build command");

    assert!(
        build_output.status.success(),
        "Docker build failed: {}",
        String::from_utf8_lossy(&build_output.stderr)
    );

    // Start the container and check the user ID
    let uid_check_output = Command::new("docker")
        .args(&["run", "--rm", &image_name, "id", "-u"])
        .output()
        .expect("Failed to check UID in container");

    // Remove test image
    let _ = Command::new("docker").args(&["rmi", &image_name]).output();

    assert!(
        uid_check_output.status.success(),
        "Failed to check UID in container: {}",
        String::from_utf8_lossy(&uid_check_output.stderr)
    );

    let uid_str = String::from_utf8_lossy(&uid_check_output.stdout);
    assert_eq!(
        uid_str.trim(),
        "1001",
        "Container is not running with UID 1001, got: {}",
        uid_str.trim()
    );
}

#[tokio::test]
async fn test_docker_compose_build_succeeds() {
    // Try docker compose (v2) first, fall back to docker-compose (v1)
    let output = Command::new("docker")
        .args(&["compose", "-f", "docker/docker-compose.yml", "build", "mcp-server"])
        .output()
        .or_else(|_| {
            Command::new("docker-compose")
                .args(&["-f", "docker/docker-compose.yml", "build", "mcp-server"])
                .output()
        })
        .expect("Failed to execute docker compose build command");

    // Cleanup: Remove any created images
    let _ = Command::new("docker")
        .args(&["compose", "-f", "docker/docker-compose.yml", "down", "--rmi", "all"])
        .output()
        .or_else(|_| {
            Command::new("docker-compose")
                .args(&["-f", "docker/docker-compose.yml", "down", "--rmi", "all"])
                .output()
        });

    assert!(
        output.status.success(),
        "Docker compose build failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[tokio::test]
async fn test_docker_file_permissions() {
    let image_name = unique_image_name("rust-mcp-server-test-perms");

    // Build the image first
    let build_output = Command::new("docker")
        .args(&["build", "-f", "docker/Dockerfile", "-t", &image_name, "."])
        .output()
        .expect("Failed to execute docker build command");

    assert!(
        build_output.status.success(),
        "Docker build failed: {}",
        String::from_utf8_lossy(&build_output.stderr)
    );

    // Check file permissions in container
    let perms_check_output = Command::new("docker")
        .args(&["run", "--rm", &image_name, "ls", "-la", "/app"])
        .output()
        .expect("Failed to check file permissions in container");

    // Remove test image
    let _ = Command::new("docker").args(&["rmi", &image_name]).output();

    assert!(
        perms_check_output.status.success(),
        "Failed to check file permissions in container: {}",
        String::from_utf8_lossy(&perms_check_output.stderr)
    );

    let perms_str = String::from_utf8_lossy(&perms_check_output.stdout);

    // Check that files are owned by the correct user (mcpuser with UID 1001)
    assert!(
        perms_str.contains("mcpuser"),
        "Files are not owned by mcpuser: {}",
        perms_str
    );
}
