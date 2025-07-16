/**
 * Tests for Metrics Dashboard Alpine.js Component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { metricsStore } from '@components/metrics-dashboard.js';

describe('Metrics Dashboard Component', () => {
  let component;
  let mockStore;

  beforeEach(() => {
    // Create mock store
    mockStore = {
      data: {},
      loading: false,
      update: vi.fn(),
      setLoading: vi.fn()
    };

    // Mock Alpine global
    global.Alpine = {
      store: vi.fn().mockReturnValue(mockStore)
    };

    // Create component instance
    component = metricsStore();
  });

  describe('Getters', () => {
    it('should return metrics data from store', () => {
      mockStore.data = {
        cpu: 45.5,
        memory: 78.2,
        requests: 1250
      };

      const metrics = component.metrics;
      
      expect(metrics).toEqual({
        cpu: 45.5,
        memory: 78.2,
        requests: 1250
      });
    });

    it('should return loading state from store', () => {
      expect(component.loading).toBe(false);
      
      mockStore.loading = true;
      expect(component.loading).toBe(true);
    });
  });

  describe('Initialize Updates', () => {
    it('should set loading state when initializing', () => {
      component.initializeUpdates();
      
      expect(mockStore.setLoading).toHaveBeenCalledWith(true);
    });
  });

  describe('Update Metrics', () => {
    it('should parse and update metrics from event', () => {
      const event = {
        detail: {
          xhr: {
            response: JSON.stringify({
              cpu: 55.5,
              memory: 82.1,
              requests: 1300
            })
          }
        }
      };

      component.updateMetrics(event);

      expect(mockStore.update).toHaveBeenCalledWith({
        cpu: 55.5,
        memory: 82.1,
        requests: 1300
      });
    });

    it('should handle JSON parse errors', () => {
      const event = {
        detail: {
          xhr: {
            response: 'invalid json'
          }
        }
      };

      component.updateMetrics(event);

      expect(mockStore.update).not.toHaveBeenCalled();
      expect(mockStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('should handle missing event data', () => {
      const event = {
        detail: {}
      };

      component.updateMetrics(event);

      expect(mockStore.update).not.toHaveBeenCalled();
      expect(mockStore.setLoading).toHaveBeenCalledWith(false);
    });
  });
});

describe('Metrics Store', () => {
  let store;

  beforeEach(() => {
    // Reset document for store initialization
    document.body.innerHTML = '';
    
    // Create a fresh store by dispatching alpine:init
    const event = new Event('alpine:init');
    document.dispatchEvent(event);
    
    // Get the store
    store = global.Alpine.store('metrics');
  });

  describe('Store Methods', () => {
    it('should initialize with empty data', () => {
      expect(store.data).toEqual({});
      expect(store.loading).toBe(false);
    });

    it('should update data and clear loading', () => {
      store.loading = true;
      
      const newData = {
        cpu: 60.5,
        memory: 85.0
      };
      
      store.update(newData);

      expect(store.data).toEqual(newData);
      expect(store.loading).toBe(false);
    });

    it('should merge new data with existing data', () => {
      store.data = {
        cpu: 50.0,
        memory: 80.0
      };

      store.update({
        memory: 85.0,
        requests: 1500
      });

      expect(store.data).toEqual({
        cpu: 50.0,
        memory: 85.0,
        requests: 1500
      });
    });

    it('should set loading state', () => {
      expect(store.loading).toBe(false);
      
      store.setLoading(true);
      expect(store.loading).toBe(true);
      
      store.setLoading(false);
      expect(store.loading).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full update cycle', () => {
      // Set loading
      store.setLoading(true);
      expect(store.loading).toBe(true);

      // Update with data
      store.update({
        cpu: 75.5,
        memory: 90.0,
        disk: 45.2
      });

      // Verify final state
      expect(store.loading).toBe(false);
      expect(store.data).toHaveProperty('cpu', 75.5);
      expect(store.data).toHaveProperty('memory', 90.0);
      expect(store.data).toHaveProperty('disk', 45.2);
    });

    it('should handle multiple sequential updates', () => {
      store.update({ cpu: 50 });
      store.update({ memory: 80 });
      store.update({ cpu: 60, disk: 40 });

      expect(store.data).toEqual({
        cpu: 60,
        memory: 80,
        disk: 40
      });
    });
  });
});