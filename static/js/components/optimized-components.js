// Optimized Alpine.js Components with performance enhancements
import { createOptimizedComponent } from '../component-loader.js';

// Optimized Echo Tool with memoization
export const optimizedEchoTool = createOptimizedComponent('echoTool', () => {
    let memoizedValidator = null;
    let lastMessage = '';
    let lastValidation = null;
    
    return {
        message: 'Hello from the MCP Dashboard!',
        result: null,
        executionTime: null,
        errors: {},
        executor: null,
        _isInitialized: false,
        
        init() {
            if (this._isInitialized) return;
            this.executor = Alpine.store('toolExecution').getExecutor('echo');
            this._isInitialized = true;
        },
        
        get loading() {
            return this.executor ? this.executor.loading : false;
        },
        
        get executionHistory() {
            return this.executor ? this.executor.executionHistory : [];
        },
        
        // Memoized validation
        validateForm() {
            if (this.message === lastMessage && lastValidation) {
                this.errors = lastValidation;
                return;
            }
            
            this.errors = {};
            if (!this.message.trim()) {
                this.errors.message = 'Message is required';
            }
            
            lastMessage = this.message;
            lastValidation = { ...this.errors };
        },
        
        async execute() {
            this.validateForm();
            if (Object.keys(this.errors).length > 0) return;
            
            if (!this.executor) {
                this.executor = Alpine.store('toolExecution').getExecutor('echo');
            }
            
            try {
                const result = await this.executor.execute({ message: this.message });
                
                if (result.success) {
                    this.result = JSON.stringify(result.result, null, 2);
                    this.executionTime = `Executed in ${this.executor.lastResult.duration}ms`;
                } else {
                    this.result = null;
                    this.executionTime = null;
                }
                
            } catch (error) {
                this.result = null;
                this.executionTime = null;
            }
        },
        
        clearHistory() {
            if (this.executor) {
                this.executor.clearHistory();
            }
        },
        
        getSuccessRate() {
            return this.executor ? this.executor.getSuccessRate() : 0;
        },
        
        getAverageExecutionTime() {
            return this.executor ? this.executor.getAverageExecutionTime() : 0;
        }
    };
});

// Optimized Metrics Store with throttling
export const optimizedMetricsStore = createOptimizedComponent('metricsStore', () => {
    let updateThrottle = null;
    let lastUpdateTime = 0;
    const THROTTLE_INTERVAL = 100; // 100ms throttle
    
    return {
        get metrics() {
            return Alpine.store('metrics').data;
        },
        
        get loading() {
            return Alpine.store('metrics').loading;
        },
        
        initializeUpdates() {
            Alpine.store('metrics').setLoading(true);
        },
        
        updateMetrics(event) {
            const now = Date.now();
            if (now - lastUpdateTime < THROTTLE_INTERVAL) {
                if (updateThrottle) {
                    clearTimeout(updateThrottle);
                }
                
                updateThrottle = setTimeout(() => {
                    this._doUpdateMetrics(event);
                    lastUpdateTime = Date.now();
                }, THROTTLE_INTERVAL);
                return;
            }
            
            this._doUpdateMetrics(event);
            lastUpdateTime = now;
        },
        
        _doUpdateMetrics(event) {
            try {
                const data = JSON.parse(event.detail.xhr.response);
                Alpine.store('metrics').update(data);
            } catch (error) {
                console.error('Error parsing metrics:', error);
                Alpine.store('metrics').setLoading(false);
            }
        }
    };
});

// Optimized Event Stream with virtual scrolling concepts
export const optimizedEventStream = createOptimizedComponent('eventStream', () => {
    let visibleEvents = [];
    let lastRenderTime = 0;
    const RENDER_THROTTLE = 16; // 60fps throttle
    
    return {
        get events() {
            return Alpine.store('eventStream').events;
        },
        
        get visibleEvents() {
            return visibleEvents;
        },
        
        initializeSSE() {
            // SSE initialization handled by HTMX
            this.updateVisibleEvents();
        },
        
        handleSSEMessage(event) {
            const now = Date.now();
            if (now - lastRenderTime < RENDER_THROTTLE) {
                requestAnimationFrame(() => {
                    this._doHandleSSEMessage(event);
                    lastRenderTime = Date.now();
                });
                return;
            }
            
            this._doHandleSSEMessage(event);
            lastRenderTime = now;
        },
        
        _doHandleSSEMessage(event) {
            try {
                const data = JSON.parse(event.detail.data);
                Alpine.store('eventStream').addEvent(data);
                this.updateVisibleEvents();
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        },
        
        updateVisibleEvents() {
            // Only show first 20 events for performance
            visibleEvents = this.events.slice(0, 20);
        },
        
        getEventClass(type) {
            const classes = {
                'error': 'bg-red-900 bg-opacity-30 text-red-300 border-red-500',
                'tool_called': 'bg-green-900 bg-opacity-30 text-green-300 border-green-500',
                'default': 'bg-blue-900 bg-opacity-30 text-blue-300 border-blue-500'
            };
            return classes[type] || classes.default;
        },
        
        formatEvent(event) {
            const timestamp = new Date(event.timestamp).toLocaleTimeString();
            let message = `[${timestamp}] ${event.type}`;
            
            if (event.name) message += `: ${event.name}`;
            if (event.message) message += `: ${event.message}`;
            if (event.uri) message += `: ${event.uri}`;
            if (event.id) message += ` (${event.id})`;
            
            return message;
        }
    };
});

// Optimized Notification System with pooling
export const optimizedNotificationSystem = createOptimizedComponent('notificationSystem', () => {
    const notificationPool = [];
    const maxPoolSize = 10;
    
    return {
        get notifications() {
            return Alpine.store('notifications').items;
        },
        
        remove(id) {
            const notification = this.notifications.find(n => n.id === id);
            if (notification && notificationPool.length < maxPoolSize) {
                // Reset and pool the notification object
                notificationPool.push({
                    ...notification,
                    id: null,
                    message: '',
                    type: 'info'
                });
            }
            
            Alpine.store('notifications').remove(id);
        },
        
        getNotificationClass(type) {
            const classes = {
                'success': 'bg-green-900 text-green-300 border-green-700',
                'error': 'bg-red-900 text-red-300 border-red-700',
                'warning': 'bg-yellow-900 text-yellow-300 border-yellow-700',
                'info': 'bg-blue-900 text-blue-300 border-blue-700'
            };
            return classes[type] || classes.info;
        },
        
        // Get pooled notification object
        getPooledNotification() {
            return notificationPool.pop() || null;
        },
        
        // Clear the pool to free memory
        clearPool() {
            notificationPool.length = 0;
        }
    };
});

// Memory optimization utilities
export const memoryOptimizer = {
    // Clear component caches
    clearCaches() {
        // Clear memoization caches
        lastMessage = '';
        lastValidation = null;
        memoizedValidator = null;
        
        // Clear event throttles
        if (updateThrottle) {
            clearTimeout(updateThrottle);
            updateThrottle = null;
        }
        
        // Clear visible events
        visibleEvents = [];
        
        // Clear notification pool
        if (window.optimizedNotificationSystem) {
            window.optimizedNotificationSystem().clearPool();
        }
    },
    
    // Force garbage collection if available
    forceGC() {
        if (window.gc) {
            window.gc();
        }
    },
    
    // Get memory usage estimate
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }
};