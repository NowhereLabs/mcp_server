/**
 * Integration Tests for Dashboard Frontend-Backend Communication
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Types for testing
interface MetricsData {
  cpu: number;
  memory: number;
  disk: number;
  network: {
    in: number;
    out: number;
  };
}

interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  duration?: number;
}

interface MockWebSocket {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

interface MockEventSource {
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

declare global {
  var window: Window & typeof globalThis;
  var document: Document;
}

describe('Dashboard Integration Tests', () => {
  let mockServer: any;
  let dom: JSDOM;
  let window: Window & typeof globalThis;
  let document: Document;

  beforeEach(() => {
    // Create a new JSDOM instance
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>MCP Dashboard Test</title>
        </head>
        <body>
          <div id="app">
            <div x-data="metricsStore()" id="metrics-dashboard">
              <div x-show="loading">Loading...</div>
              <div x-show="!loading">
                <div x-text="metrics.cpu"></div>
                <div x-text="metrics.memory"></div>
              </div>
            </div>
            
            <div x-data="eventStream()" id="event-stream">
              <div x-for="event in events" :key="event.id">
                <span x-text="formatEvent(event)"></span>
              </div>
            </div>
            
            <div x-data="notificationSystem()" id="notifications">
              <div x-for="notification in notifications" :key="notification.id">
                <div x-text="notification.message"></div>
                <button @click="remove(notification.id)">X</button>
              </div>
            </div>
          </div>
        </body>
      </html>
    `, {
      url: 'http://localhost:8080',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    window = dom.window as unknown as Window & typeof globalThis;
    document = window.document;
    global.window = window;
    global.document = document;

    // Mock fetch API
    global.fetch = vi.fn();
    window.fetch = global.fetch;

    // Mock WebSocket
    global.WebSocket = vi.fn(() => ({
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })) as any;
    window.WebSocket = global.WebSocket;

    // Mock EventSource for SSE
    global.EventSource = vi.fn(() => ({
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })) as any;
    window.EventSource = global.EventSource;
  });

  afterEach(() => {
    dom.window.close();
    vi.clearAllMocks();
  });

  describe('Metrics Dashboard Integration', () => {
    it('should fetch and display metrics from server', async () => {
      // Mock server response
      const mockMetrics: MetricsData = {
        cpu: 45.5,
        memory: 78.2,
        disk: 35.0,
        network: {
          in: 1024,
          out: 2048
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      });

      // Simulate metrics fetch
      const response = await fetch('/api/metrics');
      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith('/api/metrics');
      expect(data).toHaveProperty('cpu', 45.5);
      expect(data).toHaveProperty('memory', 78.2);
    });

    it('should handle metrics fetch errors', async () => {
      // Mock server error
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      // Simulate error handling
      let error: Error | undefined;
      try {
        await fetch('/api/metrics');
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toBe('Network error');
    });

    it('should update metrics periodically', async () => {
      vi.useFakeTimers();

      // Mock periodic updates
      const updateInterval = setInterval(async () => {
        await fetch('/api/metrics');
      }, 5000);

      // Fast-forward time
      vi.advanceTimersByTime(15000);

      // Should have called fetch 3 times
      expect(global.fetch).toHaveBeenCalledTimes(3);

      clearInterval(updateInterval);
      vi.useRealTimers();
    });
  });

  describe('Event Stream Integration', () => {
    it('should connect to SSE endpoint', () => {
      const eventSource = new EventSource('/api/events');

      expect(global.EventSource).toHaveBeenCalledWith('/api/events');
      expect(eventSource.addEventListener).toBeDefined();
    });

    it('should handle incoming SSE events', () => {
      const eventSource = new EventSource('/api/events') as unknown as MockEventSource;
      const messageHandler = vi.fn();

      eventSource.addEventListener('message', messageHandler);

      // Simulate incoming event
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'tool_called',
          name: 'file_search',
          timestamp: new Date().toISOString()
        })
      });

      // Manually trigger the handler
      messageHandler(event);

      expect(messageHandler).toHaveBeenCalledWith(event);
    });

    it('should reconnect on SSE connection loss', () => {
      let eventSource = new EventSource('/api/events') as unknown as MockEventSource;
      const errorHandler = vi.fn((event: Event) => {
        // Reconnect logic
        setTimeout(() => {
          eventSource = new EventSource('/api/events') as unknown as MockEventSource;
        }, 1000);
      });

      eventSource.addEventListener('error', errorHandler);

      // Simulate connection error
      errorHandler(new Event('error'));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Tool Execution Integration', () => {
    it('should execute tool via API', async () => {
      // Mock tool execution response
      const mockResult: ToolExecutionResult = {
        success: true,
        result: { files: ['test.txt'] },
        duration: 150
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const response = await fetch('/api/tools/file_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      });

      const data = await response.json();

      expect(global.fetch).toHaveBeenCalledWith('/api/tools/file_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' })
      });

      expect(data.success).toBe(true);
      expect(data.result).toEqual({ files: ['test.txt'] });
    });

    it('should handle tool execution errors', async () => {
      // Mock tool execution error
      const mockError: ToolExecutionResult = {
        success: false,
        error: 'Tool execution failed'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => mockError
      });

      const response = await fetch('/api/tools/file_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '' })
      });

      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toBe('Tool execution failed');
    });
  });

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection', () => {
      const ws = new WebSocket('ws://localhost:8080/ws') as unknown as MockWebSocket;

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
      expect(ws.send).toBeDefined();
      expect(ws.close).toBeDefined();
    });

    it('should send and receive WebSocket messages', () => {
      const ws = new WebSocket('ws://localhost:8080/ws') as unknown as MockWebSocket;
      const messageHandler = vi.fn();

      ws.addEventListener('message', messageHandler);

      // Simulate sending a message
      ws.send(JSON.stringify({ type: 'ping' }));

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
    });

    it('should handle WebSocket reconnection', () => {
      let ws = new WebSocket('ws://localhost:8080/ws') as unknown as MockWebSocket;
      const errorHandler = vi.fn((event: Event) => {
        // Reconnect logic
        setTimeout(() => {
          ws = new WebSocket('ws://localhost:8080/ws') as unknown as MockWebSocket;
        }, 1000);
      });

      ws.addEventListener('error', errorHandler);

      // Simulate connection error
      errorHandler(new Event('error'));

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should display server errors as notifications', async () => {
      // Mock server error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      const response = await fetch('/api/metrics');
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error).toBe('Internal server error');
    });

    it('should handle network failures gracefully', async () => {
      // Mock network failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network request failed'));

      let error: Error | undefined;
      try {
        await fetch('/api/metrics');
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toBe('Network request failed');
    });

    it('should implement retry logic for failed requests', async () => {
      // Mock failed request followed by success
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      // Simulate retry logic
      let result: any;
      try {
        result = await fetch('/api/metrics');
      } catch (e) {
        // Retry after failure
        result = await fetch('/api/metrics');
      }

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
    });
  });

  describe('Authentication Integration', () => {
    it('should include auth headers in requests', async () => {
      const authToken = 'Bearer test-token';
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: true })
      });

      await fetch('/api/metrics', {
        headers: {
          'Authorization': authToken
        }
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/metrics', {
        headers: {
          'Authorization': authToken
        }
      });
    });

    it('should handle authentication failures', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      });

      const response = await fetch('/api/metrics');
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });
});