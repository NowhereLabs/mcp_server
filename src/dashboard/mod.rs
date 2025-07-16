//! Real-time web dashboard for MCP server monitoring.
//!
//! Provides a web interface built with Actix Web, featuring WebSocket
//! support for live updates and RESTful APIs for metrics and status.

pub mod handlers;
pub mod server;
pub mod websocket;
