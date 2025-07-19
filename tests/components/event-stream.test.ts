/**
 * Tests for Event Stream Alpine.js Component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventStream } from '../../static/js/components/event-stream';

// Types for testing
interface EventData {
  id?: string | number;
  type: string;
  name?: string;
  message?: string;
  uri?: string;
  timestamp?: string;
  [key: string]: any;
}

interface SSEEvent {
  detail: {
    data: string;
  };
}

interface MockEventStreamStore {
  events: EventData[];
  addEvent: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

interface MockErrorBoundaryStore {
  addError: ReturnType<typeof vi.fn>;
}

interface MockAlpine {
  store: ReturnType<typeof vi.fn>;
}

declare global {
  var Alpine: any;
}

describe('Event Stream Component', () => {
  let component: any;
  let mockStore: MockEventStreamStore;

  beforeEach(() => {
    // Create mock stores
    mockStore = {
      events: [],
      addEvent: vi.fn(),
      clear: vi.fn()
    };


    // Mock Alpine global
    global.Alpine = {
      store: vi.fn((name: string) => {
        if (name === 'eventStream') return mockStore;
        return undefined;
      })
    };

    // Create component instance
    component = eventStream();
    
    // Mock the $store property manually
    component.$store = {
      eventStream: mockStore
    };
  });

  describe('Events Getter', () => {
    it('should return events from store', () => {
      mockStore.events = [
        { id: 1, type: 'tool_called', message: 'Test 1' },
        { id: 2, type: 'error', message: 'Test 2' }
      ];

      const events = component.events;
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool_called');
    });
  });

  describe('SSE Message Handling', () => {
    it('should handle valid SSE message', () => {
      const event: SSEEvent = {
        detail: {
          data: JSON.stringify({
            type: 'tool_called',
            name: 'echo',
            message: 'Executing echo tool',
            timestamp: '2024-01-01T00:00:00Z'
          })
        }
      };

      component.handleSSEMessage(event);

      expect(mockStore.addEvent).toHaveBeenCalledWith({
        type: 'tool_called',
        name: 'echo',
        message: 'Executing echo tool',
        timestamp: '2024-01-01T00:00:00.000Z'
      });
    });

    it('should handle invalid JSON in SSE message', () => {
      const event: SSEEvent = {
        detail: {
          data: 'invalid json'
        }
      };

      component.handleSSEMessage(event);

      // Should handle the error gracefully without throwing
    });
  });

  describe('Event Data Sanitization', () => {
    it('should sanitize valid event data', () => {
      const data: EventData = {
        type: 'info',
        name: 'test',
        message: 'Test message',
        uri: '/test/path',
        timestamp: '2024-01-01T00:00:00Z'
      };

      const sanitized = component.sanitizeEventData(data);

      expect(sanitized).toEqual({
        type: 'info',
        name: 'test',
        message: 'Test message',
        uri: '/test/path',
        timestamp: '2024-01-01T00:00:00.000Z'
      });
    });

    it('should filter out non-whitelisted properties', () => {
      const data = {
        type: 'info',
        message: 'Test',
        malicious: '<script>alert("XSS")</script>',
        extra: 'should be removed'
      };

      const sanitized = component.sanitizeEventData(data);

      expect(sanitized).not.toHaveProperty('malicious');
      expect(sanitized).not.toHaveProperty('extra');
      expect(sanitized.type).toBe('info');
      expect(sanitized.message).toBe('Test');
    });

    it('should handle invalid timestamp', () => {
      const data: EventData = {
        type: 'info',
        timestamp: 'invalid-date'
      };

      const sanitized = component.sanitizeEventData(data);

      // Should have a valid timestamp
      expect(new Date(sanitized.timestamp)).toBeInstanceOf(Date);
      expect(isNaN(Date.parse(sanitized.timestamp))).toBe(false);
    });

    it('should handle sanitization errors', () => {
      // Pass invalid data that will cause an error
      const sanitized = component.sanitizeEventData(null);

      expect(sanitized).toEqual({
        type: 'error',
        message: 'Failed to process event data',
        timestamp: expect.any(String)
      });
    });
  });

  describe('String Sanitization', () => {
    it('should escape HTML entities', () => {
      const sanitized = component.sanitizeString('<script>alert("XSS")</script>');
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(600);
      const sanitized = component.sanitizeString(longString);
      
      expect(sanitized).toHaveLength(503); // 500 + '...'
      expect(sanitized.endsWith('...')).toBe(true);
    });

    it('should convert non-strings to strings', () => {
      const sanitized = component.sanitizeString(123);
      
      expect(sanitized).toBe('123');
      expect(typeof sanitized).toBe('string');
    });
  });

  describe('Event Class Styling', () => {
    it('should return error class', () => {
      const className = component.getEventClass('error');
      expect(className).toBe('bg-red-900 bg-opacity-30 text-red-300 border-red-500');
    });

    it('should return tool_called class', () => {
      const className = component.getEventClass('tool_called');
      expect(className).toBe('bg-green-900 bg-opacity-30 text-green-300 border-green-500');
    });

    it('should return default class for unknown type', () => {
      const className = component.getEventClass('unknown');
      expect(className).toBe('bg-blue-900 bg-opacity-30 text-blue-300 border-blue-500');
    });
  });

  describe('Event Formatting', () => {
    it('should format event with all fields', () => {
      const event: EventData = {
        timestamp: '2024-01-01T12:00:00Z',
        type: 'tool_called',
        name: 'echo',
        message: 'Executing',
        uri: '/api/tool',
        id: 'abc123'
      };

      const formatted = component.formatEvent(event);
      
      expect(formatted).toContain('[');
      expect(formatted).toContain('tool_called');
      expect(formatted).toContain('echo');
      expect(formatted).toContain('Executing');
      expect(formatted).toContain('/api/tool');
      expect(formatted).toContain('(abc123)');
    });

    it('should handle minimal event', () => {
      const event: EventData = {
        timestamp: '2024-01-01T12:00:00Z',
        type: 'info'
      };

      const formatted = component.formatEvent(event);
      
      expect(formatted).toContain('info');
      expect(formatted).not.toContain('undefined');
    });

    it('should handle invalid event data', () => {
      const formatted = component.formatEvent(null);
      
      expect(formatted).toBe('[Invalid event data]');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors and add to error boundary', () => {
      const error = new Error('Test error');
      
      component.handleEventStreamError(error, 'testMethod', ['arg1']);

      // Should handle the error gracefully
      expect(() => component.handleEventStreamError(error, 'testMethod', ['arg1'])).not.toThrow();
    });

    it('should add fallback error event on error', () => {
      const error = new Error('Test error');
      
      component.handleEventStreamError(error, 'testMethod');

      expect(mockStore.addEvent).toHaveBeenCalledWith({
        type: 'error',
        message: 'Error processing event stream',
        timestamp: expect.any(String)
      });
    });

    it('should handle fallback error gracefully', () => {
      mockStore.addEvent.mockImplementation(() => {
        throw new Error('Store error');
      });

      // Should not throw
      expect(() => {
        component.handleEventStreamError(new Error('Test'), 'method');
      }).not.toThrow();
    });
  });
});

describe('Event Stream Store', () => {
  let store: MockEventStreamStore;

  beforeEach(() => {
    // Reset document for store initialization
    document.body.innerHTML = '';
    
    // Create a fresh store by dispatching alpine:init
    const event = new Event('alpine:init');
    document.dispatchEvent(event);
    
    // Get the store
    store = global.Alpine.store('eventStream') as MockEventStreamStore;
  });

  describe('Add Event', () => {
    it('should add event with ID', () => {
      const event: EventData = { type: 'info', message: 'Test' };
      
      store.addEvent(event);
      
      expect(store.events).toHaveLength(1);
      expect(store.events[0]).toHaveProperty('id');
      expect(store.events[0].type).toBe('info');
    });

    it('should add events to beginning of array', () => {
      store.addEvent({ type: 'first' });
      store.addEvent({ type: 'second' });
      
      expect(store.events[0].type).toBe('second');
      expect(store.events[1].type).toBe('first');
    });

    it('should limit events to maxEvents', () => {
      // Add more than maxEvents
      for (let i = 0; i < 25; i++) {
        store.addEvent({ type: 'event', index: i });
      }
      
      expect(store.events).toHaveLength(20);
      // Most recent should be first
      expect(store.events[0].index).toBe(24);
    });

    it('should reject invalid events', () => {
      store.addEvent(null as any);
      store.addEvent('string' as any);
      store.addEvent(123 as any);
      
      expect(store.events).toHaveLength(0);
    });
  });

  describe('Clear Events', () => {
    it('should clear all events', () => {
      store.events = [
        { id: 1, type: 'event1' },
        { id: 2, type: 'event2' }
      ];

      store.clear();

      expect(store.events).toHaveLength(0);
    });
  });
});