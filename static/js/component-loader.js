// Component Loader for Alpine.js - Enables lazy loading and code splitting
export class ComponentLoader {
    constructor() {
        this.loadedComponents = new Set();
        this.componentRegistry = new Map();
        this.loadingPromises = new Map();
    }
    
    // Register a component for lazy loading
    register(name, loader) {
        this.componentRegistry.set(name, loader);
    }
    
    // Load a component on demand
    async load(name) {
        if (this.loadedComponents.has(name)) {
            return this.componentRegistry.get(name);
        }
        
        if (this.loadingPromises.has(name)) {
            return this.loadingPromises.get(name);
        }
        
        const loader = this.componentRegistry.get(name);
        if (!loader) {
            throw new Error(`Component "${name}" not registered`);
        }
        
        const loadPromise = (async () => {
            try {
                const component = await loader();
                this.loadedComponents.add(name);
                return component;
            } catch (error) {
                console.error(`Failed to load component "${name}":`, error);
                throw error;
            } finally {
                this.loadingPromises.delete(name);
            }
        })();
        
        this.loadingPromises.set(name, loadPromise);
        return loadPromise;
    }
    
    // Pre-load critical components
    async preload(componentNames) {
        const promises = componentNames.map(name => this.load(name));
        await Promise.all(promises);
    }
    
    // Get loading statistics
    getStats() {
        return {
            registered: this.componentRegistry.size,
            loaded: this.loadedComponents.size,
            loading: this.loadingPromises.size,
            loadedComponents: Array.from(this.loadedComponents),
        };
    }
}

// Global component loader instance
export const componentLoader = new ComponentLoader();

// Performance monitoring for component loading
export class ComponentPerformanceMonitor {
    constructor() {
        this.loadTimes = new Map();
        this.renderTimes = new Map();
        this.memoryUsage = new Map();
    }
    
    startLoadTimer(componentName) {
        this.loadTimes.set(componentName, performance.now());
    }
    
    endLoadTimer(componentName) {
        const startTime = this.loadTimes.get(componentName);
        if (startTime) {
            const duration = performance.now() - startTime;
            console.log(`Component "${componentName}" loaded in ${duration.toFixed(2)}ms`);
            return duration;
        }
        return 0;
    }
    
    measureRenderTime(componentName, renderFn) {
        const startTime = performance.now();
        const result = renderFn();
        const endTime = performance.now();
        
        this.renderTimes.set(componentName, endTime - startTime);
        return result;
    }
    
    getPerformanceReport() {
        return {
            loadTimes: Object.fromEntries(this.loadTimes),
            renderTimes: Object.fromEntries(this.renderTimes),
            averageLoadTime: this.getAverageLoadTime(),
            averageRenderTime: this.getAverageRenderTime(),
        };
    }
    
    getAverageLoadTime() {
        const times = Array.from(this.loadTimes.values());
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }
    
    getAverageRenderTime() {
        const times = Array.from(this.renderTimes.values());
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }
}

// Global performance monitor
export const performanceMonitor = new ComponentPerformanceMonitor();

// Optimized component factory
export function createOptimizedComponent(name, factory) {
    return function(...args) {
        performanceMonitor.startLoadTimer(name);
        
        const component = performanceMonitor.measureRenderTime(name, () => factory(...args));
        
        // Add performance tracking to the component
        if (component && typeof component === 'object') {
            component.$componentName = name;
            component.$loadTime = performanceMonitor.endLoadTimer(name);
            
            // Add cleanup method
            const originalDestroy = component.destroy;
            component.destroy = function() {
                if (originalDestroy) {
                    originalDestroy.call(this);
                }
                performanceMonitor.loadTimes.delete(name);
                performanceMonitor.renderTimes.delete(name);
            };
        }
        
        return component;
    };
}