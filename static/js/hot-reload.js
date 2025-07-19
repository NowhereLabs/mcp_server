"use strict";
(() => {
  (function() {
    const devModeIndicator = document.querySelector('[data-dev-mode="true"]');
    if (!devModeIndicator)
      return;
    const ErrorHandler = window.ErrorHandler || {
      processError: (error, component, context) => {
        console.error(`[${component}] ${context}:`, error);
        return error;
      },
      createNetworkError: (message, details) => new Error(message),
      createSystemError: (message, details) => new Error(message)
    };
    let ws = null;
    let reconnectInterval = null;
    let isReloading = false;
    let connectionAttempts = 0;
    const maxReconnectAttempts = 10;
    const reconnectDelay = 1e3;
    const maxReconnectDelay = 3e4;
    let isConnected = false;
    let lastError = null;
    let healthCheckInterval = null;
    function getReconnectDelay(attempt) {
      const delay = Math.min(reconnectDelay * Math.pow(2, attempt), maxReconnectDelay);
      return delay + Math.random() * 1e3;
    }
    function showNotification(message, type = "info", duration = 5e3) {
      if (window.Alpine && window.Alpine.store) {
        try {
          const notificationStore = window.Alpine.store("notifications");
          if (notificationStore && typeof notificationStore.add === "function") {
            notificationStore.add(message, type, duration);
          }
        } catch (error) {
          console.warn("Failed to show notification:", error);
        }
      }
    }
    function handleConnectionError(error, context) {
      lastError = error;
      const standardError = ErrorHandler.processError(error, "hot-reload", context);
      let userMessage = "Hot-reload connection lost";
      let notificationType = "warning";
      switch (context) {
        case "connection_failed":
          userMessage = "Failed to connect to hot-reload server";
          notificationType = "error";
          break;
        case "connection_lost":
          userMessage = "Hot-reload connection lost - attempting to reconnect...";
          notificationType = "warning";
          break;
        case "reconnect_failed":
          userMessage = "Failed to reconnect to hot-reload server";
          notificationType = "error";
          break;
        case "max_attempts_reached":
          userMessage = "Hot-reload unavailable - too many connection attempts";
          notificationType = "error";
          break;
      }
      showNotification(userMessage, notificationType);
      return standardError;
    }
    function parseMessage(data) {
      try {
        const message = JSON.parse(data);
        if (!message || typeof message !== "object") {
          throw new Error("Invalid message format");
        }
        return message;
      } catch (error) {
        ErrorHandler.processError(error, "hot-reload", "message_parsing");
        return null;
      }
    }
    function handleReloadEvent(message) {
      if (isReloading)
        return;
      isReloading = true;
      console.log("\u{1F504} Hot-reload: File changes detected, reloading page...");
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
      }
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      showNotification("File changes detected - reloading...", "info", 1e3);
      setTimeout(() => {
        try {
          window.location.reload();
        } catch (error) {
          ErrorHandler.processError(error, "hot-reload", "page_reload");
          isReloading = false;
        }
      }, 500);
    }
    function startHealthCheck() {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
      }
      healthCheckInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch (error) {
            console.warn("Hot-reload: Failed to send ping", error);
          }
        }
      }, 3e4);
    }
    function stopHealthCheck() {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
      }
    }
    function connect() {
      if (connectionAttempts >= maxReconnectAttempts) {
        handleConnectionError(
          new Error(`Max reconnection attempts (${maxReconnectAttempts}) exceeded`),
          "max_attempts_reached"
        );
        return;
      }
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`\u{1F525} Hot-reload: Connecting to ${wsUrl} (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`);
      try {
        ws = new WebSocket(wsUrl);
        const connectionTimeout = setTimeout(() => {
          if (ws && ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            handleConnectionError(new Error("Connection timeout"), "connection_timeout");
          }
        }, 1e4);
        ws.onopen = function() {
          console.log("\u2705 Hot-reload: Connected successfully");
          clearTimeout(connectionTimeout);
          connectionAttempts = 0;
          isConnected = true;
          lastError = null;
          if (reconnectInterval) {
            clearTimeout(reconnectInterval);
            reconnectInterval = null;
          }
          startHealthCheck();
          showNotification("Hot-reload connected", "success", 3e3);
        };
        ws.onmessage = function(event) {
          const message = parseMessage(event.data);
          if (!message)
            return;
          switch (message.type) {
            case "reload":
              if (message.action === "refresh") {
                handleReloadEvent(message);
              }
              break;
            case "pong":
              console.debug("Hot-reload: Received pong");
              break;
            case "error":
              ErrorHandler.processError(
                ErrorHandler.createSystemError(message.message || "Server error"),
                "hot-reload",
                "server_error"
              );
              break;
            default:
              console.debug("Hot-reload: Received unknown message type:", message.type);
          }
        };
        ws.onerror = function(error) {
          clearTimeout(connectionTimeout);
          isConnected = false;
          const errorMessage = "WebSocket connection error";
          handleConnectionError(
            ErrorHandler.createNetworkError(errorMessage, { url: wsUrl }),
            "connection_error"
          );
        };
        ws.onclose = function(event) {
          clearTimeout(connectionTimeout);
          isConnected = false;
          stopHealthCheck();
          console.log("\u{1F50C} Hot-reload: Connection closed", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          ws = null;
          if (isReloading || event.wasClean) {
            return;
          }
          let errorContext = "connection_lost";
          if (event.code === 1006) {
            errorContext = "connection_lost";
          } else if (event.code === 1e3) {
            return;
          } else if (event.code === 1003) {
            errorContext = "protocol_error";
          } else if (event.code === 1011) {
            errorContext = "server_error";
          }
          handleConnectionError(
            ErrorHandler.createNetworkError(`Connection closed: ${event.reason || event.code}`, {
              code: event.code,
              reason: event.reason
            }),
            errorContext
          );
          scheduleReconnect();
        };
      } catch (error) {
        handleConnectionError(error, "connection_failed");
        scheduleReconnect();
      }
    }
    function scheduleReconnect() {
      if (reconnectInterval || isReloading)
        return;
      connectionAttempts++;
      const delay = getReconnectDelay(connectionAttempts - 1);
      console.log(`\u{1F504} Hot-reload: Scheduling reconnection in ${Math.round(delay / 1e3)}s (attempt ${connectionAttempts}/${maxReconnectAttempts})`);
      reconnectInterval = setTimeout(() => {
        reconnectInterval = null;
        if (!isReloading) {
          connect();
        }
      }, delay);
    }
    connect();
    window.addEventListener("beforeunload", function() {
      isReloading = true;
      if (ws) {
        ws.close(1e3, "Page unloading");
      }
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
      }
      stopHealthCheck();
    });
    const hotReloadDebug = {
      get connected() {
        return ws ? ws.readyState === WebSocket.OPEN : false;
      },
      get connectionState() {
        if (!ws)
          return "disconnected";
        switch (ws.readyState) {
          case WebSocket.CONNECTING:
            return "connecting";
          case WebSocket.OPEN:
            return "open";
          case WebSocket.CLOSING:
            return "closing";
          case WebSocket.CLOSED:
            return "closed";
          default:
            return "unknown";
        }
      },
      get connectionAttempts() {
        return connectionAttempts;
      },
      get lastError() {
        return lastError;
      },
      get isReloading() {
        return isReloading;
      },
      reconnect() {
        console.log("\u{1F504} Hot-reload: Manual reconnection requested");
        connectionAttempts = 0;
        if (ws)
          ws.close();
        if (reconnectInterval) {
          clearTimeout(reconnectInterval);
          reconnectInterval = null;
        }
        connect();
      },
      disconnect() {
        console.log("\u{1F50C} Hot-reload: Manual disconnection requested");
        if (ws)
          ws.close(1e3, "Manual disconnect");
        if (reconnectInterval) {
          clearTimeout(reconnectInterval);
          reconnectInterval = null;
        }
        stopHealthCheck();
      },
      getStats() {
        return {
          connected: this.connected,
          connectionState: this.connectionState,
          connectionAttempts: this.connectionAttempts,
          lastError: this.lastError,
          isReloading: this.isReloading,
          maxReconnectAttempts,
          reconnectDelay,
          maxReconnectDelay
        };
      }
    };
    window.__hotReload = hotReloadDebug;
    console.log("\u{1F525} Hot-reload client initialized");
  })();
})();
