// Component Loader for Alpine.js - Enables lazy loading and code splitting
// TypeScript version with proper generic types

export interface ComponentLoaderStats {
    registered: number;
    loaded: number;
    loading: number;
    loadedComponents: string[];
}

export interface ComponentPerformanceReport {
    loadTimes: Record<string, number>;
    renderTimes: Record<string, number>;
    averageLoadTime: number;
    averageRenderTime: number;
}

// Generic component loader with type safety
export class ComponentLoader<T = any> {
    private loadedComponents: Set<string>;
    private componentRegistry: Map<string, () => Promise<T>>;
    private loadingPromises: Map<string, Promise<T>>;

    constructor() {
        this.loadedComponents = new Set();
        this.componentRegistry = new Map();
        this.loadingPromises = new Map();
    }

    // Register a component for lazy loading
    register(name: string, loader: () => Promise<T>): void {
        this.componentRegistry.set(name, loader);
    }

    // Load a component on demand
    async load(name: string): Promise<T> {
        if (this.loadedComponents.has(name)) {
            const loader = this.componentRegistry.get(name);
            if (loader) {
                return loader();
            }
        }

        if (this.loadingPromises.has(name)) {
            const promise = this.loadingPromises.get(name);
            if (promise) {
                return promise;
            }
        }

        const loader = this.componentRegistry.get(name);
        if (!loader) {
            throw new Error(`Component "${name}" not registered`);
        }

        const loadPromise = (async (): Promise<T> => {
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
    async preload(componentNames: string[]): Promise<void> {
        const promises = componentNames.map(name => this.load(name));
        await Promise.all(promises);
    }

    // Get loading statistics
    getStats(): ComponentLoaderStats {
        return {
            registered: this.componentRegistry.size,
            loaded: this.loadedComponents.size,
            loading: this.loadingPromises.size,
            loadedComponents: Array.from(this.loadedComponents),
        };
    }
}

// Performance monitoring for component loading
export class ComponentPerformanceMonitor {
    private loadTimes: Map<string, number>;
    private renderTimes: Map<string, number>;
    private memoryUsage: Map<string, number>;

    constructor() {
        this.loadTimes = new Map();
        this.renderTimes = new Map();
        this.memoryUsage = new Map();
    }

    startLoadTimer(componentName: string): void {
        this.loadTimes.set(componentName, performance.now());
    }

    endLoadTimer(componentName: string): number {
        const startTime = this.loadTimes.get(componentName);
        if (startTime) {
            const duration = performance.now() - startTime;
            // Only log in development mode
            if (process.env.NODE_ENV === 'development') {
                console.log(`Component "${componentName}" loaded in ${duration.toFixed(2)}ms`);
            }
            return duration;
        }
        return 0;
    }

    measureRenderTime<T>(componentName: string, renderFn: () => T): T {
        const startTime = performance.now();
        const result = renderFn();
        const endTime = performance.now();

        this.renderTimes.set(componentName, endTime - startTime);
        return result;
    }

    getPerformanceReport(): ComponentPerformanceReport {
        return {
            loadTimes: Object.fromEntries(this.loadTimes),
            renderTimes: Object.fromEntries(this.renderTimes),
            averageLoadTime: this.getAverageLoadTime(),
            averageRenderTime: this.getAverageRenderTime(),
        };
    }

    getAverageLoadTime(): number {
        const times = Array.from(this.loadTimes.values());
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    getAverageRenderTime(): number {
        const times = Array.from(this.renderTimes.values());
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    // Clean up performance data for a component
    cleanup(componentName: string): void {
        this.loadTimes.delete(componentName);
        this.renderTimes.delete(componentName);
        this.memoryUsage.delete(componentName);
    }
}

// Global component loader instance
export const componentLoader = new ComponentLoader();

// Global performance monitor
export const performanceMonitor = new ComponentPerformanceMonitor();

// Enhanced component with performance tracking
interface OptimizedComponent {
    $componentName: string;
    $loadTime: number;
    destroy?(): void;
}

// Optimized component factory with proper typing
export function createOptimizedComponent<T extends any[], R>(
    name: string, 
    factory: (...args: T) => R
): (...args: T) => R & OptimizedComponent {
    return function(...args: T): R & OptimizedComponent {
        performanceMonitor.startLoadTimer(name);
        
        const component = performanceMonitor.measureRenderTime(name, () => factory(...args));
        
        // Add performance tracking to the component
        const enhancedComponent = component as R & OptimizedComponent;
        
        if (enhancedComponent && typeof enhancedComponent === 'object') {
            enhancedComponent.$componentName = name;
            enhancedComponent.$loadTime = performanceMonitor.endLoadTimer(name);
            
            // Add cleanup method
            const originalDestroy = enhancedComponent.destroy;
            enhancedComponent.destroy = function(): void {
                if (originalDestroy) {
                    originalDestroy.call(this);
                }
                // Clean up performance tracking through public methods
                performanceMonitor.cleanup(name);
            };
        }
        
        return enhancedComponent;
    };
}