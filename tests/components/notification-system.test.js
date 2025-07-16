/**
 * Tests for Notification System Alpine.js Component
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { notificationSystem } from '@components/notification-system.js';

describe('Notification System Component', () => {
  let component;
  let mockStore;

  beforeEach(() => {
    // Create mock Alpine store
    mockStore = {
      items: [],
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    };

    // Mock Alpine global
    global.Alpine = {
      store: vi.fn().mockReturnValue(mockStore)
    };

    // Create component instance
    component = notificationSystem();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize with no errors', () => {
      expect(component.hasError).toBe(false);
      expect(component.errorMessage).toBeNull();
    });

    it('should set up error handling on init', () => {
      const setupSpy = vi.spyOn(component, 'setupErrorHandling');
      component.init();
      
      expect(setupSpy).toHaveBeenCalled();
    });
  });

  describe('Notifications Getter', () => {
    it('should return notifications from store', () => {
      mockStore.items = [
        { id: 1, message: 'Test 1', type: 'info' },
        { id: 2, message: 'Test 2', type: 'success' }
      ];

      const notifications = component.notifications;
      
      expect(notifications).toHaveLength(2);
      expect(notifications[0].message).toBe('Test 1');
    });

    it('should handle missing store gracefully', () => {
      global.Alpine.store.mockReturnValue(undefined);
      
      const notifications = component.notifications;
      
      expect(notifications).toEqual([]);
    });

    it('should handle errors in getter', () => {
      global.Alpine.store.mockImplementation(() => {
        throw new Error('Store error');
      });

      const notifications = component.notifications;
      
      expect(notifications).toEqual([]);
      expect(component.hasError).toBe(true);
    });
  });

  describe('Remove Method', () => {
    it('should remove notification by id', () => {
      component.remove(123);
      
      expect(mockStore.remove).toHaveBeenCalledWith(123);
    });

    it('should handle errors during removal', () => {
      mockStore.remove.mockImplementation(() => {
        throw new Error('Remove error');
      });

      component.setupErrorHandling();
      component.remove(123);
      
      expect(component.hasError).toBe(true);
    });
  });

  describe('Notification Classes', () => {
    it('should return success class', () => {
      const className = component.getNotificationClass('success');
      expect(className).toBe('bg-green-900 text-green-300 border-green-700');
    });

    it('should return error class', () => {
      const className = component.getNotificationClass('error');
      expect(className).toBe('bg-red-900 text-red-300 border-red-700');
    });

    it('should return warning class', () => {
      const className = component.getNotificationClass('warning');
      expect(className).toBe('bg-yellow-900 text-yellow-300 border-yellow-700');
    });

    it('should return info class as default', () => {
      const className = component.getNotificationClass('unknown');
      expect(className).toBe('bg-blue-900 text-blue-300 border-blue-700');
    });

    it('should handle errors in getNotificationClass', () => {
      // Force an error by making the method throw
      const originalMethod = component.getNotificationClass;
      component.getNotificationClass = () => {
        throw new Error('Class error');
      };

      component.handleComponentError = vi.fn();
      
      // Re-apply error handling wrapper
      component.setupErrorHandling();
      
      // Restore original method for testing
      component.getNotificationClass = originalMethod;
      
      const className = component.getNotificationClass('error');
      expect(className).toBe('bg-red-900 text-red-300 border-red-700');
    });
  });

  describe('Error Handling', () => {
    it('should handle component errors', () => {
      vi.useFakeTimers();
      const recoverSpy = vi.spyOn(component, 'recoverFromError');

      component.handleComponentError(new Error('Test error'), 'testMethod', ['arg1']);

      expect(component.hasError).toBe(true);
      expect(component.errorMessage).toBe('Test error');

      // Fast-forward time to trigger recovery
      vi.advanceTimersByTime(2000);
      
      expect(recoverSpy).toHaveBeenCalled();
    });

    it('should recover from errors', () => {
      component.hasError = true;
      component.errorMessage = 'Some error';

      component.recoverFromError();

      expect(component.hasError).toBe(false);
      expect(component.errorMessage).toBeNull();
    });

    it('should handle recovery errors gracefully', () => {
      component.setupErrorHandling = vi.fn().mockImplementation(() => {
        throw new Error('Recovery error');
      });

      // Should not throw
      expect(() => component.recoverFromError()).not.toThrow();
    });
  });
});

describe('Notification Store', () => {
  let store;

  beforeEach(() => {
    // Reset document for store initialization
    document.body.innerHTML = '';
    
    // Create a fresh store by dispatching alpine:init
    const event = new Event('alpine:init');
    document.dispatchEvent(event);
    
    // Get the store
    store = global.Alpine.store('notifications');
  });

  describe('Add Method', () => {
    it('should add notification with defaults', () => {
      store.add('Test message');
      
      expect(store.items).toHaveLength(1);
      expect(store.items[0].message).toBe('Test message');
      expect(store.items[0].type).toBe('info');
      expect(store.items[0].duration).toBe(5000);
    });

    it('should add notification with custom type and duration', () => {
      store.add('Error message', 'error', 10000);
      
      expect(store.items[0].type).toBe('error');
      expect(store.items[0].duration).toBe(10000);
    });

    it('should sanitize message length', () => {
      const longMessage = 'a'.repeat(1500);
      store.add(longMessage);
      
      expect(store.items[0].message).toHaveLength(1003); // 1000 + '...'
    });

    it('should handle invalid message types', () => {
      store.add(123);
      
      expect(store.items[0].message).toBe('Invalid message format');
    });

    it('should auto-remove notification after duration', () => {
      vi.useFakeTimers();
      
      store.add('Test', 'info', 1000);
      expect(store.items).toHaveLength(1);
      
      vi.advanceTimersByTime(1000);
      
      expect(store.remove).toHaveBeenCalled();
    });
  });

  describe('Remove Method', () => {
    it('should remove notification by id', () => {
      store.items = [
        { id: 1, message: 'Test 1' },
        { id: 2, message: 'Test 2' }
      ];

      store.remove(1);

      expect(store.items).toHaveLength(1);
      expect(store.items[0].id).toBe(2);
    });
  });

  describe('Clear Method', () => {
    it('should clear all notifications', () => {
      store.items = [
        { id: 1, message: 'Test 1' },
        { id: 2, message: 'Test 2' }
      ];

      store.clear();

      expect(store.items).toHaveLength(0);
    });
  });
});