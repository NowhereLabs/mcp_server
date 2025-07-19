/**
 * Alpine.js Components Entry Point - Production Build
 * 
 * Optimized production version with minimal logging and enhanced error handling.
 */

import { ErrorHandler, setupGlobalErrorHandling } from './utils/error-handler';

// Import Alpine.js components
import { metricsStore } from './components/metrics-dashboard';
import { eventStream } from './components/event-stream';
import { notificationSystem } from './components/notification-system';
import { toolExecutor } from './components/tool-executor';
import { initializeHtmxAlpineBridge } from './components/htmx-alpine-bridge';
import { dashboardControls, enhancedEventStream } from './components/dashboard-controls';

/**
 * Setup global error handling for the application.
 */
setupGlobalErrorHandling();

/**
 * Makes all Alpine.js components available globally on the window object
 */
window.metricsStore = metricsStore;
window.eventStream = eventStream;
window.notificationSystem = notificationSystem;
window.toolExecutor = (toolName?: string) => toolExecutor(toolName || 'default');
window.dashboardControls = dashboardControls;
window.enhancedEventStream = enhancedEventStream;

/**
 * Initialize Alpine.js framework - Production version
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (window.Alpine) {
            window.Alpine.start();
            // Minimal logging in production
            if (process.env.DEBUG === 'true') {
                console.log('Alpine.js initialized');
            }
        } else {
            throw new Error('Alpine.js not found. Please include Alpine.js before this script.');
        }
    } catch (error) {
        ErrorHandler.processError(error, 'AlpineInit', 'initialization');
    }
});

/**
 * Initialize HTMX-Alpine.js bridge - Production version
 */
document.addEventListener('alpine:init', () => {
    try {
        initializeHtmxAlpineBridge();
        if (process.env.DEBUG === 'true') {
            console.log('HTMX-Alpine bridge initialized');
        }
    } catch (error) {
        ErrorHandler.processError(error, 'HTMXAlpineBridge', 'initialization');
    }
});

// Production exports (minimal for tree shaking)
export {
    metricsStore,
    eventStream,
    notificationSystem,
    toolExecutor,
    dashboardControls,
    enhancedEventStream
};