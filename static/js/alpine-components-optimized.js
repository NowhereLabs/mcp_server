// Optimized Alpine.js Components Entry Point
import Alpine from 'alpinejs';
import { componentLoader, performanceMonitor } from './component-loader.js';
import ClientPerformanceMonitor from './performance-monitor.js';
import { 
    optimizedEchoTool, 
    optimizedMetricsStore, 
    optimizedEventStream, 
    optimizedNotificationSystem,
    memoryOptimizer 
} from './components/optimized-components.js';

// Import other components
import { toolExecutor } from './components/tool-executor.js';
import { initializeHtmxAlpineBridge } from './components/htmx-alpine-bridge.js';
import { dashboardControls, enhancedEventStream } from './components/dashboard-controls.js';
import { errorBoundary, withErrorBoundary } from './components/error-boundary.js';

// Production optimization: Use optimized components
const USE_OPTIMIZED = process.env.NODE_ENV === 'production';

// Register components with loader for lazy loading
componentLoader.register('echoTool', async () => {
    return USE_OPTIMIZED ? optimizedEchoTool : (await import('./components/echo-tool.js')).echoTool;
});

componentLoader.register('metricsStore', async () => {
    return USE_OPTIMIZED ? optimizedMetricsStore : (await import('./components/metrics-dashboard.js')).metricsStore;
});

componentLoader.register('eventStream', async () => {
    return USE_OPTIMIZED ? optimizedEventStream : (await import('./components/event-stream.js')).eventStream;
});

componentLoader.register('notificationSystem', async () => {
    return USE_OPTIMIZED ? optimizedNotificationSystem : (await import('./components/notification-system.js')).notificationSystem;
});

// Register immediate-load components
window.toolExecutor = toolExecutor;
window.dashboardControls = dashboardControls;
window.enhancedEventStream = enhancedEventStream;
window.errorBoundary = errorBoundary;
window.withErrorBoundary = withErrorBoundary;

// Performance monitoring setup
if (process.env.DEBUG === 'true') {
    window.performanceMonitor = performanceMonitor;
    window.componentLoader = componentLoader;
    window.memoryOptimizer = memoryOptimizer;
    window.clientPerformanceMonitor = new ClientPerformanceMonitor();
}

// Alpine.js configuration
Alpine.config.preserveScroll = true;
Alpine.config.ignoreAttributes = ['data-turbo-track'];

// Error handling
window.addEventListener('error', (event) => {
    console.error('JavaScript error:', event.error);
    if (Alpine.store && Alpine.store('notifications')) {
        Alpine.store('notifications').add('An error occurred', 'error');
    }
});

// Memory management
let memoryCheckInterval;
const startMemoryMonitoring = () => {
    if (process.env.DEBUG === 'true' && performance.memory) {
        memoryCheckInterval = setInterval(() => {
            const usage = memoryOptimizer.getMemoryUsage();
            if (usage && usage.used > usage.limit * 0.8) {
                console.warn('High memory usage detected:', usage);
                memoryOptimizer.clearCaches();
            }
        }, 30000); // Check every 30 seconds
    }
};

// Component preloading for critical components
const preloadCriticalComponents = async () => {
    try {
        await componentLoader.preload(['notificationSystem', 'echoTool']);
        console.log('Critical components preloaded');
    } catch (error) {
        console.error('Failed to preload critical components:', error);
    }
};

// Lazy load components on demand
const loadComponentOnDemand = async (componentName) => {
    try {
        const component = await componentLoader.load(componentName);
        window[componentName] = component;
        return component;
    } catch (error) {
        console.error(`Failed to load component ${componentName}:`, error);
        return null;
    }
};

// Global component access with lazy loading
const createLazyComponent = (name) => {
    return function(...args) {
        if (window[name]) {
            return window[name](...args);
        }
        
        // Return a placeholder that loads the component
        return {
            $isLoading: true,
            $loadComponent: async () => {
                const component = await loadComponentOnDemand(name);
                if (component) {
                    return component(...args);
                }
                return null;
            }
        };
    };
};

// Set up lazy-loaded components
window.echoTool = createLazyComponent('echoTool');
window.metricsStore = createLazyComponent('metricsStore');
window.eventStream = createLazyComponent('eventStream');
window.notificationSystem = createLazyComponent('notificationSystem');

// Initialize Alpine.js
Alpine.start();

// Initialize everything after Alpine is ready
document.addEventListener('alpine:initialized', async () => {
    // Initialize HTMX bridge
    initializeHtmxAlpineBridge();
    
    // Preload critical components
    await preloadCriticalComponents();
    
    // Load components that are needed immediately
    await loadComponentOnDemand('notificationSystem');
    await loadComponentOnDemand('echoTool');
    
    // Start memory monitoring
    startMemoryMonitoring();
    
    // Log performance stats
    if (process.env.DEBUG === 'true') {
        console.log('Component loader stats:', componentLoader.getStats());
        console.log('Performance report:', performanceMonitor.getPerformanceReport());
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval);
    }
    memoryOptimizer.clearCaches();
});

// Export for debugging
if (process.env.DEBUG === 'true') {
    window.Alpine = Alpine;
    window.loadComponentOnDemand = loadComponentOnDemand;
}