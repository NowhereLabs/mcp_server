use std::path::Path;
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult};
use tokio::sync::broadcast;

use crate::shared::state::AppState;

#[derive(Debug, Clone)]
pub enum ReloadEvent {
    FrontendChanged,
    BackendChanged,
}

pub struct HotReloadWatcher {
    state: AppState,
    reload_tx: broadcast::Sender<ReloadEvent>,
}

impl HotReloadWatcher {
    pub fn new(state: AppState) -> (Self, broadcast::Receiver<ReloadEvent>) {
        let (reload_tx, reload_rx) = broadcast::channel(100);

        (Self { state, reload_tx }, reload_rx)
    }

    pub async fn start(&self) -> anyhow::Result<()> {
        let reload_tx = self.reload_tx.clone();
        let _state = self.state.clone();

        // Spawn blocking thread for file watching
        tokio::task::spawn_blocking(move || {
            let reload_tx = reload_tx.clone();

            // Create debounced watcher (waits 500ms after last change)
            let mut debouncer = new_debouncer(
                Duration::from_millis(500),
                move |res: DebounceEventResult| {
                    match res {
                        Ok(events) => {
                            for event in events {
                                let path = event.path.to_string_lossy();

                                // Determine reload type based on file extension
                                let reload_event = if path.ends_with(".rs") {
                                    ReloadEvent::BackendChanged
                                } else if path.ends_with(".js")
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

            // Keep the watcher alive
            loop {
                std::thread::sleep(Duration::from_secs(1));
            }
        });

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
