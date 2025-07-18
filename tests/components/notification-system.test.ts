/**
 * Tests for Notification System Alpine.js Component
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { notificationSystem } from '@components/notification-system';
// Import the full file to ensure the store is registered
import '@components/notification-system';

// Types for testing
interface NotificationItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  timestamp: number;
}

interface MockNotificationStore {
  items: NotificationItem[];
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

interface NotificationSystemComponent {
  hasError: boolean;
  errorMessage: string | null;
  notifications: NotificationItem[];
  init: () => void;
  setupErrorHandling: () => void;
  handleComponentError: (error: Error, method: string, args?: any[]) => void;
  destroy: () => void;
  remove: (id: string | number) => void;
  getNotificationClass: (type: 'info' | 'success' | 'warning' | 'error') => string;
  $store: any;
}

interface MockAlpine {
  store: ReturnType<typeof vi.fn>;
}

declare global {
  var Alpine: any;
}

describe('Notification System Component', () => {
  let component: any;
  let mockStore: MockNotificationStore;

  beforeEach(() => {
    // Create mock Alpine store
    mockStore = {
      items: [],
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    };

    // Mock error boundary store
    const mockErrorBoundaryStore = {
      addError: vi.fn()
    };

    // Mock Alpine global
    global.Alpine = {
      store: vi.fn((storeName: string) => {
        if (storeName === 'notifications') {
          return mockStore;
        }
        if (storeName === 'errorBoundary') {
          return mockErrorBoundaryStore;
        }
        return mockStore;
      })
    };

    // Create component instance
    component = notificationSystem();
    
    // Set up the $store property manually for testing
    component.$store = {
      notifications: mockStore
    };
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
      const mockNotifications: NotificationItem[] = [
        { id: '1', message: 'Test 1', type: 'info', timestamp: Date.now() },
        { id: '2', message: 'Test 2', type: 'success', timestamp: Date.now() }
      ];
      
      mockStore.items = mockNotifications;
      
      expect(component.notifications).toEqual(mockNotifications);
    });
  });

  describe('Error Handling', () => {
    it('should handle component errors', () => {
      const error = new Error('Test error');
      
      component.handleComponentError(error, 'test-method');
      
      expect(component.hasError).toBe(true);
      expect(component.errorMessage).toBe('Test error');
    });

    it('should set up error handling for the component', () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener');
      
      component.setupErrorHandling();
      
      expect(addListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Cleanup', () => {
    it('should clean up event listeners on destroy', () => {
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      // First setup error handling to create the error handler
      component.setupErrorHandling();
      
      // Then destroy to clean up
      component.destroy();
      
      expect(removeListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });
});