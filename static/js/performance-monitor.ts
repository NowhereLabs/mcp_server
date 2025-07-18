// Client-side performance monitoring for Alpine.js components

import { 
  PerformanceMetrics, 
  PerformanceReport, 
  MemoryUsageSnapshot, 
  NavigationTimingData 
} from './types/alpine';

// Extended Performance interface for Chrome DevTools
interface ExtendedPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

// Extended Window interface for debugging
interface ExtendedWindow extends Window {
  performanceMonitor?: ClientPerformanceMonitor;
  memoryOptimizer?: {
    clearCaches(): void;
  };
  gc?: () => void;
  MutationObserver: typeof MutationObserver;
}

declare const window: ExtendedWindow;
declare const performance: ExtendedPerformance;

export class ClientPerformanceMonitor {
  private metrics: PerformanceMetrics;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;
  private mutationObserver: MutationObserver | null = null;
  private errors: Array<{ error: Error; timestamp: number }> = [];

  constructor(options?: { enableLogging?: boolean; sampleRate?: number; bufferSize?: number }) {
    this.metrics = {
      bundleLoadTime: 0,
      componentInitTimes: {},
      memoryUsage: [],
      renderTimes: {},
      eventHandlerTimes: {},
      startTime: performance.now()
    };
  }
  
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.recordInitialMetrics();
    this.startMemoryMonitoring();
    this.setupObservers();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Performance monitoring started');
    }
  }
  
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Performance monitoring stopped');
    }
    
    this.generateReport();
  }
  
  private recordInitialMetrics(): void {
    // Record when the script finished loading
    this.metrics.bundleLoadTime = performance.now() - this.metrics.startTime;
    
    // Record navigation timing if available
    if (performance.timing) {
      this.metrics.navigationTiming = {
        loadEventEnd: performance.timing.loadEventEnd,
        domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
        domComplete: performance.timing.domComplete
      };
    }
  }
  
  private startMemoryMonitoring(): void {
    if (!performance.memory) return;
    
    // Throttled memory monitoring to reduce overhead
    this.memoryCheckInterval = setInterval(() => {
      if (!performance.memory) return;
      
      const usage: MemoryUsageSnapshot = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        timestamp: Date.now()
      };
      
      this.metrics.memoryUsage.push(usage);
      
      // Keep only last 20 measurements to reduce memory usage
      if (this.metrics.memoryUsage.length > 20) {
        this.metrics.memoryUsage.shift();
      }
      
      // Alert if memory usage is high
      if (usage.used > usage.limit * 0.9) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('🚨 High memory usage detected:', usage);
        }
        this.triggerMemoryCleanup();
      }
    }, 30000); // Increased from 5s to 30s for better performance
  }
  
  private setupObservers(): void {
    // Observe Alpine.js component initialization
    if (window.Alpine) {
      const originalStore = window.Alpine.store;
      window.Alpine.store = (name: string, value?: any) => {
        const start = performance.now();
        const result = originalStore.call(window.Alpine, name, value);
        const end = performance.now();
        
        this.metrics.componentInitTimes[name] = end - start;
        return result;
      };
    }
    
    // Observe DOM mutations for render performance
    if (window.MutationObserver) {
      this.mutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            this.recordRenderTime(mutation.target as Element);
          }
        });
      });
      
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  
  private recordRenderTime(element: Element): void {
    if (!element.getAttribute) return;
    
    const component = element.getAttribute('x-data');
    if (component) {
      const timestamp = performance.now();
      this.metrics.renderTimes[component] = timestamp;
    }
  }
  
  recordEventHandlerTime<T extends any[], R>(
    eventName: string, 
    handler: (...args: T) => R
  ): (...args: T) => R {
    return (...args: T): R => {
      const start = performance.now();
      const result = handler.apply(this, args);
      const end = performance.now();
      
      if (!this.metrics.eventHandlerTimes[eventName]) {
        this.metrics.eventHandlerTimes[eventName] = [];
      }
      
      this.metrics.eventHandlerTimes[eventName].push(end - start);
      return result;
    };
  }
  
  private triggerMemoryCleanup(): void {
    // Clear component caches
    if (window.memoryOptimizer) {
      window.memoryOptimizer.clearCaches();
    }
    
    // Clear Alpine.js internal caches
    if (window.Alpine?.store) {
      const stores = ['metrics', 'eventStream', 'notifications'];
      stores.forEach((storeName: string) => {
        try {
          if (window.Alpine?.store) {
            const store = window.Alpine.store(storeName);
            if (store) {
              const storeAny = store as any;
              if (typeof storeAny.clear === 'function') {
                storeAny.clear();
              }
            }
          }
        } catch (error) {
          // Ignore errors during cleanup
          console.debug('Error during cache cleanup:', error);
        }
      });
    }
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }
  
  private getMemoryTrend(): 'stable' | 'increasing' | 'decreasing' {
    if (this.metrics.memoryUsage.length < 2) return 'stable';
    
    const recent = this.metrics.memoryUsage.slice(-10);
    const trend = recent.reduce((acc, curr, idx) => {
      if (idx === 0) return acc;
      return acc + (curr.used - recent[idx - 1].used);
    }, 0);
    
    return trend > 1024 * 1024 ? 'increasing' : trend < -1024 * 1024 ? 'decreasing' : 'stable';
  }
  
  generateReport(): PerformanceReport {
    const currentMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
    const peakMemory = this.metrics.memoryUsage.reduce((max, curr) => 
      curr.used > max.used ? curr : max, { used: 0, total: 0, limit: 0, timestamp: 0 });
    
    const report: PerformanceReport = {
      summary: {
        bundleLoadTime: this.metrics.bundleLoadTime,
        totalComponents: Object.keys(this.metrics.componentInitTimes).length,
        memoryTrend: this.getMemoryTrend(),
        monitoringDuration: performance.now() - this.metrics.startTime
      },
      
      components: this.metrics.componentInitTimes,
      
      memory: {
        samples: this.metrics.memoryUsage.length,
        trend: this.getMemoryTrend(),
        current: currentMemory || { used: 0, total: 0, limit: 0, timestamp: 0 },
        peak: peakMemory
      },
      
      recommendations: this.generateRecommendations()
    };
    
    console.log('📈 Performance Report:', report);
    
    // Store in sessionStorage for debugging
    try {
      sessionStorage.setItem('performanceReport', JSON.stringify(report));
    } catch (error) {
      console.warn('Failed to store performance report in sessionStorage:', error);
    }
    
    return report;
  }
  
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.bundleLoadTime > 100) {
      recommendations.push('Consider lazy loading components to improve initial load time');
    }
    
    const slowComponents = Object.entries(this.metrics.componentInitTimes)
      .filter(([_, time]) => time > 10)
      .map(([name, _]) => name);
    
    if (slowComponents.length > 0) {
      recommendations.push(`Optimize slow components: ${slowComponents.join(', ')}`);
    }
    
    if (this.getMemoryTrend() === 'increasing') {
      recommendations.push('Memory usage is increasing - check for memory leaks');
    }
    
    const allEventTimes = Object.values(this.metrics.eventHandlerTimes).flat();
    if (allEventTimes.length > 0) {
      const avgEventTime = allEventTimes.reduce((sum, time) => sum + time, 0) / allEventTimes.length;
      
      if (avgEventTime > 16) {
        recommendations.push('Event handlers are slow - consider debouncing or optimization');
      }
    }
    
    return recommendations;
  }
  
  // Public getter for metrics (for debugging)
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Track errors for performance monitoring
  trackError(error: Error): void {
    this.errors.push({
      error,
      timestamp: performance.now()
    });

    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors.shift();
    }

    if (process.env.NODE_ENV === 'development') {
      console.warn('Performance Monitor - Error tracked:', error.message);
    }
  }

  // Track custom metrics
  trackMetric(name: string, value: number): void {
    if (!this.metrics.customMetrics) {
      this.metrics.customMetrics = {};
    }
    
    this.metrics.customMetrics[name] = value;

    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance Monitor - Metric tracked: ${name} = ${value}`);
    }
  }
}

// Auto-start monitoring in development
if (typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  const monitor = new ClientPerformanceMonitor();
  
  // Start monitoring when Alpine is initialized
  document.addEventListener('alpine:initialized', () => {
    monitor.startMonitoring();
  });
  
  // Stop monitoring and generate report on page unload
  window.addEventListener('beforeunload', () => {
    monitor.stopMonitoring();
  });
  
  // Export for debugging
  window.performanceMonitor = monitor;
}

export default ClientPerformanceMonitor;