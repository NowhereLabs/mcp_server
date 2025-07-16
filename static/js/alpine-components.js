/**
 * Alpine.js Components Entry Point
 * 
 * This module serves as the main entry point for all Alpine.js components
 * in the MCP Dashboard. It imports and registers all components globally,
 * sets up error handling, and initializes the Alpine.js framework.
 * 
 * @fileoverview Main Alpine.js components initialization and registration
 */

import Alpine from 'alpinejs';

// Import error handling utilities
import { ErrorHandler, setupGlobalErrorHandling } from './utils/error-handler.js';

// Import components
import { echoTool } from './components/echo-tool.js';
import { metricsStore } from './components/metrics-dashboard.js';
import { eventStream } from './components/event-stream.js';
import { notificationSystem } from './components/notification-system.js';
import { toolExecutor } from './components/tool-executor.js';
import { initializeHtmxAlpineBridge } from './components/htmx-alpine-bridge.js';
import { dashboardControls, enhancedEventStream } from './components/dashboard-controls.js';

/**
 * Register global components
 * 
 * Makes all Alpine.js components available globally on the window object
 * for use in HTML templates and other scripts.
 */
window.echoTool = echoTool;
window.metricsStore = metricsStore;
window.eventStream = eventStream;
window.notificationSystem = notificationSystem;
window.toolExecutor = toolExecutor;
window.dashboardControls = dashboardControls;
window.enhancedEventStream = enhancedEventStream;

/**
 * Make error handler available globally
 * 
 * Provides global access to the ErrorHandler utility for
 * consistent error handling across all components.
 */
window.ErrorHandler = ErrorHandler;

/**
 * Setup global error handling
 * 
 * Configures global error handlers for unhandled errors
 * and promise rejections to ensure robust error management.
 */
setupGlobalErrorHandling();

/**
 * Initialize Alpine.js framework
 * 
 * Starts the Alpine.js framework and activates all registered components.
 */
Alpine.start();

/**
 * Initialize HTMX-Alpine.js bridge after Alpine is ready
 * 
 * Sets up the integration between HTMX and Alpine.js for
 * seamless server-side event handling and DOM updates.
 */
document.addEventListener('alpine:initialized', () => {
    initializeHtmxAlpineBridge();
});