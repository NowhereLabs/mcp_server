// Client-side performance monitoring for Alpine.js components
export class ClientPerformanceMonitor {
    constructor() {
        this.metrics = {
            bundleLoadTime: 0,
            componentInitTimes: {},
            memoryUsage: [],
            renderTimes: {},
            eventHandlerTimes: {},
            startTime: performance.now()
        };
        
        this.memoryCheckInterval = null;
        this.isMonitoring = false;
    }
    
    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        this.recordInitialMetrics();
        this.startMemoryMonitoring();
        this.setupObservers();
        
        if (process.env.NODE_ENV === 'development') {
            console.log('🎯 Performance monitoring started');
        }
    }
    
    stopMonitoring() {
        this.isMonitoring = false;
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
        }
        
        if (process.env.NODE_ENV === 'development') {
            console.log('📊 Performance monitoring stopped');
        }
        this.generateReport();
    }
    
    recordInitialMetrics() {
        // Record when the script finished loading
        this.metrics.bundleLoadTime = performance.now() - this.metrics.startTime;
        
        // Record navigation timing if available
        if (performance.navigation) {
            this.metrics.navigationTiming = {
                loadEventEnd: performance.timing.loadEventEnd,
                domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
                domComplete: performance.timing.domComplete
            };
        }
    }
    
    startMemoryMonitoring() {
        if (!performance.memory) return;
        
        // Throttled memory monitoring to reduce overhead
        this.memoryCheckInterval = setInterval(() => {
            const usage = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };
            
            this.metrics.memoryUsage.push(usage);
            
            // Keep only last 20 measurements to reduce memory usage
            if (this.metrics.memoryUsage.length > 20) {
                this.metrics.memoryUsage.shift();
            }
            
            // Alert if memory usage is high
            if (usage.used > usage.limit * 0.9) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('🚨 High memory usage detected:', usage);
                }
                this.triggerMemoryCleanup();
            }
        }, 30000); // Increased from 5s to 30s for better performance
    }
    
    setupObservers() {
        // Observe Alpine.js component initialization
        if (window.Alpine) {
            const originalStore = Alpine.store;
            Alpine.store = (name, value) => {
                const start = performance.now();
                const result = originalStore.call(Alpine, name, value);
                const end = performance.now();
                
                this.metrics.componentInitTimes[name] = end - start;
                return result;
            };
        }
        
        // Observe DOM mutations for render performance
        if (window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        this.recordRenderTime(mutation.target);
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    recordRenderTime(element) {
        if (!element.getAttribute) return;
        
        const component = element.getAttribute('x-data');
        if (component) {
            const timestamp = performance.now();
            this.metrics.renderTimes[component] = timestamp;
        }
    }
    
    recordEventHandlerTime(eventName, handler) {
        return function(...args) {
            const start = performance.now();
            const result = handler.apply(this, args);
            const end = performance.now();
            
            if (!this.metrics.eventHandlerTimes[eventName]) {
                this.metrics.eventHandlerTimes[eventName] = [];
            }
            
            this.metrics.eventHandlerTimes[eventName].push(end - start);
            return result;
        }.bind(this);
    }
    
    triggerMemoryCleanup() {
        // Clear component caches
        if (window.memoryOptimizer) {
            window.memoryOptimizer.clearCaches();
        }
        
        // Clear Alpine.js internal caches
        if (window.Alpine && Alpine.store) {
            const stores = ['metrics', 'eventStream', 'notifications'];
            stores.forEach(store => {
                if (Alpine.store(store) && Alpine.store(store).clear) {
                    Alpine.store(store).clear();
                }
            });
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }
    
    getMemoryTrend() {
        if (this.metrics.memoryUsage.length < 2) return 'stable';
        
        const recent = this.metrics.memoryUsage.slice(-10);
        const trend = recent.reduce((acc, curr, idx) => {
            if (idx === 0) return acc;
            return acc + (curr.used - recent[idx - 1].used);
        }, 0);
        
        return trend > 1024 * 1024 ? 'increasing' : trend < -1024 * 1024 ? 'decreasing' : 'stable';
    }
    
    generateReport() {
        const report = {
            summary: {
                bundleLoadTime: this.metrics.bundleLoadTime,
                totalComponents: Object.keys(this.metrics.componentInitTimes).length,
                memoryTrend: this.getMemoryTrend(),
                monitoringDuration: performance.now() - this.metrics.startTime
            },
            
            components: this.metrics.componentInitTimes,
            
            memory: {
                samples: this.metrics.memoryUsage.length,
                trend: this.getMemoryTrend(),
                current: this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1],
                peak: this.metrics.memoryUsage.reduce((max, curr) => 
                    curr.used > max.used ? curr : max, { used: 0 })
            },
            
            recommendations: this.generateRecommendations()
        };
        
        console.log('📈 Performance Report:', report);
        
        // Store in sessionStorage for debugging
        sessionStorage.setItem('performanceReport', JSON.stringify(report));
        
        return report;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.bundleLoadTime > 100) {
            recommendations.push('Consider lazy loading components to improve initial load time');
        }
        
        const slowComponents = Object.entries(this.metrics.componentInitTimes)
            .filter(([_, time]) => time > 10)
            .map(([name, _]) => name);
        
        if (slowComponents.length > 0) {
            recommendations.push(`Optimize slow components: ${slowComponents.join(', ')}`);
        }
        
        if (this.getMemoryTrend() === 'increasing') {
            recommendations.push('Memory usage is increasing - check for memory leaks');
        }
        
        const avgEventTime = Object.values(this.metrics.eventHandlerTimes)
            .flat()
            .reduce((sum, time, _, arr) => sum + time / arr.length, 0);
        
        if (avgEventTime > 16) {
            recommendations.push('Event handlers are slow - consider debouncing or optimization');
        }
        
        return recommendations;
    }
}

// Auto-start monitoring in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const monitor = new ClientPerformanceMonitor();
    
    // Start monitoring when Alpine is initialized
    document.addEventListener('alpine:initialized', () => {
        monitor.startMonitoring();
    });
    
    // Stop monitoring and generate report on page unload
    window.addEventListener('beforeunload', () => {
        monitor.stopMonitoring();
    });
    
    // Export for debugging
    window.performanceMonitor = monitor;
}

export default ClientPerformanceMonitor;