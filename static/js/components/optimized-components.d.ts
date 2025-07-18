// Type declarations for optimized-components.js

export interface OptimizedEchoToolComponent {
  message: string;
  result: string | null;
  executionTime: string | null;
  errors: Record<string, string>;
  executor: any;
  _isInitialized: boolean;
  
  init(): void;
  readonly loading: boolean;
  readonly executionHistory: any[];
  validateForm(): void;
  execute(): Promise<void>;
  clearHistory(): void;
  getSuccessRate(): number;
  getAverageExecutionTime(): number;
}

export interface OptimizedMetricsStoreComponent {
  readonly metrics: any;
  readonly loading: boolean;
  
  initializeUpdates(): void;
  updateMetrics(event: any): void;
  _doUpdateMetrics(event: any): void;
}

export interface OptimizedEventStreamComponent {
  readonly events: any[];
  readonly visibleEvents: any[];
  
  initializeSSE(): void;
  handleSSEMessage(event: any): void;
  _doHandleSSEMessage(event: any): void;
  updateVisibleEvents(): void;
  getEventClass(type: string): string;
  formatEvent(event: any): string;
}

export interface OptimizedNotificationSystemComponent {
  readonly notifications: any[];
  
  remove(id: string): void;
  getNotificationClass(type: string): string;
  getPooledNotification(): any | null;
  clearPool(): void;
}

export interface MemoryOptimizer {
  clearCaches(): void;
  forceGC(): void;
  getMemoryUsage(): { used: number; total: number; limit: number } | null;
}

export declare const optimizedEchoTool: () => OptimizedEchoToolComponent;
export declare const optimizedMetricsStore: () => OptimizedMetricsStoreComponent;
export declare const optimizedEventStream: () => OptimizedEventStreamComponent;
export declare const optimizedNotificationSystem: () => OptimizedNotificationSystemComponent;
export declare const memoryOptimizer: MemoryOptimizer;