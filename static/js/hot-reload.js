/**
 * Hot-reload client for development mode
 * Establishes WebSocket connection and listens for reload events
 */

(function() {
    // Only initialize if we're in dev mode (check for dev flag in page)
    const devModeIndicator = document.querySelector('[data-dev-mode="true"]');
    if (!devModeIndicator) return;

    let ws;
    let reconnectInterval;
    let isReloading = false;

    function connect() {
        // Determine WebSocket URL based on current location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('🔥 Hot-reload: Connecting to', wsUrl);
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = function() {
            console.log('✅ Hot-reload: Connected');
            clearInterval(reconnectInterval);
            
            // Show notification
            if (window.Alpine && window.Alpine.store('notifications')) {
                window.Alpine.store('notifications').add('Hot-reload connected', 'success');
            }
        };
        
        ws.onmessage = function(event) {
            try {
                const message = JSON.parse(event.data);
                
                // Check if this is a reload message
                if (message.type === 'reload' && message.action === 'refresh' && !isReloading) {
                    isReloading = true;
                    console.log('🔄 Hot-reload: Reloading page...');
                    
                    // Show notification before reload
                    if (window.Alpine && window.Alpine.store('notifications')) {
                        window.Alpine.store('notifications').add('File changes detected - reloading...', 'info');
                    }
                    
                    // Small delay to show notification
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }
            } catch (e) {
                console.error('Hot-reload: Error parsing message', e);
            }
        };
        
        ws.onerror = function(error) {
            console.error('❌ Hot-reload: WebSocket error', error);
        };
        
        ws.onclose = function() {
            console.log('🔌 Hot-reload: Disconnected');
            ws = null;
            
            // Try to reconnect every 2 seconds
            if (!reconnectInterval && !isReloading) {
                reconnectInterval = setInterval(() => {
                    console.log('🔄 Hot-reload: Attempting to reconnect...');
                    connect();
                }, 2000);
            }
        };
    }

    // Initial connection
    connect();

    // Clean up on page unload
    window.addEventListener('beforeunload', function() {
        if (ws) {
            ws.close();
        }
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
        }
    });

    // Expose connection status for debugging
    window.__hotReload = {
        get connected() {
            return ws && ws.readyState === WebSocket.OPEN;
        },
        reconnect: function() {
            if (ws) ws.close();
            connect();
        }
    };
})();