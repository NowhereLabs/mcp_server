// HTMX-Alpine.js Bridge Component
// TypeScript version with proper type definitions

import type { DashboardStore, StatusStore, ToolCallsStore } from './htmx-alpine-bridge.d';

// Enhanced HTMX event type definitions
interface HTMXEventDetail {
    target: HTMLElement;
    xhr: XMLHttpRequest;
    data?: string;
    requestConfig?: any;
}

interface HTMXEvent extends CustomEvent<HTMXEventDetail> {
    detail: HTMXEventDetail;
}

// Enhanced store type definitions
interface MetricsStore {
    data: Record<string, any>;
    loading: boolean;
    update(newData: Record<string, any>): void;
    setLoading(state: boolean): void;
}

interface NotificationStore {
    add(message: string, type: 'error' | 'success' | 'warning' | 'info'): void;
}

interface EventStreamStore {
    addEvent(data: any): void;
}

// Type-safe store access
function getStore<T>(name: string): T {
    return window.Alpine.store(name) as T;
}

export function initializeHtmxAlpineBridge(): void {
    // HTMX to Alpine.js event bridge
    document.body.addEventListener('htmx:afterSwap', function(event: Event) {
        const htmxEvent = event as HTMXEvent;
        const target = htmxEvent.detail.target;
        
        // Update metrics store when metrics endpoint responds
        if (target.id === 'metrics-data') {
            try {
                const data = JSON.parse(htmxEvent.detail.xhr.response);
                getStore<MetricsStore>('metrics').update(data);
            } catch (error) {
                console.error('Error parsing metrics data:', error);
                getStore<NotificationStore>('notifications').add('Error updating metrics', 'error');
            }
        }
        
        // Handle status updates
        if (target.id === 'status-data') {
            try {
                const data = JSON.parse(htmxEvent.detail.xhr.response);
                getStore<StatusStore>('status').update(data);
            } catch (error) {
                console.error('Error parsing status data:', error);
            }
        }
        
        // Handle tool calls updates
        if (target.id === 'tool-calls-data') {
            try {
                const data = JSON.parse(htmxEvent.detail.xhr.response);
                getStore<ToolCallsStore>('toolCalls').update(data);
            } catch (error) {
                console.error('Error parsing tool calls data:', error);
            }
        }
    });
    
    // HTMX request interceptor for Alpine.js integration
    document.body.addEventListener('htmx:beforeRequest', function(event: Event) {
        const htmxEvent = event as HTMXEvent;
        const target = htmxEvent.detail.target;
        
        // Set loading states for relevant stores
        if (target.id === 'metrics-data') {
            getStore<MetricsStore>('metrics').setLoading(true);
        }
        
        if (target.id === 'status-data') {
            getStore<StatusStore>('status').setLoading(true);
        }
    });
    
    // HTMX error handling
    document.body.addEventListener('htmx:responseError', function(event: Event) {
        const htmxEvent = event as HTMXEvent;
        const status = htmxEvent.detail.xhr.status;
        const target = htmxEvent.detail.target;
        
        let message = `Request failed (${status})`;
        if (target.id === 'metrics-data') {
            message = 'Failed to load metrics';
            getStore<MetricsStore>('metrics').setLoading(false);
        } else if (target.id === 'status-data') {
            message = 'Failed to load server status';
            getStore<StatusStore>('status').setLoading(false);
        }
        
        getStore<NotificationStore>('notifications').add(message, 'error');
    });
    
    // HTMX SSE integration with Alpine.js
    document.body.addEventListener('htmx:sseMessage', function(event: Event) {
        const htmxEvent = event as HTMXEvent;
        try {
            const data = JSON.parse(htmxEvent.detail.data || '{}');
            getStore<EventStreamStore>('eventStream').addEvent(data);
        } catch (error) {
            console.error('Error parsing SSE message:', error);
        }
    });
    
    // SSE connection status integration
    document.body.addEventListener('htmx:sseOpen', function(event: Event) {
        getStore<NotificationStore>('notifications').add('Live events connected', 'success');
        getStore<DashboardStore>('dashboard').setSSEConnected(true);
    });
    
    document.body.addEventListener('htmx:sseError', function(event: Event) {
        getStore<NotificationStore>('notifications').add('Live events connection error', 'error');
        getStore<DashboardStore>('dashboard').setSSEConnected(false);
    });
    
    document.body.addEventListener('htmx:sseClose', function(event: Event) {
        getStore<NotificationStore>('notifications').add('Live events disconnected', 'warning');
        getStore<DashboardStore>('dashboard').setSSEConnected(false);
    });
}

// Type-safe store implementations
interface DashboardStoreImpl extends DashboardStore {
    sseConnected: boolean;
    lastUpdate: string | null;
    
    setSSEConnected(connected: boolean): void;
    triggerUpdate(endpoint: string): void;
    refreshAll(): void;
}

interface StatusStoreImpl extends StatusStore {
    data: Record<string, any>;
    loading: boolean;
    
    update(newData: Record<string, any>): void;
    setLoading(state: boolean): void;
}

interface ToolCallsStoreImpl extends ToolCallsStore {
    data: any[];
    loading: boolean;
    
    update(newData: any[]): void;
    setLoading(state: boolean): void;
}

// Dashboard store for cross-component communication
document.addEventListener('alpine:init', () => {
    const dashboardStore: DashboardStoreImpl = {
        sseConnected: false,
        lastUpdate: null,
        
        setSSEConnected(connected: boolean): void {
            this.sseConnected = connected;
        },
        
        triggerUpdate(endpoint: string): void {
            // Type-safe HTMX access
            if (typeof window !== 'undefined' && (window as any).htmx) {
                (window as any).htmx.trigger(`#${endpoint}-data`, 'htmx:trigger');
                this.lastUpdate = new Date().toISOString();
            }
        },
        
        refreshAll(): void {
            this.triggerUpdate('metrics');
            this.triggerUpdate('status');
            this.triggerUpdate('tool-calls');
        }
    };
    
    window.Alpine.store('dashboard', dashboardStore);
    
    // Enhanced status store
    const statusStore: StatusStoreImpl = {
        data: {},
        loading: false,
        
        update(newData: Record<string, any>): void {
            this.data = { ...this.data, ...newData };
            this.loading = false;
        },
        
        setLoading(state: boolean): void {
            this.loading = state;
        }
    };
    
    window.Alpine.store('status', statusStore);
    
    // Enhanced tool calls store
    const toolCallsStore: ToolCallsStoreImpl = {
        data: [],
        loading: false,
        
        update(newData: any[]): void {
            this.data = Array.isArray(newData) ? newData : [];
            this.loading = false;
        },
        
        setLoading(state: boolean): void {
            this.loading = state;
        }
    };
    
    window.Alpine.store('toolCalls', toolCallsStore);
});