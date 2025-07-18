/**
 * Test Setup for Alpine.js Components
 * 
 * This file sets up the test environment for Alpine.js components,
 * including global mocks and utilities.
 */

// Mock Alpine.js global
import { vi, beforeEach, afterEach } from 'vitest';

// Types for test environment
interface NotificationItem {
  id: number;
  message: string;
  type: string;
  duration: number;
}

interface MockNotificationStore {
  items: NotificationItem[];
  add: any;
  remove: any;
  clear: any;
}

interface MockMetricsStore {
  data: Record<string, any>;
  loading: boolean;
  update: any;
  setLoading: any;
}

interface EventData {
  id?: number;
  [key: string]: any;
}

interface MockEventStreamStore {
  events: EventData[];
  maxEvents: number;
  addEvent: any;
  clear: any;
}

interface ErrorBoundaryError {
  error: any;
  component: string;
  method: string;
}

interface MockErrorBoundaryStore {
  errors: ErrorBoundaryError[];
  addError: any;
  clearErrors: any;
}

interface MockStores {
  notifications: MockNotificationStore;
  metrics: MockMetricsStore;
  eventStream: MockEventStreamStore;
  errorBoundary: MockErrorBoundaryStore;
}

interface MockPerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface MockPerformance {
  now: any;
  memory: MockPerformanceMemory;
}

interface MockConsole {
  log: any;
  warn: any;
  error: any;
  [key: string]: any;
}

// Extend global interface
declare global {
  var Alpine: any;
  var mountComponent: (html: string, data?: Record<string, any>) => Element | null;
  var waitForAlpine: () => Promise<void>;
  var createAlpineComponent: <T extends Record<string, any>>(
    componentFactory: () => T,
    mockStoreOverrides?: Partial<MockStores>,
    mockMagicProps?: Partial<AlpineComponentMagic>
  ) => T & AlpineComponentMagic;
}

// Create mock Alpine object for tests
const mockAlpine = {
  store: vi.fn(),
  start: vi.fn(),
  data: vi.fn(),
  directive: vi.fn(),
  magic: vi.fn(),
  plugin: vi.fn(),
  prefix: vi.fn(),
  nextTick: vi.fn(),
  version: '3.13.0'
};

// Make Alpine available globally for tests
global.Alpine = mockAlpine;

// Initialize Alpine stores
beforeEach(() => {
  // Reset Alpine between tests
  if (global.Alpine && global.Alpine.store) {
    // Clear all stores
    (global.Alpine as any).stores = {};
  }
  
  // Set up mock store function
  const mockStores: MockStores = {
    notifications: {
      items: [],
      add: vi.fn((message: string, type: string = 'info', duration: number = 5000) => {
        const item: NotificationItem = {
          id: Date.now() + Math.random(),
          message,
          type,
          duration
        };
        mockStores.notifications.items.push(item);
      }),
      remove: vi.fn((id: number) => {
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
      update: vi.fn((newData: Record<string, any>) => {
        mockStores.metrics.data = { ...mockStores.metrics.data, ...newData };
        mockStores.metrics.loading = false;
      }),
      setLoading: vi.fn((state: boolean) => {
        mockStores.metrics.loading = state;
      })
    },
    eventStream: {
      events: [],
      maxEvents: 20,
      addEvent: vi.fn((event: EventData) => {
        if (event && typeof event === 'object') {
          const eventWithId: EventData = { ...event, id: Date.now() + Math.random() };
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
      addError: vi.fn((error: any, component: string, method: string) => {
        const errorEntry: ErrorBoundaryError = { error, component, method };
        mockStores.errorBoundary.errors.push(errorEntry);
      }),
      clearErrors: vi.fn(() => {
        mockStores.errorBoundary.errors = [];
      })
    }
  };
  
  // Mock Alpine.store to return our mock stores
  global.Alpine.store = vi.fn((name: string) => {
    if (!mockStores[name as keyof MockStores]) {
      // Return a default mock for any unmocked stores
      return {
        addError: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn()
      };
    }
    return mockStores[name as keyof MockStores];
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
Object.assign(global.performance, {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 10000000,
    totalJSHeapSize: 20000000,
    jsHeapSizeLimit: 50000000
  }
});

// Mock console methods for cleaner test output
Object.assign(global.console, {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
});

// Utility function to mount Alpine component
global.mountComponent = (html: string, data: Record<string, any> = {}): Element | null => {
  document.body.innerHTML = html;
  
  // Find Alpine component
  const element = document.querySelector('[x-data]');
  if (element) {
    // Initialize Alpine on the element
    Alpine.initTree(element as any);
  }
  
  return element;
};

// Utility to wait for Alpine to update
global.waitForAlpine = (): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};

/**
 * Alpine.js Component Factory for Testing
 * 
 * This utility creates properly bound Alpine.js components for testing by:
 * 1. Injecting Alpine.js magic properties ($store, $el, $refs, etc.)
 * 2. Properly binding 'this' context to component methods
 * 3. Providing consistent mock stores and environment
 */
export function createAlpineComponent<T extends Record<string, any>>(
  componentFactory: () => T,
  mockStoreOverrides?: Partial<MockStores>,
  mockMagicProps?: Partial<AlpineComponentMagic>
): T & AlpineComponentMagic {
  // Create mock DOM element
  const mockElement = document.createElement('div');
  document.body.appendChild(mockElement);
  
  // Create mock Alpine magic properties
  const mockMagicProperties = {
    $store: global.Alpine.store,
    $el: mockElement,
    $refs: {},
    $watch: vi.fn(),
    $dispatch: vi.fn(),
    $nextTick: vi.fn((callback: () => void) => {
      setTimeout(callback, 0);
    }),
    ...mockMagicProps
  };
  
  // Create the component instance
  const component = componentFactory();
  
  // Bind Alpine.js magic properties to the component
  Object.assign(component, mockMagicProperties);
  
  // Bind all methods to the component instance to ensure proper 'this' context
  Object.keys(component).forEach(key => {
    if (typeof (component as any)[key] === 'function') {
      (component as any)[key] = (component as any)[key].bind(component);
    }
  });
  
  // Override any stores if provided
  if (mockStoreOverrides) {
    const originalStore = global.Alpine.store;
    global.Alpine.store = vi.fn((name: string) => {
      if (mockStoreOverrides[name as keyof MockStores]) {
        return mockStoreOverrides[name as keyof MockStores];
      }
      return originalStore(name);
    });
    (component as any).$store = global.Alpine.store;
  }
  
  return component as T & AlpineComponentMagic;
}

// Alpine.js component magic properties using official types
// Note: Import moved above to avoid 'import type' usage as value
type AlpineComponentMagic = {
  $store: any;
  $el: HTMLElement;
  $refs: { [key: string]: HTMLElement };
  $watch: (property: string, callback: (value: any) => void) => void;
  $dispatch: (event: string, detail?: any) => void;
  $nextTick: (callback: () => void) => void;
};

// Make createAlpineComponent available globally
global.createAlpineComponent = createAlpineComponent;