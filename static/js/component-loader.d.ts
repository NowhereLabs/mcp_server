// Type declarations for component-loader.js

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

export declare class ComponentLoader {
  private loadedComponents: Set<string>;
  private componentRegistry: Map<string, () => Promise<any>>;
  private loadingPromises: Map<string, Promise<any>>;
  
  constructor();
  
  register(name: string, loader: () => Promise<any>): void;
  load(name: string): Promise<any>;
  preload(componentNames: string[]): Promise<void>;
  getStats(): ComponentLoaderStats;
}

export declare class ComponentPerformanceMonitor {
  private loadTimes: Map<string, number>;
  private renderTimes: Map<string, number>;
  private memoryUsage: Map<string, number>;
  
  constructor();
  
  startLoadTimer(componentName: string): void;
  endLoadTimer(componentName: string): number;
  measureRenderTime<T>(componentName: string, renderFn: () => T): T;
  getPerformanceReport(): ComponentPerformanceReport;
  getAverageLoadTime(): number;
  getAverageRenderTime(): number;
}

export declare const componentLoader: ComponentLoader;
export declare const performanceMonitor: ComponentPerformanceMonitor;

export declare function createOptimizedComponent<T extends any[], R>(
  name: string, 
  factory: (...args: T) => R
): (...args: T) => R & { $componentName: string; $loadTime: number; destroy?(): void };