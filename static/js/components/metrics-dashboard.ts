// Metrics Dashboard Alpine.js Component

import type * as Alpine from 'alpinejs';
import { MetricsData, CustomAlpineComponent } from '../types/alpine';

// Metrics component data interface
interface MetricsStoreData {
    metrics: Record<string, any>;
    loading: boolean;
    initializeUpdates(): void;
    updateMetrics(event: { detail: { xhr: { response: string } } }): void;
}

/**
 * Metrics Dashboard Alpine.js Component
 * 
 * This component provides a dashboard interface for displaying system metrics
 * and performance data. It integrates with the metrics store to manage real-time
 * data updates and loading states.
 */
export function metricsStore(): CustomAlpineComponent<MetricsStoreData> {
    return {
        /**
         * Get the current metrics data from the store
         */
        get metrics(): Record<string, any> {
            return this.$store.metrics.data;
        },
        
        /**
         * Get the current loading state from the store
         */
        get loading(): boolean {
            return this.$store.metrics.loading;
        },
        
        /**
         * Initialize metrics updates by setting loading state
         */
        initializeUpdates(): void {
            this.$store.metrics.setLoading(true);
        },
        
        /**
         * Update metrics data from an event
         */
        updateMetrics(event: { detail: { xhr: { response: string } } }): void {
            try {
                const data = JSON.parse(event.detail.xhr.response);
                this.$store.metrics.update(data);
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error parsing metrics:', error);
                }
                this.$store.metrics.setLoading(false);
            }
        }
    } as CustomAlpineComponent<MetricsStoreData>;
}

// Enhanced metrics store interface (for the store itself)
interface MetricsStore {
    data: Record<string, any>;
    loading: boolean;
    error: string | null;
    history: MetricsData[];
    update(newData: Record<string, any>): void;
    setLoading(state: boolean): void;
    setError(error: string | null): void;
    addMetric(metric: MetricsData): void;
    clear(): void;
    getByType(type: string): MetricsData[];
    getLatest(type: string): MetricsData | undefined;
    getMetricsInRange(startTime: number, endTime: number): MetricsData[];
    getAverageValue(type: string): number;
}

/**
 * Metrics store - using Alpine.js init event
 * 
 * Global Alpine.js store for managing system metrics data.
 * Provides methods to update metrics data and manage loading states.
 */
document.addEventListener('alpine:init', () => {
    if (typeof window !== 'undefined' && window.Alpine) {
        window.Alpine.store('metrics', {
            /** Current metrics data */
            data: {} as Record<string, any>,
            
            /** Loading state indicator */
            loading: false,
            
            /** Error state */
            error: null as string | null,
            
            /** Historical metrics data */
            history: [] as MetricsData[],
            
            /**
             * Update metrics data with new values
             */
            update(newData: Record<string, any>): void {
                this.data = { ...this.data, ...newData };
                this.loading = false;
                
                // Add timestamp for historical tracking
                if (newData && typeof newData === 'object') {
                    this.addMetric({
                        timestamp: Date.now(),
                        value: Object.keys(newData).length,
                        type: 'update',
                        ...newData
                    });
                }
            },
            
            /**
             * Set the loading state
             */
            setLoading(state: boolean): void {
                this.loading = state;
            },
            
            /**
             * Set the error state
             */
            setError(error: string | null): void {
                this.error = error;
            },
            
            /**
             * Add a metric to the history
             */
            addMetric(metric: MetricsData): void {
                this.history.push(metric);
                
                // Keep only last 100 metrics to prevent memory issues
                if (this.history.length > 100) {
                    this.history.shift();
                }
            },
            
            /**
             * Clear all metrics data
             */
            clear(): void {
                this.data = {};
                this.history = [];
                this.loading = false;
                this.error = null;
            },
            
            /**
             * Get metrics by type
             */
            getByType(type: string): MetricsData[] {
                return this.history.filter(metric => metric.type === type);
            },
            
            /**
             * Get the latest metric of a specific type
             */
            getLatest(type: string): MetricsData | undefined {
                const metrics = this.getByType(type);
                return metrics.length > 0 ? metrics[metrics.length - 1] : undefined;
            },
            
            /**
             * Get metrics within a time range
             */
            getMetricsInRange(startTime: number, endTime: number): MetricsData[] {
                return this.history.filter(metric => 
                    metric.timestamp >= startTime && metric.timestamp <= endTime
                );
            },
            
            /**
             * Calculate average value for a metric type
             */
            getAverageValue(type: string): number {
                const metrics = this.getByType(type);
                if (metrics.length === 0) return 0;
                
                const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
                return sum / metrics.length;
            }
        } as MetricsStore);
    }
});

// Export type for testing and module usage
export type MetricsStoreComponent = CustomAlpineComponent<MetricsStoreData>;

// Full metrics dashboard component data interface
interface MetricsDashboardData {
    refreshInterval: number;
    autoRefresh: boolean;
    lastRefresh: string | null;
    _refreshTimer: any;
    metrics: Record<string, any>;
    loading: boolean;
    error: string | null;
    init(): void;
    destroy(): void;
    startAutoRefresh(): void;
    stopAutoRefresh(): void;
    refresh(): Promise<void>;
    formatUptime(seconds: number): string;
    formatMemoryUsage(bytes: number): string;
    getStatusColor(status: string): string;
}

/**
 * Full Metrics Dashboard Component
 * 
 * This component provides a complete dashboard interface for system metrics
 * with auto-refresh, error handling, and display formatting.
 */
export function metricsDashboard(): CustomAlpineComponent<MetricsDashboardData> {
    return {
        refreshInterval: 30000,
        autoRefresh: true,
        lastRefresh: null as string | null,
        _refreshTimer: null as any,
        
        get metrics() {
            return this.$store.metrics.data;
        },
        
        get loading() {
            return this.$store.metrics.loading;
        },
        
        get error() {
            return (this.$store.metrics as any).error || null;
        },
        
        init() {
            this.startAutoRefresh();
        },
        
        destroy() {
            this.stopAutoRefresh();
        },
        
        startAutoRefresh() {
            if (this.autoRefresh) {
                this._refreshTimer = setInterval(() => {
                    this.refresh();
                }, this.refreshInterval);
            }
        },
        
        stopAutoRefresh() {
            if (this._refreshTimer) {
                clearInterval(this._refreshTimer);
                this._refreshTimer = null;
            }
        },
        
        async refresh() {
            try {
                this.$store.metrics.setLoading(true);
                const response = await fetch('/api/metrics');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const data = await response.json();
                this.$store.metrics.update(data);
                this.lastRefresh = new Date().toISOString();
            } catch (error) {
                (this.$store.metrics as any).setError((error as Error).message);
            } finally {
                this.$store.metrics.setLoading(false);
            }
        },
        
        formatUptime(seconds: number): string {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = seconds % 60;
            
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else if (minutes > 0) {
                return `${minutes}m ${remainingSeconds}s`;
            } else {
                return `${remainingSeconds}s`;
            }
        },
        
        formatMemoryUsage(bytes: number): string {
            const units = ['B', 'KB', 'MB', 'GB'];
            let value = bytes;
            let unitIndex = 0;
            
            while (value >= 1024 && unitIndex < units.length - 1) {
                value /= 1024;
                unitIndex++;
            }
            
            return `${value.toFixed(1)} ${units[unitIndex]}`;
        },
        
        getStatusColor(status: string): string {
            switch (status) {
                case 'running':
                    return 'text-green-400';
                case 'error':
                    return 'text-red-400';
                case 'warning':
                    return 'text-yellow-400';
                default:
                    return 'text-gray-400';
            }
        }
    } as CustomAlpineComponent<MetricsDashboardData>;
}

// Removed default export - using named export only