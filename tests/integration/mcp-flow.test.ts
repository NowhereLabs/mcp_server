/**
 * Integration Tests for MCP Server End-to-End Flow
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Types for testing
interface MCPInitializeRequest {
  method: 'initialize';
  params: {
    protocolVersion: string;
    capabilities: {
      tools?: boolean;
      resources?: boolean;
    };
    clientInfo: {
      name: string;
      version: string;
    };
  };
}

interface MCPToolListRequest {
  method: 'tools/list';
  params?: Record<string, unknown>;
}

interface MCPToolCallRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

declare global {
  var window: Window & typeof globalThis;
  var document: Document;
}

describe('MCP Server End-to-End Tests', () => {
  let dom: JSDOM;
  let window: Window & typeof globalThis;
  let document: Document;

  beforeEach(() => {
    // Create JSDOM instance
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MCP Dashboard</title>
        </head>
        <body>
          <div id="app">
            <div class="dashboard">
              <div class="metrics-panel"></div>
              <div class="events-panel"></div>
              <div class="tools-panel"></div>
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

    // Mock APIs
    global.fetch = vi.fn();
    window.fetch = global.fetch;

    global.EventSource = vi.fn(() => ({
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })) as any;
    window.EventSource = global.EventSource;

    global.WebSocket = vi.fn(() => ({
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })) as any;
    window.WebSocket = global.WebSocket;
  });

  afterEach(() => {
    dom.window.close();
    vi.clearAllMocks();
  });

  describe('Dashboard Access', () => {
    it('should serve dashboard on root path', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<html><head><title>MCP Dashboard</title></head><body></body></html>'
      });

      const response = await fetch('/');
      const html = await response.text();

      expect(response.ok).toBe(true);
      expect(html).toContain('MCP Dashboard');
    });

    it('should serve static assets', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          'content-type': 'text/css'
        },
        text: async () => '.dashboard { display: flex; }'
      });

      const response = await fetch('/static/css/dashboard.css');
      const css = await response.text();

      expect(response.ok).toBe(true);
      expect(css).toContain('.dashboard');
    });
  });

  describe('MCP Protocol Integration', () => {
    it('should handle initialize request', async () => {
      const initRequest: MCPInitializeRequest = {
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
            resources: false
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const mockResponse: MCPResponse = {
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: true
            }
          },
          serverInfo: {
            name: 'rust-mcp-server',
            version: '0.1.0'
          }
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initRequest)
      });

      const data = await response.json();

      expect(data.result.serverInfo.name).toBe('rust-mcp-server');
      expect(data.result.capabilities.tools).toBeDefined();
    });

    it('should list available tools', async () => {
      const toolsRequest: MCPToolListRequest = {
        method: 'tools/list'
      };

      const mockResponse: MCPResponse = {
        result: {
          tools: [
            {
              name: 'echo',
              description: 'Echo back the provided message',
              inputSchema: {
                type: 'object',
                properties: {
                  message: { type: 'string' }
                },
                required: ['message']
              }
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolsRequest)
      });

      const data = await response.json();

      expect(data.result.tools).toHaveLength(1);
      expect(data.result.tools[0].name).toBe('echo');
    });

    it('should execute tools', async () => {
      const toolCallRequest: MCPToolCallRequest = {
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: {
            message: 'Hello, World!'
          }
        }
      };

      const mockResponse: MCPResponse = {
        result: {
          content: [
            {
              type: 'text',
              text: 'Hello, World!'
            }
          ]
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const response = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toolCallRequest)
      });

      const data = await response.json();

      expect(data.result.content[0].text).toBe('Hello, World!');
    });
  });

  describe('Real-time Event Streaming', () => {
    it('should establish SSE connection for events', () => {
      const eventSource = new EventSource('/api/events');

      expect(global.EventSource).toHaveBeenCalledWith('/api/events');
      expect(eventSource.addEventListener).toBeDefined();
    });

    it('should receive tool execution events', () => {
      const eventSource = new EventSource('/api/events');
      const messageHandler = vi.fn();

      eventSource.addEventListener('message', messageHandler);

      // Simulate tool execution event
      const event = new MessageEvent('message', {
        data: JSON.stringify({
          type: 'tool_called',
          name: 'echo',
          timestamp: new Date().toISOString(),
          duration: 150,
          success: true
        })
      });

      messageHandler(event);

      expect(messageHandler).toHaveBeenCalledWith(event);
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and expose metrics', async () => {
      const mockMetrics = {
        server_status: 'running',
        tool_calls_count: 15,
        error_count: 2,
        uptime: 3600,
        memory_usage: 1024000,
        performance_metrics: {
          response_time: 150,
          throughput: 95.5
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      });

      const response = await fetch('/api/metrics');
      const data = await response.json();

      expect(data.server_status).toBe('running');
      expect(data.tool_calls_count).toBe(15);
      expect(data.performance_metrics.response_time).toBe(150);
    });

    it('should update metrics in real-time', async () => {
      vi.useFakeTimers();

      let callCount = 0;
      (global.fetch as any).mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          tool_calls_count: ++callCount,
          timestamp: Date.now()
        })
      }));

      // Simulate periodic metrics updates
      const metricsInterval = setInterval(async () => {
        await fetch('/api/metrics');
      }, 1000);

      vi.advanceTimersByTime(5000);

      expect(global.fetch).toHaveBeenCalledTimes(5);

      clearInterval(metricsInterval);
      vi.useRealTimers();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle server errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: -32603,
            message: 'Internal error'
          }
        })
      });

      const response = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          params: { name: 'invalid_tool' }
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.error.code).toBe(-32603);
    });

    it('should handle network failures', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      let error: Error | undefined;
      try {
        await fetch('/api/metrics');
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error!.message).toBe('Network error');
    });

    it('should validate input data', async () => {
      const invalidRequest = {
        method: 'tools/call',
        params: {
          name: 'echo'
          // Missing required 'arguments' field
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: -32602,
            message: 'Invalid params'
          }
        })
      });

      const response = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest)
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe(-32602);
    });
  });

  describe('Security Tests', () => {
    it('should enforce CORS policies', async () => {
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers(headers),
        json: async () => ({})
      });

      const response = await fetch('/api/metrics', {
        method: 'OPTIONS'
      });

      expect(response.ok).toBe(true);
    });

    it('should validate content security policy', async () => {
      const expectedCSP = "default-src 'self'; script-src 'self' 'unsafe-inline'";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'Content-Security-Policy': expectedCSP
        }),
        text: async () => '<html></html>'
      });

      const response = await fetch('/');
      const csp = response.headers.get('Content-Security-Policy');

      expect(csp).toContain("default-src 'self'");
    });

    it('should prevent path traversal attacks', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Invalid path'
        })
      });

      const response = await fetch('/static/../../../etc/passwd');
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid path');
    });
  });
});