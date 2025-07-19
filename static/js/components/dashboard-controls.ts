// Dashboard Controls Component for bi-directional communication

import type * as Alpine from 'alpinejs';
import { EventData, DashboardState, CustomAlpineComponent } from '../types/alpine';
import { SystemEvent } from '../types/generated';
import { eventStream } from './event-stream';
import { ErrorHandler, ERROR_TYPES } from '../utils/error-handler';

// Dashboard export data interface
interface DashboardExportData {
    metrics: any;
    events: EventData[] | SystemEvent[];
    toolStats: any;
    timestamp: string;
}

// Dashboard controls component data interface
interface DashboardControlsData {
    refreshing: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    intervalId: NodeJS.Timeout | null;
    
    init(): void;
    refreshAll(): Promise<void>;
    toggleAutoRefresh(): void;
    startAutoRefresh(): void;
    stopAutoRefresh(): void;
    setRefreshInterval(interval: number): void;
    clearAllData(): Promise<void>;
    exportData(): void;
    connectionStatus: string;
    lastUpdate: string;
}

export function dashboardControls(): CustomAlpineComponent<DashboardControlsData> {
    return {
        refreshing: false,
        autoRefresh: true,
        refreshInterval: 2000,
        intervalId: null,
        
        init(): void {
            this.startAutoRefresh();
        },
        
        async refreshAll(): Promise<void> {
            this.refreshing = true;
            try {
                const dashboardStore = this.$store.dashboard;
                dashboardStore.refreshAll();
                this.$store.notifications.add('Dashboard refreshed', 'success');
            } catch (error) {
                const standardError = ErrorHandler.processError(
                    error as Error,
                    'dashboardControls',
                    'refreshAll_manual_refresh'
                );
                ErrorHandler.showErrorToUser(standardError, 'dashboardControls');
            } finally {
                this.refreshing = false;
            }
        },
        
        toggleAutoRefresh(): void {
            this.autoRefresh = !this.autoRefresh;
            if (this.autoRefresh) {
                this.startAutoRefresh();
                this.$store.notifications.add('Auto-refresh enabled', 'info');
            } else {
                this.stopAutoRefresh();
                this.$store.notifications.add('Auto-refresh disabled', 'info');
            }
        },
        
        startAutoRefresh(): void {
            if (this.intervalId) {
                clearInterval(this.intervalId);
            }
            
            if (this.autoRefresh) {
                this.intervalId = setInterval(() => {
                    if (!this.refreshing) {
                        this.$store.dashboard.refreshAll();
                    }
                }, this.refreshInterval);
            }
        },
        
        stopAutoRefresh(): void {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        },
        
        setRefreshInterval(interval: number): void {
            this.refreshInterval = interval;
            if (this.autoRefresh) {
                this.startAutoRefresh();
            }
        },
        
        async clearAllData(): Promise<void> {
            try {
                // Clear all Alpine.js stores
                this.$store.metrics.data = {
                    total_tool_calls: 0,
                    success_rate: 0,
                    active_sessions: 0,
                    avg_duration_ms: 0,
                    tools_available: 0,
                    resources_available: 0
                };
                this.$store.eventStream.clear();
                this.$store.notifications.clear();
                
                // Clear tool execution history
                const toolExecutionStore = this.$store.toolExecution;
                if (toolExecutionStore && toolExecutionStore.activeExecutions) {
                    toolExecutionStore.activeExecutions.forEach((executor: any) => {
                        if (executor.clearHistory) {
                            executor.clearHistory();
                        }
                    });
                }
                
                this.$store.notifications.add('All data cleared', 'success');
            } catch (error) {
                const standardError = ErrorHandler.processError(
                    error as Error,
                    'dashboardControls',
                    'clearAllData_data_clear'
                );
                ErrorHandler.showErrorToUser(standardError, 'dashboardControls');
            }
        },
        
        exportData(): void {
            try {
                const data: DashboardExportData = {
                    metrics: this.$store.metrics.data,
                    events: this.$store.eventStream.events,
                    toolStats: this.$store.toolExecution?.getAllStats ? this.$store.toolExecution.getAllStats() : {},
                    timestamp: new Date().toISOString()
                };
                
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mcp-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
                
                this.$store.notifications.add('Data exported successfully', 'success');
            } catch (error) {
                const standardError = ErrorHandler.processError(
                    error as Error,
                    'dashboardControls',
                    'exportData_data_export'
                );
                ErrorHandler.showErrorToUser(standardError, 'dashboardControls');
            }
        },
        
        get connectionStatus(): string {
            return this.$store.dashboard.sseConnected ? 'connected' : 'disconnected';
        },
        
        get lastUpdate(): string {
            return this.$store.dashboard.lastUpdate;
        }
    } as CustomAlpineComponent<DashboardControlsData>;
}

// Enhanced event stream component data interface
interface EnhancedEventStreamData {
    pauseStream: boolean;
    maxEvents: number;
    events: EventData[];
    
    togglePause(): void;
    handleSSEMessage(event: { detail: { data: string } }): void;
    filterEvents(type: string): EventData[];
    clearEvents(): void;
    
    // Methods from eventStream
    initializeSSE(): void;
    sanitizeEventData(data: any): EventData;
    sanitizeString(value: any): string;
    getEventClass(type: string): string;
    formatEvent(event: EventData): string;
    handleEventStreamError(error: Error, method: string, args?: any[]): void;
}

// Enhanced event stream component with bi-directional communication
export function enhancedEventStream(): CustomAlpineComponent<EnhancedEventStreamData> {
    const baseEventStream = eventStream();
    
    return {
        ...baseEventStream,
        
        pauseStream: false,
        maxEvents: 50,
        
        togglePause(): void {
            this.pauseStream = !this.pauseStream;
            if (this.pauseStream) {
                this.$store.notifications.add('Event stream paused', 'info');
            } else {
                this.$store.notifications.add('Event stream resumed', 'info');
            }
        },
        
        handleSSEMessage(event: { detail: { data: string } }): void {
            if (this.pauseStream) return;
            
            try {
                const data = JSON.parse(event.detail.data);
                this.$store.eventStream.addEvent(data);
                
                // Trigger related updates based on event type
                if (data.type === 'tool_called') {
                    const dashboardStore = this.$store.dashboard;
                    if (dashboardStore.triggerUpdate) {
                        dashboardStore.triggerUpdate('metrics');
                        dashboardStore.triggerUpdate('tool-calls');
                    }
                }
            } catch (error) {
                ErrorHandler.processError(
                    error as Error,
                    'dashboardControls',
                    'initSSE_sse_message_parsing'
                );
            }
        },
        
        filterEvents(type: string): EventData[] {
            return this.$store.eventStream.events.filter((event: EventData) => 
                type === 'all' || event.type === type
            );
        },
        
        clearEvents(): void {
            this.$store.eventStream.clear();
            this.$store.notifications.add('Events cleared', 'info');
        }
    } as CustomAlpineComponent<EnhancedEventStreamData>;
}

// Export types for testing and module usage
export type DashboardControlsComponent = CustomAlpineComponent<DashboardControlsData>;
export type EnhancedEventStreamComponent = CustomAlpineComponent<EnhancedEventStreamData>;