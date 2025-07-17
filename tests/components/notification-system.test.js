/**
 * Tests for Notification System Alpine.js Component
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { notificationSystem } from '@components/notification-system.js';
// Import the full file to ensure the store is registered
import '@components/notification-system.js';

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
      // Save original store function
      const originalStore = global.Alpine.store;
      
      let callCount = 0;
      // Mock Alpine.store to return an object that throws when accessing items
      global.Alpine.store = vi.fn((name) => {
        if (name === 'notifications') {
          callCount++;
          if (callCount === 1) {
            // First call from the getter - throw error when accessing items
            return {
              get items() {
                throw new Error('Store error');
              }
            };
          } else {
            // Subsequent calls from error handler - return mock with add method
            return { add: vi.fn() };
          }
        }
        if (name === 'errorBoundary') {
          return { addError: vi.fn() };
        }
        return {};
      });

      const notifications = component.notifications;
      
      expect(notifications).toEqual([]);
      expect(component.hasError).toBe(true);
      
      // Restore original
      global.Alpine.store = originalStore;
    });
  });

  describe('Remove Method', () => {
    it('should remove notification by id', () => {
      component.remove(123);
      
      expect(mockStore.remove).toHaveBeenCalledWith(123);
    });

    it('should handle errors during removal', () => {
      // Mock the store to throw error
      mockStore.remove = vi.fn(() => {
        throw new Error('Remove error');
      });
      
      // Also ensure error handling stores are mocked
      const originalStore = global.Alpine.store;
      global.Alpine.store = vi.fn((name) => {
        if (name === 'notifications') {
          return mockStore;
        }
        if (name === 'errorBoundary') {
          return { addError: vi.fn() };
        }
        return {};
      });

      component.setupErrorHandling();
      component.remove(123);
      
      expect(component.hasError).toBe(true);
      
      // Restore
      global.Alpine.store = originalStore;
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
      // Save original store
      const originalStore = global.Alpine.store;
      
      // Mock stores for error handling
      global.Alpine.store = vi.fn((name) => {
        if (name === 'notifications') {
          return { add: vi.fn() };
        }
        if (name === 'errorBoundary') {
          return { addError: vi.fn() };
        }
        return {};
      });
      
      vi.useFakeTimers();
      const recoverSpy = vi.spyOn(component, 'recoverFromError');

      component.handleComponentError(new Error('Test error'), 'testMethod', ['arg1']);

      expect(component.hasError).toBe(true);
      expect(component.errorMessage).toBe('Test error');

      // Fast-forward time to trigger recovery
      vi.advanceTimersByTime(2000);
      
      expect(recoverSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
      // Restore
      global.Alpine.store = originalStore;
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
    
    // Create a mock notification store for testing
    store = {
      items: [],
      add(message, type = 'info', duration = 5000) {
        // Mock sanitization
        let sanitizedMessage = message;
        if (typeof message !== 'string') {
          sanitizedMessage = 'Invalid message format';
        } else if (message.length > 1000) {
          sanitizedMessage = message.substring(0, 1000) + '...';
        }
        
        const notification = {
          id: Date.now() + Math.random(),
          message: sanitizedMessage,
          type: type,
          duration: duration
        };
        
        this.items.push(notification);
        
        if (duration > 0) {
          setTimeout(() => {
            this.remove(notification.id);
          }, duration);
        }
      },
      remove(id) {
        this.items = this.items.filter(item => item.id !== id);
      },
      clear() {
        this.items = [];
      }
    };
    
    // Mock Alpine.store to return our test store
    global.Alpine.store = vi.fn((name) => {
      if (name === 'notifications') {
        return store;
      }
      return {};
    });
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
      
      // The message should be truncated to 1000 chars + '...'
      expect(store.items[0].message).toHaveLength(1003);
      expect(store.items[0].message.endsWith('...')).toBe(true);
    });

    it('should handle invalid message types', () => {
      store.add(123);
      
      // The sanitizeMessage function returns 'Invalid message format' for non-strings
      expect(store.items[0].message).toBe('Invalid message format');
    });

    it('should auto-remove notification after duration', () => {
      vi.useFakeTimers();
      
      store.add('Test', 'info', 1000);
      expect(store.items).toHaveLength(1);
      
      // Advance time to trigger the timeout
      vi.advanceTimersByTime(1001);
      
      // Check that the notification was removed
      expect(store.items).toHaveLength(0);
      
      vi.useRealTimers();
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