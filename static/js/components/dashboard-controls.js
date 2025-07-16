// Dashboard Controls Component for bi-directional communication
export function dashboardControls() {
    return {
        refreshing: false,
        autoRefresh: true,
        refreshInterval: 2000,
        intervalId: null,
        
        init() {
            this.startAutoRefresh();
        },
        
        async refreshAll() {
            this.refreshing = true;
            try {
                Alpine.store('dashboard').refreshAll();
                Alpine.store('notifications').add('Dashboard refreshed', 'success');
            } catch (error) {
                Alpine.store('notifications').add(`Refresh failed: ${error.message}`, 'error');
            } finally {
                this.refreshing = false;
            }
        },
        
        toggleAutoRefresh() {
            this.autoRefresh = !this.autoRefresh;
            if (this.autoRefresh) {
                this.startAutoRefresh();
                Alpine.store('notifications').add('Auto-refresh enabled', 'info');
            } else {
                this.stopAutoRefresh();
                Alpine.store('notifications').add('Auto-refresh disabled', 'info');
            }
        },
        
        startAutoRefresh() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
            }
            
            if (this.autoRefresh) {
                this.intervalId = setInterval(() => {
                    if (!this.refreshing) {
                        Alpine.store('dashboard').refreshAll();
                    }
                }, this.refreshInterval);
            }
        },
        
        stopAutoRefresh() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        },
        
        setRefreshInterval(interval) {
            this.refreshInterval = interval;
            if (this.autoRefresh) {
                this.startAutoRefresh();
            }
        },
        
        async clearAllData() {
            try {
                // Clear all Alpine.js stores
                Alpine.store('metrics').data = {};
                Alpine.store('eventStream').clear();
                Alpine.store('notifications').clear();
                
                // Clear tool execution history
                Alpine.store('toolExecution').activeExecutions.forEach(executor => {
                    executor.clearHistory();
                });
                
                Alpine.store('notifications').add('All data cleared', 'success');
            } catch (error) {
                Alpine.store('notifications').add(`Clear failed: ${error.message}`, 'error');
            }
        },
        
        exportData() {
            try {
                const data = {
                    metrics: Alpine.store('metrics').data,
                    events: Alpine.store('eventStream').events,
                    toolStats: Alpine.store('toolExecution').getAllStats(),
                    timestamp: new Date().toISOString()
                };
                
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mcp-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                Alpine.store('notifications').add('Data exported successfully', 'success');
            } catch (error) {
                Alpine.store('notifications').add(`Export failed: ${error.message}`, 'error');
            }
        },
        
        get connectionStatus() {
            return Alpine.store('dashboard').sseConnected ? 'connected' : 'disconnected';
        },
        
        get lastUpdate() {
            return Alpine.store('dashboard').lastUpdate;
        }
    };
}

// Enhanced event stream component with bi-directional communication
export function enhancedEventStream() {
    return {
        ...eventStream(),
        
        pauseStream: false,
        maxEvents: 50,
        
        togglePause() {
            this.pauseStream = !this.pauseStream;
            if (this.pauseStream) {
                Alpine.store('notifications').add('Event stream paused', 'info');
            } else {
                Alpine.store('notifications').add('Event stream resumed', 'info');
            }
        },
        
        handleSSEMessage(event) {
            if (this.pauseStream) return;
            
            try {
                const data = JSON.parse(event.detail.data);
                Alpine.store('eventStream').addEvent(data);
                
                // Trigger related updates based on event type
                if (data.type === 'tool_called') {
                    Alpine.store('dashboard').triggerUpdate('metrics');
                    Alpine.store('dashboard').triggerUpdate('tool-calls');
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        },
        
        filterEvents(type) {
            return Alpine.store('eventStream').events.filter(event => 
                type === 'all' || event.type === type
            );
        },
        
        clearEvents() {
            Alpine.store('eventStream').clear();
            Alpine.store('notifications').add('Events cleared', 'info');
        }
    };
}