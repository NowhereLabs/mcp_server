// Alpine.js Components Entry Point
import Alpine from 'alpinejs';

// Import components
import { echoTool } from './components/echo-tool.js';
import { metricsStore } from './components/metrics-dashboard.js';
import { eventStream } from './components/event-stream.js';
import { notificationSystem } from './components/notification-system.js';
import { toolExecutor } from './components/tool-executor.js';
import { initializeHtmxAlpineBridge } from './components/htmx-alpine-bridge.js';
import { dashboardControls, enhancedEventStream } from './components/dashboard-controls.js';

// Register global components
window.echoTool = echoTool;
window.metricsStore = metricsStore;
window.eventStream = eventStream;
window.notificationSystem = notificationSystem;
window.toolExecutor = toolExecutor;
window.dashboardControls = dashboardControls;
window.enhancedEventStream = enhancedEventStream;

// Initialize Alpine.js
Alpine.start();

// Initialize HTMX-Alpine.js bridge after Alpine is ready
document.addEventListener('alpine:initialized', () => {
    initializeHtmxAlpineBridge();
});