// Optimized Alpine.js Components Entry Point
// This version includes performance optimizations and lazy loading

import { componentLoader, performanceMonitor } from './component-loader';
import ClientPerformanceMonitor from './performance-monitor';

// Import optimized components
import {
    optimizedEchoTool,
    optimizedMetricsStore,
    optimizedEventStream,
    optimizedNotificationSystem
} from './components/optimized-components';
import { toolExecutor } from './components/tool-executor';
import { initializeHtmxAlpineBridge } from './components/htmx-alpine-bridge';
import { dashboardControls, enhancedEventStream } from './components/dashboard-controls';
import { errorBoundary, withErrorBoundary } from './components/error-boundary';

// Types are handled by globals.d.ts

// Feature flags
const USE_OPTIMIZED = true;
const ENABLE_PERFORMANCE_MONITORING = true;

// Performance monitor instance
let performanceMonitorInstance: ClientPerformanceMonitor | null = null;

// Initialize performance monitoring
if (ENABLE_PERFORMANCE_MONITORING) {
    performanceMonitorInstance = new ClientPerformanceMonitor();
    window.ClientPerformanceMonitor = ClientPerformanceMonitor;
}

// Component registry with lazy loading
const components = {
    echoTool: async () => {
        if (USE_OPTIMIZED) return optimizedEchoTool;
        const module = await import('./components/echo-tool');
        return module.echoTool;
    },
    metricsStore: async () => {
        if (USE_OPTIMIZED) return optimizedMetricsStore;
        const module = await import('./components/metrics-dashboard');
        return module.metricsStore;
    },
    eventStream: async () => {
        if (USE_OPTIMIZED) return optimizedEventStream;
        const module = await import('./components/event-stream');
        return module.eventStream;
    },
    notificationSystem: async () => {
        if (USE_OPTIMIZED) return optimizedNotificationSystem;
        const module = await import('./components/notification-system');
        return module.notificationSystem;
    },
    toolExecutor: () => toolExecutor,
    dashboardControls: () => dashboardControls,
    enhancedEventStream: () => enhancedEventStream,
    errorBoundary: () => errorBoundary,
    withErrorBoundary: () => withErrorBoundary
};

// Alpine.js configuration
window.Alpine = window.Alpine || {};

// Register components with Alpine
window.alpineComponents = window.alpineComponents || {};

// Create wrapped components with error boundaries
Object.entries(components).forEach(([name, loader]) => {
    window.alpineComponents![name] = async () => {
        try {
            const component = await (typeof loader === 'function' ? loader() : loader);
            return withErrorBoundary(component);
        } catch (error) {
            console.error(`Failed to load component ${name}:`, error);
            return errorBoundary();
        }
    };
});

// Make components available globally
window.echoTool = () => window.alpineComponents!.echoTool();
window.metricsStore = () => window.alpineComponents!.metricsStore();
window.eventStream = () => window.alpineComponents!.eventStream();
window.notificationSystem = () => window.alpineComponents!.notificationSystem();
window.toolExecutor = (toolName?: string) => toolExecutor(toolName || 'default');
window.dashboardControls = dashboardControls;
window.enhancedEventStream = enhancedEventStream;
window.errorBoundary = errorBoundary;
window.withErrorBoundary = withErrorBoundary;

// Performance optimization: Preload critical components
const preloadCriticalComponents = async () => {
    const critical = ['notificationSystem', 'eventStream', 'metricsStore'];
    await Promise.all(
        critical.map(name => window.alpineComponents![name]())
    );
};

// Error handling
window.addEventListener('error', (event) => {
    console.error('JavaScript error:', event.error);
    if (performanceMonitorInstance) {
        performanceMonitorInstance.trackError(event.error);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (performanceMonitorInstance) {
        performanceMonitorInstance.trackError(new Error(event.reason));
    }
});

// Initialize Alpine.js
document.addEventListener('DOMContentLoaded', async () => {
    // Preload critical components
    await preloadCriticalComponents();
    
    // Initialize Alpine
    if (window.Alpine) {
        window.Alpine.start();
        console.log('Alpine.js initialized with optimized components');
        
        // Track initialization performance
        if (performanceMonitorInstance) {
            performanceMonitorInstance.trackMetric('alpine_init_time', performance.now());
        }
    }
    
    // Initialize HTMX bridge
    initializeHtmxAlpineBridge();
});

// Export for module usage
export {
    components,
    performanceMonitorInstance
};