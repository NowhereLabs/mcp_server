/**
 * Alpine.js Components Entry Point
 * 
 * This module serves as the main entry point for all Alpine.js components
 * used in the MCP Server Dashboard. It handles component registration,
 * sets up error handling, and initializes the Alpine.js framework.
 */

/**
 * @fileoverview Main Alpine.js components initialization and registration
 * @module alpine-components
 */

import { ErrorHandler, setupGlobalErrorHandling } from './utils/error-handler';

// Import Alpine.js components
import { echoTool } from './components/echo-tool';
import { metricsStore } from './components/metrics-dashboard';
import { eventStream } from './components/event-stream';
import { notificationSystem } from './components/notification-system';
import { toolExecutor } from './components/tool-executor';
import { initializeHtmxAlpineBridge } from './components/htmx-alpine-bridge';
import { dashboardControls, enhancedEventStream } from './components/dashboard-controls';

// Import component types
import type { EchoToolComponent } from './components/echo-tool';
import type { MetricsStoreComponent } from './components/metrics-dashboard';
import type { EventStreamComponent } from './components/event-stream';
import type { NotificationSystemComponent } from './components/notification-system';
import type { ToolExecutorComponent } from './components/tool-executor';
import type { DashboardControlsComponent, EnhancedEventStreamComponent } from './components/dashboard-controls';

/**
 * Setup global error handling for the application.
 * This catches unhandled errors and promise rejections
 * to provide a better user experience.
 */
setupGlobalErrorHandling();

/**
 * Makes all Alpine.js components available globally on the window object
 * for easy access from HTML templates.
 */
window.echoTool = echoTool;
window.metricsStore = metricsStore;
window.eventStream = eventStream;
window.notificationSystem = notificationSystem;
window.toolExecutor = (toolName?: string) => toolExecutor(toolName || 'default');
window.dashboardControls = dashboardControls;
window.enhancedEventStream = enhancedEventStream;

/**
 * Initialize Alpine.js framework
 * 
 * Starts the Alpine.js framework and activates all registered components.
 * This should be called after all components are registered.
 */
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (window.Alpine) {
            window.Alpine.start();
            console.log('Alpine.js initialized successfully');
        } else {
            throw new Error('Alpine.js not found. Please include Alpine.js before this script.');
        }
    } catch (error) {
        ErrorHandler.processError(error, 'AlpineInit', 'initialization');
    }
});

/**
 * Initialize HTMX-Alpine.js bridge after Alpine is ready
 * 
 * Sets up the integration between HTMX and Alpine.js for
 * dynamic content loading with proper Alpine component initialization.
 */
document.addEventListener('alpine:init', () => {
    try {
        initializeHtmxAlpineBridge();
        console.log('HTMX-Alpine bridge initialized');
    } catch (error) {
        ErrorHandler.processError(error, 'HTMXAlpineBridge', 'initialization');
    }
});

// Export for testing purposes
export {
    echoTool,
    metricsStore,
    eventStream,
    notificationSystem,
    toolExecutor,
    dashboardControls,
    enhancedEventStream
};