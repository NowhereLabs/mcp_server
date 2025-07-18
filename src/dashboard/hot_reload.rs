use std::path::Path;
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult};
use tokio::sync::broadcast;

use crate::shared::{config::Config, state::AppState};

#[derive(Debug, Clone)]
pub enum ReloadEvent {
    FrontendChanged,
    BackendChanged,
}

pub struct HotReloadWatcher {
    state: AppState,
    reload_tx: broadcast::Sender<ReloadEvent>,
    config: Config,
}

impl HotReloadWatcher {
    pub fn new(state: AppState, config: Config) -> (Self, broadcast::Receiver<ReloadEvent>) {
        let (reload_tx, reload_rx) = broadcast::channel(100);

        (
            Self {
                state,
                reload_tx,
                config,
            },
            reload_rx,
        )
    }

    pub async fn start(
        &self,
        mut shutdown_rx: tokio::sync::oneshot::Receiver<()>,
    ) -> anyhow::Result<()> {
        let reload_tx = self.reload_tx.clone();
        let _state = self.state.clone();
        let debounce_ms = self.config.development.hot_reload_debounce_ms;

        // Create debounced watcher with configurable timing
        let mut debouncer = new_debouncer(
            Duration::from_millis(debounce_ms),
            move |res: DebounceEventResult| {
                match res {
                    Ok(events) => {
                        for event in events {
                            let path = event.path.to_string_lossy();

                            // Determine reload type based on file extension
                            let reload_event = if path.ends_with(".rs") {
                                ReloadEvent::BackendChanged
                            } else if path.ends_with(".js")
                                || path.ends_with(".ts")
                                || path.ends_with(".css")
                                || path.ends_with(".html")
                                || path.ends_with(".askama")
                            {
                                ReloadEvent::FrontendChanged
                            } else {
                                continue;
                            };

                            // Send reload event
                            if let Err(e) = reload_tx.send(reload_event.clone()) {
                                tracing::debug!("No active reload listeners: {}", e);
                            } else {
                                tracing::info!(
                                    "🔄 Detected change in {:?}, triggering reload",
                                    path
                                );
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("File watch error: {:?}", e);
                    }
                }
            },
        )
        .expect("Failed to create file watcher");

        // Watch directories
        let watcher = debouncer.watcher();

        // Watch frontend directories
        let _ = watcher.watch(Path::new("./static"), RecursiveMode::Recursive);
        let _ = watcher.watch(Path::new("./templates"), RecursiveMode::Recursive);
        let _ = watcher.watch(Path::new("./config"), RecursiveMode::Recursive);

        // Watch Rust source (for informational purposes - won't auto-reload)
        let _ = watcher.watch(Path::new("./src"), RecursiveMode::Recursive);

        tracing::info!("📁 File watcher started for hot-reload");

        // Keep the watcher alive with graceful shutdown
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => {
                    tracing::info!("🔄 Shutting down hot-reload watcher");
                    break;
                }
                _ = tokio::time::sleep(Duration::from_secs(1)) => {
                    // Keep alive
                }
            }
        }

        Ok(())
    }
}

// WebSocket message to trigger browser reload
#[derive(serde::Serialize)]
pub struct BrowserReloadMessage {
    pub r#type: String,
    pub action: String,
}

impl BrowserReloadMessage {
    pub fn reload() -> Self {
        Self {
            r#type: "reload".to_string(),
            action: "refresh".to_string(),
        }
    }
}
