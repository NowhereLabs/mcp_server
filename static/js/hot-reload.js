/**
 * Hot-reload client for development mode
 * Establishes WebSocket connection and listens for reload events
 * Uses advanced error handling and recovery mechanisms
 */

(function() {
    // Only initialize if we're in dev mode (check for dev flag in page)
    const devModeIndicator = document.querySelector('[data-dev-mode="true"]');
    if (!devModeIndicator) return;

    // Import error handling utilities if available
    const ErrorHandler = window.ErrorHandler || {
        processError: (error, component, context) => {
            console.error(`[${component}] ${context}:`, error);
            return error;
        },
        createNetworkError: (message, details) => new Error(message),
        createSystemError: (message, details) => new Error(message)
    };

    let ws;
    let reconnectInterval;
    let isReloading = false;
    let connectionAttempts = 0;
    let maxReconnectAttempts = 10;
    let reconnectDelay = 1000; // Start with 1 second
    let maxReconnectDelay = 30000; // Max 30 seconds
    let isConnected = false;
    let lastError = null;
    let healthCheckInterval;

    /**
     * Calculate exponential backoff delay with jitter
     * @param {number} attempt - Current attempt number
     * @returns {number} Delay in milliseconds
     */
    function getReconnectDelay(attempt) {
        // Exponential backoff with jitter
        const delay = Math.min(reconnectDelay * Math.pow(2, attempt), maxReconnectDelay);
        return delay + Math.random() * 1000; // Add jitter
    }

    /**
     * Show user-friendly error notification
     * @param {string} message - Error message
     * @param {string} type - Notification type
     * @param {number} duration - Duration in milliseconds
     */
    function showNotification(message, type = 'info', duration = 5000) {
        if (window.Alpine && window.Alpine.store('notifications')) {
            window.Alpine.store('notifications').add(message, type, duration);
        }
    }

    /**
     * Handle WebSocket connection errors
     * @param {Error} error - The error that occurred
     * @param {string} context - Context of the error
     */
    function handleConnectionError(error, context) {
        lastError = error;
        
        const standardError = ErrorHandler.processError(error, 'hot-reload', context);
        
        // Show user-friendly error message based on context
        let userMessage = 'Hot-reload connection lost';
        let notificationType = 'warning';
        
        switch (context) {
            case 'connection_failed':
                userMessage = 'Failed to connect to hot-reload server';
                notificationType = 'error';
                break;
            case 'connection_lost':
                userMessage = 'Hot-reload connection lost - attempting to reconnect...';
                notificationType = 'warning';
                break;
            case 'reconnect_failed':
                userMessage = 'Failed to reconnect to hot-reload server';
                notificationType = 'error';
                break;
            case 'max_attempts_reached':
                userMessage = 'Hot-reload unavailable - too many connection attempts';
                notificationType = 'error';
                break;
        }
        
        showNotification(userMessage, notificationType);
        
        return standardError;
    }

    /**
     * Parse and validate WebSocket messages
     * @param {string} data - Raw message data
     * @returns {Object|null} Parsed message or null if invalid
     */
    function parseMessage(data) {
        try {
            const message = JSON.parse(data);
            
            // Validate message structure
            if (!message || typeof message !== 'object') {
                throw new Error('Invalid message format');
            }
            
            return message;
        } catch (error) {
            ErrorHandler.processError(error, 'hot-reload', 'message_parsing');
            return null;
        }
    }

    /**
     * Handle successful reload event
     * @param {Object} message - Reload message
     */
    function handleReloadEvent(message) {
        if (isReloading) return;
        
        isReloading = true;
        console.log('🔄 Hot-reload: File changes detected, reloading page...');
        
        // Clear any existing intervals
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
        }
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
        }
        
        // Show notification before reload
        showNotification('File changes detected - reloading...', 'info', 1000);
        
        // Small delay to show notification
        setTimeout(() => {
            try {
                window.location.reload();
            } catch (error) {
                ErrorHandler.processError(error, 'hot-reload', 'page_reload');
                isReloading = false;
            }
        }, 500);
    }

    /**
     * Start health check ping to server
     */
    function startHealthCheck() {
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
        }
        
        healthCheckInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({ type: 'ping' }));
                } catch (error) {
                    console.warn('Hot-reload: Failed to send ping', error);
                }
            }
        }, 30000); // Ping every 30 seconds
    }

    /**
     * Stop health check
     */
    function stopHealthCheck() {
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
        }
    }

    /**
     * Establish WebSocket connection with error handling
     */
    function connect() {
        // Check if we've exceeded max attempts
        if (connectionAttempts >= maxReconnectAttempts) {
            handleConnectionError(
                new Error(`Max reconnection attempts (${maxReconnectAttempts}) exceeded`),
                'max_attempts_reached'
            );
            return;
        }

        // Determine WebSocket URL based on current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log(`🔥 Hot-reload: Connecting to ${wsUrl} (attempt ${connectionAttempts + 1}/${maxReconnectAttempts})`);
        
        try {
            ws = new WebSocket(wsUrl);
            
            // Set connection timeout
            const connectionTimeout = setTimeout(() => {
                if (ws && ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                    handleConnectionError(new Error('Connection timeout'), 'connection_timeout');
                }
            }, 10000); // 10 second timeout
            
            ws.onopen = function() {
                console.log('✅ Hot-reload: Connected successfully');
                
                // Clear timeout and reset connection state
                clearTimeout(connectionTimeout);
                connectionAttempts = 0;
                isConnected = true;
                lastError = null;
                
                // Clear any existing reconnect interval
                if (reconnectInterval) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                }
                
                // Start health check
                startHealthCheck();
                
                // Show success notification
                showNotification('Hot-reload connected', 'success', 3000);
            };
            
            ws.onmessage = function(event) {
                const message = parseMessage(event.data);
                if (!message) return;
                
                // Handle different message types
                switch (message.type) {
                    case 'reload':
                        if (message.action === 'refresh') {
                            handleReloadEvent(message);
                        }
                        break;
                    case 'pong':
                        // Health check response
                        console.debug('Hot-reload: Received pong');
                        break;
                    case 'error':
                        ErrorHandler.processError(
                            ErrorHandler.createSystemError(message.message || 'Server error'),
                            'hot-reload',
                            'server_error'
                        );
                        break;
                    default:
                        console.debug('Hot-reload: Received unknown message type:', message.type);
                }
            };
            
            ws.onerror = function(error) {
                clearTimeout(connectionTimeout);
                isConnected = false;
                
                const errorMessage = error.message || 'WebSocket connection error';
                handleConnectionError(
                    ErrorHandler.createNetworkError(errorMessage, { url: wsUrl }),
                    'connection_error'
                );
            };
            
            ws.onclose = function(event) {
                clearTimeout(connectionTimeout);
                isConnected = false;
                stopHealthCheck();
                
                console.log('🔌 Hot-reload: Connection closed', { 
                    code: event.code, 
                    reason: event.reason,
                    wasClean: event.wasClean
                });
                
                ws = null;
                
                // Don't try to reconnect if we're reloading or if it was a clean close
                if (isReloading || event.wasClean) {
                    return;
                }
                
                // Handle different close codes
                let errorContext = 'connection_lost';
                if (event.code === 1006) { // Abnormal closure
                    errorContext = 'connection_lost';
                } else if (event.code === 1000) { // Normal closure
                    return; // Don't reconnect on normal closure
                } else if (event.code === 1003) { // Unsupported data
                    errorContext = 'protocol_error';
                } else if (event.code === 1011) { // Server error
                    errorContext = 'server_error';
                }
                
                handleConnectionError(
                    ErrorHandler.createNetworkError(`Connection closed: ${event.reason || event.code}`, { 
                        code: event.code, 
                        reason: event.reason 
                    }),
                    errorContext
                );
                
                // Schedule reconnection
                scheduleReconnect();
            };
            
        } catch (error) {
            handleConnectionError(error, 'connection_failed');
            scheduleReconnect();
        }
    }

    /**
     * Schedule a reconnection attempt
     */
    function scheduleReconnect() {
        if (reconnectInterval || isReloading) return;
        
        connectionAttempts++;
        const delay = getReconnectDelay(connectionAttempts - 1);
        
        console.log(`🔄 Hot-reload: Scheduling reconnection in ${Math.round(delay/1000)}s (attempt ${connectionAttempts}/${maxReconnectAttempts})`);
        
        reconnectInterval = setTimeout(() => {
            reconnectInterval = null;
            if (!isReloading) {
                connect();
            }
        }, delay);
    }

    // Initial connection
    connect();

    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
        isReloading = true; // Prevent reconnection attempts
        
        if (ws) {
            ws.close(1000, 'Page unloading'); // Normal closure
        }
        if (reconnectInterval) {
            clearTimeout(reconnectInterval);
        }
        stopHealthCheck();
    });

    // Enhanced debugging interface
    window.__hotReload = {
        get connected() {
            return ws && ws.readyState === WebSocket.OPEN;
        },
        get connectionState() {
            if (!ws) return 'disconnected';
            switch (ws.readyState) {
                case WebSocket.CONNECTING: return 'connecting';
                case WebSocket.OPEN: return 'open';
                case WebSocket.CLOSING: return 'closing';
                case WebSocket.CLOSED: return 'closed';
                default: return 'unknown';
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
        reconnect: function() {
            console.log('🔄 Hot-reload: Manual reconnection requested');
            connectionAttempts = 0; // Reset attempts
            if (ws) ws.close();
            if (reconnectInterval) {
                clearTimeout(reconnectInterval);
                reconnectInterval = null;
            }
            connect();
        },
        disconnect: function() {
            console.log('🔌 Hot-reload: Manual disconnection requested');
            if (ws) ws.close(1000, 'Manual disconnect');
            if (reconnectInterval) {
                clearTimeout(reconnectInterval);
                reconnectInterval = null;
            }
            stopHealthCheck();
        },
        getStats: function() {
            return {
                connected: this.connected,
                connectionState: this.connectionState,
                connectionAttempts: this.connectionAttempts,
                lastError: this.lastError,
                isReloading: this.isReloading,
                maxReconnectAttempts: maxReconnectAttempts,
                reconnectDelay: reconnectDelay,
                maxReconnectDelay: maxReconnectDelay
            };
        }
    };

    // Log initialization
    console.log('🔥 Hot-reload client initialized');
})();