// HTMX-Alpine.js Bridge Component
export function initializeHtmxAlpineBridge() {
    // HTMX to Alpine.js event bridge
    document.body.addEventListener('htmx:afterSwap', function(event) {
        const target = event.detail.target;
        
        // Update metrics store when metrics endpoint responds
        if (target.id === 'metrics-data') {
            try {
                const data = JSON.parse(event.detail.xhr.response);
                Alpine.store('metrics').update(data);
            } catch (error) {
                console.error('Error parsing metrics data:', error);
                Alpine.store('notifications').add('Error updating metrics', 'error');
            }
        }
        
        // Handle status updates
        if (target.id === 'status-data') {
            try {
                const data = JSON.parse(event.detail.xhr.response);
                Alpine.store('status').update(data);
            } catch (error) {
                console.error('Error parsing status data:', error);
            }
        }
        
        // Handle tool calls updates
        if (target.id === 'tool-calls-data') {
            try {
                const data = JSON.parse(event.detail.xhr.response);
                Alpine.store('toolCalls').update(data);
            } catch (error) {
                console.error('Error parsing tool calls data:', error);
            }
        }
    });
    
    // HTMX request interceptor for Alpine.js integration
    document.body.addEventListener('htmx:beforeRequest', function(event) {
        const target = event.detail.target;
        
        // Set loading states for relevant stores
        if (target.id === 'metrics-data') {
            Alpine.store('metrics').setLoading(true);
        }
        
        if (target.id === 'status-data') {
            Alpine.store('status').setLoading(true);
        }
    });
    
    // HTMX error handling
    document.body.addEventListener('htmx:responseError', function(event) {
        const status = event.detail.xhr.status;
        const target = event.detail.target;
        
        let message = `Request failed (${status})`;
        if (target.id === 'metrics-data') {
            message = 'Failed to load metrics';
            Alpine.store('metrics').setLoading(false);
        } else if (target.id === 'status-data') {
            message = 'Failed to load server status';
            Alpine.store('status').setLoading(false);
        }
        
        Alpine.store('notifications').add(message, 'error');
    });
    
    // HTMX SSE integration with Alpine.js
    document.body.addEventListener('htmx:sseMessage', function(event) {
        try {
            const data = JSON.parse(event.detail.data);
            Alpine.store('eventStream').addEvent(data);
        } catch (error) {
            console.error('Error parsing SSE message:', error);
        }
    });
    
    // SSE connection status integration
    document.body.addEventListener('htmx:sseOpen', function(event) {
        Alpine.store('notifications').add('Live events connected', 'success');
        Alpine.store('dashboard').setSSEConnected(true);
    });
    
    document.body.addEventListener('htmx:sseError', function(event) {
        Alpine.store('notifications').add('Live events connection error', 'error');
        Alpine.store('dashboard').setSSEConnected(false);
    });
    
    document.body.addEventListener('htmx:sseClose', function(event) {
        Alpine.store('notifications').add('Live events disconnected', 'warning');
        Alpine.store('dashboard').setSSEConnected(false);
    });
}

// Dashboard store for cross-component communication
document.addEventListener('alpine:init', () => {
    Alpine.store('dashboard', {
        sseConnected: false,
        lastUpdate: null,
        
        setSSEConnected(connected) {
            this.sseConnected = connected;
        },
        
        triggerUpdate(endpoint) {
            htmx.trigger(`#${endpoint}-data`, 'htmx:trigger');
            this.lastUpdate = new Date().toISOString();
        },
        
        refreshAll() {
            this.triggerUpdate('metrics');
            this.triggerUpdate('status');
            this.triggerUpdate('tool-calls');
        }
    });
    
    // Enhanced status store
    Alpine.store('status', {
        data: {},
        loading: false,
        
        update(newData) {
            this.data = { ...this.data, ...newData };
            this.loading = false;
        },
        
        setLoading(state) {
            this.loading = state;
        }
    });
    
    // Enhanced tool calls store
    Alpine.store('toolCalls', {
        data: [],
        loading: false,
        
        update(newData) {
            this.data = Array.isArray(newData) ? newData : [];
            this.loading = false;
        },
        
        setLoading(state) {
            this.loading = state;
        }
    });
});