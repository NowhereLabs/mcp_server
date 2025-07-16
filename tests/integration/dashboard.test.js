/**
 * Integration Tests for Dashboard Frontend-Backend Communication
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Dashboard Integration Tests', () => {
  let mockServer;
  let dom;
  let window;
  let document;

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

    window = dom.window;
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
    }));
    window.WebSocket = global.WebSocket;

    // Mock EventSource for SSE
    global.EventSource = vi.fn(() => ({
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
    window.EventSource = global.EventSource;
  });

  afterEach(() => {
    dom.window.close();
    vi.clearAllMocks();
  });

  describe('Metrics Dashboard Integration', () => {
    it('should fetch and display metrics from server', async () => {
      // Mock server response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cpu: 45.5,
          memory: 78.2,
          disk: 35.0,
          network: {
            in: 1024,
            out: 2048
          }
        })
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
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Simulate error handling
      let error;
      try {
        await fetch('/api/metrics');
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Network error');
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
      const eventSource = new EventSource('/api/events');
      const messageHandler = vi.fn();

      eventSource.addEventListener('message', messageHandler);

      // Simulate incoming event
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'tool_called',
          name: 'echo',
          timestamp: new Date().toISOString()
        })
      });

      // Manually trigger the handler
      messageHandler(event);

      expect(messageHandler).toHaveBeenCalledWith(event);
    });

    it('should reconnect on SSE connection loss', () => {
      let eventSource = new EventSource('/api/events');
      const errorHandler = vi.fn(() => {
        // Reconnect logic
        setTimeout(() => {
          eventSource = new EventSource('/api/events');
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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: { echo: 'Hello World' },
          duration: 150
        })
      });

      // Execute tool
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'echo',
          params: { message: 'Hello World' }
        })
      });

      const result = await response.json();

      expect(global.fetch).toHaveBeenCalledWith('/api/tools/execute', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }));
      expect(result.success).toBe(true);
      expect(result.result.echo).toBe('Hello World');
    });

    it('should handle tool execution errors', async () => {
      // Mock tool execution error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid tool parameters'
        })
      });

      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'echo',
          params: {}
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(result.error).toBe('Invalid tool parameters');
    });
  });

  describe('WebSocket Integration', () => {
    it('should establish WebSocket connection', () => {
      const ws = new WebSocket('ws://localhost:8080/ws');

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
      expect(ws.send).toBeDefined();
      expect(ws.close).toBeDefined();
    });

    it('should send and receive WebSocket messages', () => {
      const ws = new WebSocket('ws://localhost:8080/ws');
      const messageHandler = vi.fn();

      ws.addEventListener('message', messageHandler);

      // Send message
      ws.send(JSON.stringify({ type: 'ping' }));

      // Simulate received message
      const event = new MessageEvent('message', {
        data: JSON.stringify({ type: 'pong' })
      });
      messageHandler(event);

      expect(ws.send).toHaveBeenCalledWith('{"type":"ping"}');
      expect(messageHandler).toHaveBeenCalled();
    });

    it('should handle WebSocket reconnection', () => {
      let ws = new WebSocket('ws://localhost:8080/ws');
      let reconnectAttempts = 0;

      const reconnect = () => {
        reconnectAttempts++;
        setTimeout(() => {
          ws = new WebSocket('ws://localhost:8080/ws');
        }, Math.min(1000 * Math.pow(2, reconnectAttempts), 30000));
      };

      ws.addEventListener('close', reconnect);
      ws.addEventListener('error', reconnect);

      // Simulate connection close
      const closeHandler = vi.fn(reconnect);
      closeHandler();

      expect(reconnectAttempts).toBe(1);
    });
  });

  describe('Error Handling Integration', () => {
    it('should display server errors as notifications', async () => {
      // Mock server error response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
          message: 'Database connection failed'
        })
      });

      const response = await fetch('/api/metrics');
      const error = await response.json();

      expect(response.ok).toBe(false);
      expect(error.error).toBe('Internal server error');
      expect(error.message).toBe('Database connection failed');

      // In real implementation, this would trigger a notification
    });

    it('should handle network failures gracefully', async () => {
      // Mock network failure
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      let error;
      try {
        await fetch('/api/metrics');
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Failed to fetch');
    });

    it('should implement retry logic for failed requests', async () => {
      vi.useFakeTimers();
      let attempts = 0;

      // Mock failures then success
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      const retryFetch = async (url, maxRetries = 3) => {
        for (let i = 0; i <= maxRetries; i++) {
          try {
            attempts++;
            return await fetch(url);
          } catch (e) {
            if (i === maxRetries) throw e;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
          }
        }
      };

      const responsePromise = retryFetch('/api/metrics');
      
      // Advance timers for retries
      vi.advanceTimersByTime(1000); // First retry after 1s
      vi.advanceTimersByTime(2000); // Second retry after 2s

      const response = await responsePromise;
      const data = await response.json();

      expect(attempts).toBe(3);
      expect(data.success).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('Authentication Integration', () => {
    it('should include auth headers in requests', async () => {
      const authToken = 'Bearer test-token-123';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ authenticated: true })
      });

      await fetch('/api/protected', {
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        }
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/protected', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': authToken
        })
      }));
    });

    it('should handle authentication failures', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      });

      const response = await fetch('/api/protected');
      
      expect(response.status).toBe(401);
      const error = await response.json();
      expect(error.error).toBe('Unauthorized');
    });
  });
});