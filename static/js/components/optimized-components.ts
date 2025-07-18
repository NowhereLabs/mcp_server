// Optimized Alpine.js Components with performance enhancements
// TypeScript version with proper type definitions

import { createOptimizedComponent } from '../component-loader';
import type { 
  OptimizedEchoToolComponent, 
  OptimizedMetricsStoreComponent, 
  OptimizedEventStreamComponent, 
  OptimizedNotificationSystemComponent, 
  MemoryOptimizer 
} from './optimized-components.d';

// Performance-optimized browser memory interface
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

// Extended Window interface for garbage collection
interface ExtendedWindow extends Window {
  gc?: () => void;
}

// Type-safe Alpine.js store access
interface AlpineStore {
  (name: string): any;
}

interface AlpineInstance {
  store: AlpineStore;
}

declare const window: ExtendedWindow;
declare const performance: ExtendedPerformance;
declare const Alpine: AlpineInstance;

// Optimized Echo Tool with memoization
export const optimizedEchoTool = createOptimizedComponent('echoTool', (): OptimizedEchoToolComponent => {
    let memoizedValidator: ((message: string) => boolean) | null = null;
    let lastMessage = '';
    let lastValidation: boolean | null = null;
    
    return {
        message: 'Hello from the MCP Dashboard!',
        result: null,
        executionTime: null,
        errors: {},
        executor: null,
        _isInitialized: false,
        
        init(): void {
            if (this._isInitialized) return;
            this.executor = Alpine.store('toolExecution').getExecutor('echo');
            this._isInitialized = true;
        },
        
        get loading(): boolean {
            return this.executor ? this.executor.loading : false;
        },
        
        get executionHistory(): any[] {
            return this.executor ? this.executor.executionHistory : [];
        },
        
        validateForm(): void {
            // Memoized validation - only re-validate if message changed
            if (lastMessage === this.message && lastValidation !== null) {
                return;
            }
            
            if (!memoizedValidator) {
                memoizedValidator = (msg: string): boolean => {
                    return msg.trim().length > 0 && msg.length <= 1000;
                };
            }
            
            const isValid = memoizedValidator(this.message);
            lastMessage = this.message;
            lastValidation = isValid;
            
            if (!isValid) {
                this.errors = {
                    message: this.message.trim().length === 0 
                        ? 'Message cannot be empty' 
                        : 'Message too long (max 1000 characters)'
                };
            } else {
                this.errors = {};
            }
        },
        
        async execute(): Promise<void> {
            this.validateForm();
            
            if (Object.keys(this.errors).length > 0) {
                return;
            }
            
            if (!this.executor) {
                console.error('Executor not initialized');
                return;
            }
            
            try {
                const startTime = performance.now();
                
                const result = await this.executor.execute({
                    message: this.message
                });
                
                const endTime = performance.now();
                this.executionTime = `${(endTime - startTime).toFixed(2)}ms`;
                this.result = result;
                
                // Clear form after successful execution
                this.message = '';
                this.errors = {};
                
            } catch (error) {
                console.error('Echo tool execution failed:', error);
                this.errors = {
                    execution: error instanceof Error ? error.message : 'Unknown error occurred'
                };
            }
        },
        
        clearHistory(): void {
            if (this.executor && this.executor.clearHistory) {
                this.executor.clearHistory();
            }
        },
        
        getSuccessRate(): number {
            if (!this.executionHistory.length) return 0;
            
            const successful = this.executionHistory.filter(
                (entry: any) => entry.status === 'success'
            ).length;
            
            return Math.round((successful / this.executionHistory.length) * 100);
        },
        
        getAverageExecutionTime(): number {
            if (!this.executionHistory.length) return 0;
            
            const times = this.executionHistory
                .filter((entry: any) => entry.executionTime)
                .map((entry: any) => parseFloat(entry.executionTime));
            
            if (times.length === 0) return 0;
            
            return Math.round(times.reduce((a, b) => a + b, 0) / times.length * 100) / 100;
        }
    };
});

// Optimized Metrics Store with throttled updates
export const optimizedMetricsStore = createOptimizedComponent('metricsStore', (): OptimizedMetricsStoreComponent => {
    let updateThrottle: ReturnType<typeof setTimeout> | null = null;
    let pendingUpdate: any = null;
    
    return {
        get metrics(): any {
            return Alpine.store('metrics').data;
        },
        
        get loading(): boolean {
            return Alpine.store('metrics').loading;
        },
        
        initializeUpdates(): void {
            // Listen for metrics updates with throttling
            document.addEventListener('metrics:update', this.updateMetrics.bind(this));
        },
        
        updateMetrics(event: any): void {
            // Throttle updates to prevent excessive re-renders
            if (updateThrottle) {
                pendingUpdate = event;
                return;
            }
            
            this._doUpdateMetrics(event);
            
            updateThrottle = setTimeout(() => {
                updateThrottle = null;
                
                if (pendingUpdate) {
                    this._doUpdateMetrics(pendingUpdate);
                    pendingUpdate = null;
                }
            }, 100); // Throttle to 100ms
        },
        
        _doUpdateMetrics(event: any): void {
            if (event.detail && event.detail.metrics) {
                Alpine.store('metrics').update(event.detail.metrics);
            }
        }
    };
});

// Optimized Event Stream with virtual scrolling
export const optimizedEventStream = createOptimizedComponent('eventStream', (): OptimizedEventStreamComponent => {
    const MAX_VISIBLE_EVENTS = 50;
    let visibleEventsCache: any[] = [];
    let lastEventCount = 0;
    
    return {
        get events(): any[] {
            return Alpine.store('eventStream').events;
        },
        
        get visibleEvents(): any[] {
            // Only recalculate if event count changed
            if (this.events.length !== lastEventCount) {
                this.updateVisibleEvents();
                lastEventCount = this.events.length;
            }
            
            return visibleEventsCache;
        },
        
        initializeSSE(): void {
            // Listen for SSE messages with optimized handling
            document.addEventListener('htmx:sseMessage', this.handleSSEMessage.bind(this));
        },
        
        handleSSEMessage(event: any): void {
            // Debounce SSE message handling
            requestAnimationFrame(() => {
                this._doHandleSSEMessage(event);
            });
        },
        
        _doHandleSSEMessage(event: any): void {
            if (event.detail && event.detail.data) {
                try {
                    const data = JSON.parse(event.detail.data);
                    Alpine.store('eventStream').addEvent(data);
                } catch (error) {
                    console.error('Failed to parse SSE message:', error);
                }
            }
        },
        
        updateVisibleEvents(): void {
            // Implement virtual scrolling by only keeping recent events
            visibleEventsCache = this.events.slice(-MAX_VISIBLE_EVENTS);
        },
        
        getEventClass(type: string): string {
            const classMap: Record<string, string> = {
                'tool_call': 'bg-blue-100 text-blue-800',
                'error': 'bg-red-100 text-red-800',
                'warning': 'bg-yellow-100 text-yellow-800',
                'info': 'bg-gray-100 text-gray-800',
                'success': 'bg-green-100 text-green-800'
            };
            
            return classMap[type] || 'bg-gray-100 text-gray-800';
        },
        
        formatEvent(event: any): string {
            if (event.type === 'tool_call') {
                return `${event.tool_name}: ${event.message || 'Executed'}`;
            }
            
            return event.message || 'Unknown event';
        }
    };
});

// Optimized Notification System with object pooling
export const optimizedNotificationSystem = createOptimizedComponent('notificationSystem', (): OptimizedNotificationSystemComponent => {
    const notificationPool: any[] = [];
    const MAX_POOL_SIZE = 10;
    
    return {
        get notifications(): any[] {
            return Alpine.store('notifications').notifications;
        },
        
        remove(id: string): void {
            const notification = this.notifications.find((n: any) => n.id === id);
            if (notification) {
                // Return to pool for reuse
                if (notificationPool.length < MAX_POOL_SIZE) {
                    // Reset notification object
                    notification.id = '';
                    notification.message = '';
                    notification.type = 'info';
                    notification.timestamp = 0;
                    
                    notificationPool.push(notification);
                }
            }
            
            Alpine.store('notifications').remove(id);
        },
        
        getNotificationClass(type: string): string {
            const classMap: Record<string, string> = {
                'error': 'bg-red-500 text-white',
                'warning': 'bg-yellow-500 text-white',
                'success': 'bg-green-500 text-white',
                'info': 'bg-blue-500 text-white'
            };
            
            return classMap[type] || 'bg-gray-500 text-white';
        },
        
        getPooledNotification(): any | null {
            return notificationPool.pop() || null;
        },
        
        clearPool(): void {
            notificationPool.length = 0;
        }
    };
});

// Memory optimizer utility
export const memoryOptimizer: MemoryOptimizer = {
    clearCaches(): void {
        // Clear various caches
        if (Alpine.store('metrics')) {
            Alpine.store('metrics').clearCache?.();
        }
        
        if (Alpine.store('eventStream')) {
            Alpine.store('eventStream').clearCache?.();
        }
        
        // Clear notification pool
        if (window.Alpine && window.Alpine.store('notifications')) {
            const notificationSystem = Alpine.store('notifications');
            if (notificationSystem.clearPool) {
                notificationSystem.clearPool();
            }
        }
        
        // Clear component performance data
        if (window.performanceMonitor) {
            window.performanceMonitor.clearCaches?.();
        }
    },
    
    forceGC(): void {
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    },
    
    getMemoryUsage(): { used: number; total: number; limit: number } | null {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        
        return null;
    }
};

// Attach memory optimizer to window for debugging
if (typeof window !== 'undefined') {
    (window as any).memoryOptimizer = memoryOptimizer;
}