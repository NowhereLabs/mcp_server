/**
 * Test Setup for Alpine.js Components
 * 
 * This file sets up the test environment for Alpine.js components,
 * including global mocks and utilities.
 */

// Mock Alpine.js global
import Alpine from 'alpinejs';

// Make Alpine available globally for tests
global.Alpine = Alpine;

// Initialize Alpine stores
beforeEach(() => {
  // Reset Alpine between tests
  if (global.Alpine && global.Alpine.store) {
    // Clear all stores
    global.Alpine.stores = {};
  }
  
  // Set up mock store function
  const mockStores = {
    notifications: {
      items: [],
      add: vi.fn((message, type = 'info', duration = 5000) => {
        mockStores.notifications.items.push({
          id: Date.now() + Math.random(),
          message,
          type,
          duration
        });
      }),
      remove: vi.fn((id) => {
        mockStores.notifications.items = mockStores.notifications.items.filter(
          item => item.id !== id
        );
      }),
      clear: vi.fn(() => {
        mockStores.notifications.items = [];
      })
    },
    metrics: {
      data: {},
      loading: false,
      update: vi.fn((newData) => {
        mockStores.metrics.data = { ...mockStores.metrics.data, ...newData };
        mockStores.metrics.loading = false;
      }),
      setLoading: vi.fn((state) => {
        mockStores.metrics.loading = state;
      })
    },
    eventStream: {
      events: [],
      maxEvents: 20,
      addEvent: vi.fn((event) => {
        if (event && typeof event === 'object') {
          const eventWithId = { ...event, id: Date.now() + Math.random() };
          mockStores.eventStream.events.unshift(eventWithId);
          if (mockStores.eventStream.events.length > mockStores.eventStream.maxEvents) {
            mockStores.eventStream.events.pop();
          }
        }
      }),
      clear: vi.fn(() => {
        mockStores.eventStream.events = [];
      })
    },
    errorBoundary: {
      errors: [],
      addError: vi.fn((error, component, method) => {
        mockStores.errorBoundary.errors.push({ error, component, method });
      }),
      clearErrors: vi.fn(() => {
        mockStores.errorBoundary.errors = [];
      })
    }
  };
  
  // Mock Alpine.store to return our mock stores
  global.Alpine.store = vi.fn((name) => {
    if (!mockStores[name]) {
      // Return a default mock for any unmocked stores
      return {
        addError: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn()
      };
    }
    return mockStores[name];
  });
});

// Clean up after each test
afterEach(() => {
  // Clear all timers
  vi.clearAllTimers();
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clear DOM
  document.body.innerHTML = '';
});

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 20000000,
    jsHeapSizeLimit: 50000000
  }
};

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Utility function to mount Alpine component
global.mountComponent = (html, data = {}) => {
  document.body.innerHTML = html;
  
  // Find Alpine component
  const element = document.querySelector('[x-data]');
  if (element) {
    // Initialize Alpine on the element
    Alpine.initTree(element);
  }
  
  return element;
};

// Utility to wait for Alpine to update
global.waitForAlpine = () => {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};