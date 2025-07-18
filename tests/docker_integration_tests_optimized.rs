use std::process::Command;
use std::sync::Once;
use tokio::time::{timeout, Duration};

static INIT: Once = Once::new();
static TEST_IMAGE_NAME: &str = "rust-mcp-server-test-shared";

// Build the test image once and reuse it across all tests
fn ensure_test_image_built() {
    INIT.call_once(|| {
        println!("Building shared test Docker image (this may take a few minutes)...");

        // Remove existing test image
        let _ = Command::new("docker")
            .args(&["rmi", "-f", TEST_IMAGE_NAME])
            .output();

        let output = Command::new("docker")
            .args(&[
                "build",
                "-f",
                "docker/Dockerfile.test",
                "-t",
                TEST_IMAGE_NAME,
                ".",
                "--quiet", // Reduce output noise
            ])
            .output()
            .expect("Failed to execute docker build command");

        if !output.status.success() {
            panic!(
                "Failed to build shared test image: {}",
                String::from_utf8_lossy(&output.stderr)
            );
        }

        println!("Shared test image built successfully!");
    });
}

#[tokio::test]
async fn test_docker_image_builds_successfully() {
    ensure_test_image_built();

    // Verify the image exists
    let output = Command::new("docker")
        .args(&["images", "-q", TEST_IMAGE_NAME])
        .output()
        .expect("Failed to check docker images");

    assert!(
        !output.stdout.is_empty(),
        "Test Docker image {} was not found",
        TEST_IMAGE_NAME
    );
}

#[tokio::test]
async fn test_docker_container_starts_and_responds() {
    ensure_test_image_built();

    let container_name = format!("{}-container-{}", TEST_IMAGE_NAME, std::process::id());

    // Clean up any existing container with the same name
    let _ = Command::new("docker")
        .args(&["rm", "-f", &container_name])
        .output();

    // Start the container
    let container_output = Command::new("docker")
        .args(&[
            "run",
            "-d",
            "--name",
            &container_name,
            "-p",
            "0:8080", // Use dynamic port allocation
            "-e",
            "DASHBOARD_HOST=0.0.0.0", // Bind to all interfaces for Docker
            TEST_IMAGE_NAME,
            "./rust-mcp-server",
            "--mode=dashboard", // Run in dashboard-only mode for testing
        ])
        .output()
        .expect("Failed to start docker container");

    if !container_output.status.success() {
        // Cleanup and fail
        let _ = Command::new("docker")
            .args(&["rm", "-f", &container_name])
            .output();
        panic!(
            "Docker container failed to start: {}",
            String::from_utf8_lossy(&container_output.stderr)
        );
    }

    // Get the dynamically allocated port
    let port_output = Command::new("docker")
        .args(&["port", &container_name, "8080"])
        .output()
        .expect("Failed to get container port");

    let port_str = String::from_utf8_lossy(&port_output.stdout);
    let port = port_str
        .trim()
        .split(':')
        .last()
        .unwrap_or("8080")
        .parse::<u16>()
        .unwrap_or(8080);

    // Wait for container to be ready with shorter timeout
    let health_check = timeout(Duration::from_secs(20), async {
        let client = reqwest::Client::new();
        let mut attempts = 0;

        // Give container a moment to start
        tokio::time::sleep(Duration::from_secs(3)).await;

        while attempts < 8 {
            if let Ok(response) = client
                .get(&format!("http://localhost:{}/health", port))
                .timeout(Duration::from_secs(2))
                .send()
                .await
            {
                if response.status().is_success() {
                    return Ok(());
                }
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
            attempts += 1;
        }

        Err("Health check failed after 8 attempts")
    })
    .await;

    // Cleanup: Stop and remove container
    let _ = Command::new("docker")
        .args(&["rm", "-f", &container_name])
        .output();

    assert!(
        health_check.is_ok(),
        "Container did not respond to health check within timeout: {:?}",
        health_check
    );
}

#[tokio::test]
async fn test_docker_container_runs_with_correct_uid() {
    ensure_test_image_built();

    // Start the container and check the user ID
    let uid_check_output = Command::new("docker")
        .args(&["run", "--rm", TEST_IMAGE_NAME, "id", "-u"])
        .output()
        .expect("Failed to check UID in container");

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
async fn test_docker_file_permissions() {
    ensure_test_image_built();

    // Check file permissions in container
    let perms_check_output = Command::new("docker")
        .args(&["run", "--rm", TEST_IMAGE_NAME, "ls", "-la", "/app"])
        .output()
        .expect("Failed to check file permissions in container");

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

#[tokio::test]
async fn test_docker_compose_integration() {
    // Test that docker-compose can work with our configuration
    // This is lighter weight than a full compose build

    let output = Command::new("docker")
        .args(&[
            "compose",
            "-f",
            "docker/docker-compose.yml",
            "config", // Just validate the compose file
        ])
        .output()
        .or_else(|_| {
            Command::new("docker-compose")
                .args(&["-f", "docker/docker-compose.yml", "config"])
                .output()
        })
        .expect("Failed to execute docker compose config command");

    assert!(
        output.status.success(),
        "Docker compose configuration is invalid: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

// Cleanup function that can be called at the end of test suite
#[tokio::test]
#[ignore] // Only run when explicitly requested with --ignored
async fn test_cleanup_docker_artifacts() {
    println!("Cleaning up test Docker artifacts...");

    // Remove test image
    let _ = Command::new("docker")
        .args(&["rmi", "-f", TEST_IMAGE_NAME])
        .output();

    // Clean up any leftover test containers
    let containers_output = Command::new("docker")
        .args(&[
            "ps",
            "-a",
            "--filter",
            &format!("name={}", TEST_IMAGE_NAME),
            "-q",
        ])
        .output()
        .expect("Failed to list containers");

    if !containers_output.stdout.is_empty() {
        let container_ids = String::from_utf8_lossy(&containers_output.stdout);
        for container_id in container_ids.trim().lines() {
            let _ = Command::new("docker")
                .args(&["rm", "-f", container_id])
                .output();
        }
    }

    println!("Docker cleanup completed!");
}
