use actix_web::test;
use actix_web::{web, App};
use rust_mcp_server::dashboard::websocket::websocket_handler;
use rust_mcp_server::shared::{config::Config, state::AppState};

/// Test WebSocket origin validation in production mode
#[actix_web::test]
async fn test_websocket_origin_validation_production() {
    let state = AppState::new();
    let mut config = Config::default();
    config.development.enable_cors = false; // Production mode
    config.security.websocket_allowed_origins = vec![
        "http://localhost:8080".to_string(),
        "http://127.0.0.1:8080".to_string(),
    ];

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .app_data(web::Data::new(config))
            .route("/ws", web::get().to(websocket_handler)),
    )
    .await;

    // Test allowed origin
    let req = test::TestRequest::get()
        .uri("/ws")
        .insert_header(("Origin", "http://localhost:8080"))
        .insert_header(("Upgrade", "websocket"))
        .insert_header(("Connection", "Upgrade"))
        .insert_header(("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ=="))
        .insert_header(("Sec-WebSocket-Version", "13"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success() || resp.status().as_u16() == 101); // 101 = Switching Protocols

    // Test disallowed origin
    let req = test::TestRequest::get()
        .uri("/ws")
        .insert_header(("Origin", "http://malicious.com"))
        .insert_header(("Upgrade", "websocket"))
        .insert_header(("Connection", "Upgrade"))
        .insert_header(("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ=="))
        .insert_header(("Sec-WebSocket-Version", "13"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), actix_web::http::StatusCode::FORBIDDEN);
}

/// Test WebSocket origin validation in development mode
#[actix_web::test]
async fn test_websocket_origin_validation_development() {
    let state = AppState::new();
    let mut config = Config::default();
    config.development.enable_cors = true; // Development mode
    config.security.websocket_allowed_origins = vec!["http://localhost:8080".to_string()];

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .app_data(web::Data::new(config))
            .route("/ws", web::get().to(websocket_handler)),
    )
    .await;

    // Test that any origin is allowed in development mode
    let req = test::TestRequest::get()
        .uri("/ws")
        .insert_header(("Origin", "http://malicious.com"))
        .insert_header(("Upgrade", "websocket"))
        .insert_header(("Connection", "Upgrade"))
        .insert_header(("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ=="))
        .insert_header(("Sec-WebSocket-Version", "13"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success() || resp.status().as_u16() == 101); // 101 = Switching Protocols
}

/// Test WebSocket connection without Origin header
#[actix_web::test]
async fn test_websocket_no_origin_header() {
    let state = AppState::new();
    let mut config = Config::default();
    config.development.enable_cors = false; // Production mode
    config.security.websocket_allowed_origins = vec!["http://localhost:8080".to_string()];

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .app_data(web::Data::new(config))
            .route("/ws", web::get().to(websocket_handler)),
    )
    .await;

    // Test request without Origin header
    let req = test::TestRequest::get()
        .uri("/ws")
        .insert_header(("Upgrade", "websocket"))
        .insert_header(("Connection", "Upgrade"))
        .insert_header(("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ=="))
        .insert_header(("Sec-WebSocket-Version", "13"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), actix_web::http::StatusCode::FORBIDDEN);
}

/// Test WebSocket origin validation with multiple allowed origins
#[actix_web::test]
async fn test_websocket_multiple_allowed_origins() {
    let state = AppState::new();
    let mut config = Config::default();
    config.development.enable_cors = false; // Production mode
    config.security.websocket_allowed_origins = vec![
        "http://localhost:8080".to_string(),
        "http://127.0.0.1:8080".to_string(),
        "https://example.com".to_string(),
    ];

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .app_data(web::Data::new(config))
            .route("/ws", web::get().to(websocket_handler)),
    )
    .await;

    // Test each allowed origin
    let allowed_origins = vec![
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://example.com",
    ];

    for origin in allowed_origins {
        let req = test::TestRequest::get()
            .uri("/ws")
            .insert_header(("Origin", origin))
            .insert_header(("Upgrade", "websocket"))
            .insert_header(("Connection", "Upgrade"))
            .insert_header(("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ=="))
            .insert_header(("Sec-WebSocket-Version", "13"))
            .to_request();

        let resp = test::call_service(&app, req).await;
        assert!(
            resp.status().is_success() || resp.status().as_u16() == 101,
            "Origin {} should be allowed",
            origin
        );
    }

    // Test disallowed origin
    let req = test::TestRequest::get()
        .uri("/ws")
        .insert_header(("Origin", "http://malicious.com"))
        .insert_header(("Upgrade", "websocket"))
        .insert_header(("Connection", "Upgrade"))
        .insert_header(("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ=="))
        .insert_header(("Sec-WebSocket-Version", "13"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), actix_web::http::StatusCode::FORBIDDEN);
}

/// Test WebSocket origin validation with environment variable configuration
#[actix_web::test]
async fn test_websocket_origin_environment_config() {
    // Set environment variable for allowed origins
    std::env::set_var(
        "WEBSOCKET_ALLOWED_ORIGINS",
        "http://localhost:3000,https://app.example.com",
    );

    let config = Config::from_env().expect("Failed to parse config from environment");

    assert_eq!(
        config.security.websocket_allowed_origins,
        vec![
            "http://localhost:3000".to_string(),
            "https://app.example.com".to_string(),
        ]
    );

    // Clean up
    std::env::remove_var("WEBSOCKET_ALLOWED_ORIGINS");
}

/// Test WebSocket origin validation with case sensitivity
#[actix_web::test]
async fn test_websocket_origin_case_sensitivity() {
    let state = AppState::new();
    let mut config = Config::default();
    config.development.enable_cors = false; // Production mode
    config.security.websocket_allowed_origins = vec!["http://localhost:8080".to_string()];

    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(state))
            .app_data(web::Data::new(config))
            .route("/ws", web::get().to(websocket_handler)),
    )
    .await;

    // Test request with different case
    let req = test::TestRequest::get()
        .uri("/ws")
        .insert_header(("Origin", "HTTP://LOCALHOST:8080")) // Different case
        .insert_header(("Upgrade", "websocket"))
        .insert_header(("Connection", "Upgrade"))
        .insert_header(("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ=="))
        .insert_header(("Sec-WebSocket-Version", "13"))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), actix_web::http::StatusCode::FORBIDDEN);
}
