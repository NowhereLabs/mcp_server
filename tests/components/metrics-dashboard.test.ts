/**
 * Tests for Metrics Dashboard Alpine.js Component
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { metricsDashboard } from '@components/metrics-dashboard';

// Types for testing
interface MetricsData {
  server_status: string;
  tool_calls_count: number;
  error_count: number;
  uptime: number;
  memory_usage: number;
  performance_metrics: {
    response_time: number;
    throughput: number;
  };
}

interface MockMetricsStore {
  data: MetricsData;
  loading: boolean;
  error: string | null;
  update: ReturnType<typeof vi.fn>;
  setLoading: ReturnType<typeof vi.fn>;
  setError: ReturnType<typeof vi.fn>;
}

interface MetricsDashboardComponent {
  refreshInterval: number;
  autoRefresh: boolean;
  lastRefresh: string | null;
  metrics: MetricsData;
  loading: boolean;
  error: string | null;
  init: () => void;
  destroy: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  refresh: () => Promise<void>;
  formatUptime: (seconds: number) => string;
  formatMemoryUsage: (bytes: number) => string;
  getStatusColor: (status: string) => string;
  $store: any;
}

interface MockAlpine {
  store: ReturnType<typeof vi.fn>;
}

declare global {
  var Alpine: any;
}

describe('Metrics Dashboard Component', () => {
  let component: any;
  let mockStore: MockMetricsStore;

  beforeEach(() => {
    // Create mock metrics store
    mockStore = {
      data: {
        server_status: 'running',
        tool_calls_count: 10,
        error_count: 2,
        uptime: 3600,
        memory_usage: 1024000,
        performance_metrics: {
          response_time: 150,
          throughput: 95.5
        }
      },
      loading: false,
      error: null,
      update: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn()
    };

    // Mock Alpine global (exactly like event-stream)
    global.Alpine = {
      store: vi.fn((name: string) => {
        if (name === 'metrics') return mockStore;
        return undefined;
      })
    };

    // Mock fetch globally
    global.fetch = vi.fn();

    // Create component instance (exactly like event-stream)
    component = metricsDashboard();
    
    // Set up the $store property manually for testing
    component.$store = {
      metrics: mockStore
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(component.refreshInterval).toBe(30000);
      expect(component.autoRefresh).toBe(true);
      expect(component.lastRefresh).toBeNull();
    });

    it('should start auto refresh on init', () => {
      const startSpy = vi.spyOn(component, 'startAutoRefresh');
      component.init();
      
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe('Metrics Getters', () => {
    it('should return metrics from store', () => {
      expect(component.metrics).toEqual(mockStore.data);
      expect(component.loading).toBe(false);
      expect(component.error).toBeNull();
    });
  });

  describe('Auto Refresh', () => {
    it('should start auto refresh', () => {
      vi.useFakeTimers();
      const refreshSpy = vi.spyOn(component, 'refresh').mockImplementation(() => Promise.resolve());
      
      component.startAutoRefresh();
      
      // Fast forward time
      vi.advanceTimersByTime(30000);
      
      expect(refreshSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should stop auto refresh', () => {
      vi.useFakeTimers();
      const refreshSpy = vi.spyOn(component, 'refresh').mockImplementation(() => Promise.resolve());
      
      component.startAutoRefresh();
      component.stopAutoRefresh();
      
      // Fast forward time
      vi.advanceTimersByTime(30000);
      
      expect(refreshSpy).not.toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });

  describe('Data Refresh', () => {
    it('should refresh metrics successfully', async () => {
      const mockResponse = {
        server_status: 'running',
        tool_calls_count: 15,
        error_count: 1,
        uptime: 7200,
        memory_usage: 2048000,
        performance_metrics: {
          response_time: 120,
          throughput: 98.2
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await component.refresh();

      expect(mockStore.setLoading).toHaveBeenCalledWith(true);
      expect(mockStore.update).toHaveBeenCalledWith(mockResponse);
      expect(mockStore.setLoading).toHaveBeenCalledWith(false);
      expect(component.lastRefresh).toBeDefined();
    });

    it('should handle refresh errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await component.refresh();

      expect(mockStore.setError).toHaveBeenCalledWith('Network error');
      expect(mockStore.setLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('Utility Methods', () => {
    it('should format uptime correctly', () => {
      expect(component.formatUptime(3600)).toBe('1h 0m');
      expect(component.formatUptime(90)).toBe('1m 30s');
      expect(component.formatUptime(30)).toBe('30s');
    });

    it('should format memory usage correctly', () => {
      expect(component.formatMemoryUsage(1024)).toBe('1.0 KB');
      expect(component.formatMemoryUsage(1048576)).toBe('1.0 MB');
      expect(component.formatMemoryUsage(1073741824)).toBe('1.0 GB');
    });

    it('should return correct status colors', () => {
      expect(component.getStatusColor('running')).toBe('text-green-400');
      expect(component.getStatusColor('error')).toBe('text-red-400');
      expect(component.getStatusColor('warning')).toBe('text-yellow-400');
      expect(component.getStatusColor('unknown')).toBe('text-gray-400');
    });
  });

  describe('Cleanup', () => {
    it('should stop auto refresh on destroy', () => {
      const stopSpy = vi.spyOn(component, 'stopAutoRefresh');
      
      component.destroy();
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});