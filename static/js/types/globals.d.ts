/**
 * Global ambient declarations for the MCP Dashboard
 * These types are available globally without imports
 */

// Alpine.js global instance
declare global {
  interface Window {
    Alpine: {
      store: (name: string, data?: any) => any;
      data: (name: string, data: any) => any;
      start: () => void;
      version: string;
    };
    
    // Component functions
    fileTool?: () => any;
    metricsStore?: () => any;
    eventStream?: () => any;
    notificationSystem?: () => any;
    toolExecutor?: (toolName?: string) => any;
    dashboardControls?: () => any;
    enhancedEventStream?: () => any;
    
    // Component registry
    alpineComponents?: Record<string, () => Promise<any>>;
    
    // Performance and utility classes
    performanceMonitor?: any;
    ClientPerformanceMonitor?: any;
    componentLoader?: any;
    memoryOptimizer?: any;
    
    // Memory management
    gc?: () => void;
    
    // Error handling
    errorBoundary?: () => any;
    withErrorBoundary?: (component: any, name?: string) => any;
    
    // Server-Sent Events
    EventSource: {
      new (url: string, eventSourceInitDict?: EventSourceInit): EventSource;
      prototype: EventSource;
    };
    
    // MCP Dashboard specific globals
    MCP_DASHBOARD: {
      version: string;
      buildMode: 'development' | 'production';
      debug: boolean;
    };
  }
  
  // Alpine.js component context
  interface AlpineComponent {
    $store: import('./alpine').AlpineGlobalStores;
    $el: HTMLElement;
    $refs: { [key: string]: HTMLElement };
    $watch: (property: string, callback: (value: any) => void) => void;
    $dispatch: (event: string, detail?: any) => void;
    $nextTick: (callback: () => void) => void;
  }
  
  // Global environment variables
  const process: {
    env: {
      NODE_ENV: 'development' | 'production' | 'test';
      DEBUG: string;
      [key: string]: string | undefined;
    };
  };
  
  // HTMX globals (if using HTMX)
  interface HTMXEventDetail {
    elt: HTMLElement;
    xhr: XMLHttpRequest;
    target: HTMLElement;
    requestConfig: any;
  }
  
  interface HTMXEvent extends CustomEvent {
    detail: HTMXEventDetail;
  }
  
  // Custom error types for dashboard
  interface DashboardError extends Error {
    type: import('./alpine').ErrorType;
    severity: import('./alpine').ErrorSeverity;
    details?: import('./alpine').ErrorDetails;
  }
  
  // Performance monitoring globals
  interface PerformanceEntry {
    name: string;
    duration: number;
    startTime: number;
    entryType: string;
  }
  
  // Console with dashboard-specific logging
  interface Console {
    debug: (message?: any, ...optionalParams: any[]) => void;
    error: (message?: any, ...optionalParams: any[]) => void;
    info: (message?: any, ...optionalParams: any[]) => void;
    log: (message?: any, ...optionalParams: any[]) => void;
    warn: (message?: any, ...optionalParams: any[]) => void;
  }
}

// Module declarations for assets
declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.html' {
  const content: string;
  export default content;
}

// Re-export for convenience
export {};