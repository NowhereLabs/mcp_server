use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::timeout;

fn unique_image_name(base: &str) -> String {
    use std::process;
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    
    let pid = process::id();
    
    // Add thread ID to further differentiate
    let thread_id = std::thread::current().id();
    
    // Create a hash of the combination
    let mut hasher = DefaultHasher::new();
    timestamp.hash(&mut hasher);
    pid.hash(&mut hasher);
    thread_id.hash(&mut hasher);
    let hash = hasher.finish();
    
    format!("{}-{}-{}", base, timestamp, hash)
}

fn cleanup_docker_resources(image_name: &str, container_name: Option<&str>) {
    // Stop and remove container if specified
    if let Some(container) = container_name {
        let _ = Command::new("docker")
            .args(&["stop", container])
            .output();
        let _ = Command::new("docker")
            .args(&["rm", "-f", container])
            .output();
    }
    
    // Remove image with force
    let _ = Command::new("docker")
        .args(&["rmi", "-f", image_name])
        .output();
    
    // Prune build cache to prevent conflicts
    let _ = Command::new("docker")
        .args(&["builder", "prune", "-f"])
        .output();
}

#[tokio::test]
async fn test_docker_build_succeeds() {
    let image_name = unique_image_name("rust-mcp-server-test");

    // Clean up any existing resources first
    cleanup_docker_resources(&image_name, None);

    let output = Command::new("docker")
        .args(&["build", "--no-cache", "-f", "docker/Dockerfile", "-t", &image_name, "."])
        .output()
        .expect("Failed to execute docker build command");

    // Clean up after test
    cleanup_docker_resources(&image_name, None);

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

    // Clean up any existing resources first
    cleanup_docker_resources(&image_name, Some(&container_name));

    // Build the image first
    println!("Building Docker image: {}", image_name);
    let build_output = Command::new("docker")
        .args(&[
            "build",
            "--no-cache",
            "-f",
            "docker/Dockerfile",
            "-t",
            &image_name,
            ".",
        ])
        .output()
        .expect("Failed to execute docker build command");

    if !build_output.status.success() {
        eprintln!(
            "Docker build stderr: {}",
            String::from_utf8_lossy(&build_output.stderr)
        );
        eprintln!(
            "Docker build stdout: {}",
            String::from_utf8_lossy(&build_output.stdout)
        );
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

    // Cleanup: Stop and remove container and image
    cleanup_docker_resources(&image_name, Some(&container_name));

    assert!(
        health_check.is_ok(),
        "Container did not respond to health check within timeout"
    );
}

#[tokio::test]
async fn test_docker_container_runs_with_correct_uid() {
    let image_name = unique_image_name("rust-mcp-server-test-uid");

    // Clean up any existing resources first
    cleanup_docker_resources(&image_name, None);

    // Build the image first
    let build_output = Command::new("docker")
        .args(&["build", "--no-cache", "-f", "docker/Dockerfile", "-t", &image_name, "."])
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
    cleanup_docker_resources(&image_name, None);

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
        .args(&[
            "compose",
            "-f",
            "docker/docker-compose.yml",
            "build",
            "mcp-server",
        ])
        .output()
        .or_else(|_| {
            Command::new("docker-compose")
                .args(&["-f", "docker/docker-compose.yml", "build", "mcp-server"])
                .output()
        })
        .expect("Failed to execute docker compose build command");

    // Cleanup: Remove any created images
    let _ = Command::new("docker")
        .args(&[
            "compose",
            "-f",
            "docker/docker-compose.yml",
            "down",
            "--rmi",
            "all",
        ])
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

    // Clean up any existing resources first
    cleanup_docker_resources(&image_name, None);

    // Build the image first
    let build_output = Command::new("docker")
        .args(&["build", "--no-cache", "-f", "docker/Dockerfile", "-t", &image_name, "."])
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
    cleanup_docker_resources(&image_name, None);

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
