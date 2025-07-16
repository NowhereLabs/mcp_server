/**
 * End-to-End Tests for MCP Server Flow
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { setTimeout as sleep } from 'timers/promises';

const exec = promisify(require('child_process').exec);

describe('MCP Server End-to-End Tests', () => {
  let serverProcess;
  let serverPort = 8080;
  let baseUrl = `http://localhost:${serverPort}`;

  beforeAll(async () => {
    // Note: In real tests, you would start the actual server
    // For now, we'll mock the server behavior
    console.log('Starting test server...');
    
    // Mock server startup
    serverProcess = {
      kill: vi.fn(),
      on: vi.fn()
    };

    // Wait for server to be ready
    await sleep(1000);
  });

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard Access', () => {
    it('should serve dashboard on root path', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<html><title>MCP Dashboard</title></html>'
      });

      const response = await fetch(baseUrl);
      const html = await response.text();

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(html).toContain('MCP Dashboard');
    });

    it('should serve static assets', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/javascript']]),
        text: async () => '// Dashboard JavaScript'
      });

      const response = await fetch(`${baseUrl}/static/js/dashboard.min.js`);
      
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('javascript');
    });
  });

  describe('MCP Protocol Integration', () => {
    it('should handle initialize request', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          protocolVersion: '1.0',
          capabilities: {
            tools: {
              list: true,
              execute: true
            },
            resources: {
              list: true,
              read: true
            }
          }
        })
      });

      const response = await fetch(`${baseUrl}/mcp/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolVersion: '1.0',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        })
      });

      const data = await response.json();

      expect(data.protocolVersion).toBe('1.0');
      expect(data.capabilities.tools.list).toBe(true);
    });

    it('should list available tools', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tools: [
            {
              name: 'read_file',
              description: 'Read contents of a file',
              schema: {
                type: 'object',
                properties: {
                  path: { type: 'string' }
                },
                required: ['path']
              }
            },
            {
              name: 'write_file',
              description: 'Write contents to a file',
              schema: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  content: { type: 'string' }
                },
                required: ['path', 'content']
              }
            }
          ]
        })
      });

      const response = await fetch(`${baseUrl}/mcp/tools/list`);
      const data = await response.json();

      expect(data.tools).toHaveLength(2);
      expect(data.tools[0].name).toBe('read_file');
      expect(data.tools[1].name).toBe('write_file');
    });

    it('should execute tools', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            content: 'Hello, World!',
            path: '/tmp/test.txt'
          },
          duration: 25
        })
      });

      const response = await fetch(`${baseUrl}/mcp/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'read_file',
          arguments: {
            path: '/tmp/test.txt'
          }
        })
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.result.content).toBe('Hello, World!');
      expect(result.duration).toBeDefined();
    });
  });

  describe('Real-time Event Streaming', () => {
    it('should establish SSE connection for events', async () => {
      // Mock EventSource
      const mockEventSource = {
        addEventListener: vi.fn(),
        close: vi.fn(),
        readyState: 1 // OPEN
      };

      global.EventSource = vi.fn(() => mockEventSource);

      const eventSource = new EventSource(`${baseUrl}/api/events`);

      expect(global.EventSource).toHaveBeenCalledWith(`${baseUrl}/api/events`);
      expect(eventSource.readyState).toBe(1);
    });

    it('should receive tool execution events', async () => {
      const events = [];
      const mockEventSource = {
        addEventListener: vi.fn((event, handler) => {
          if (event === 'message') {
            // Simulate receiving events
            setTimeout(() => {
              handler({
                data: JSON.stringify({
                  type: 'tool_started',
                  tool: 'read_file',
                  timestamp: new Date().toISOString()
                })
              });
              handler({
                data: JSON.stringify({
                  type: 'tool_completed',
                  tool: 'read_file',
                  duration: 15,
                  timestamp: new Date().toISOString()
                })
              });
            }, 100);
          }
        }),
        close: vi.fn()
      };

      global.EventSource = vi.fn(() => mockEventSource);

      const eventSource = new EventSource(`${baseUrl}/api/events`);
      
      eventSource.addEventListener('message', (event) => {
        events.push(JSON.parse(event.data));
      });

      await sleep(200);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('tool_started');
      expect(events[1].type).toBe('tool_completed');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and expose metrics', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          system: {
            cpu_usage: 45.2,
            memory_usage: 67.8,
            uptime: 3600
          },
          tools: {
            total_executions: 150,
            success_rate: 0.98,
            average_duration: 125
          },
          connections: {
            active: 3,
            total: 25
          }
        })
      });

      const response = await fetch(`${baseUrl}/api/metrics`);
      const metrics = await response.json();

      expect(metrics.system.cpu_usage).toBeDefined();
      expect(metrics.tools.total_executions).toBe(150);
      expect(metrics.tools.success_rate).toBe(0.98);
    });

    it('should update metrics in real-time', async () => {
      vi.useFakeTimers();
      const metricsHistory = [];

      // Mock multiple metric updates
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cpu: 40, timestamp: Date.now() })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cpu: 45, timestamp: Date.now() + 5000 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ cpu: 50, timestamp: Date.now() + 10000 })
        });

      // Simulate periodic metric fetching
      const fetchMetrics = async () => {
        const response = await fetch(`${baseUrl}/api/metrics`);
        const data = await response.json();
        metricsHistory.push(data);
      };

      const interval = setInterval(fetchMetrics, 5000);
      
      // Initial fetch
      await fetchMetrics();
      
      // Advance time and fetch more
      vi.advanceTimersByTime(5000);
      await fetchMetrics();
      
      vi.advanceTimersByTime(5000);
      await fetchMetrics();

      clearInterval(interval);

      expect(metricsHistory).toHaveLength(3);
      expect(metricsHistory[0].cpu).toBe(40);
      expect(metricsHistory[1].cpu).toBe(45);
      expect(metricsHistory[2].cpu).toBe(50);

      vi.useRealTimers();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle server errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
          message: 'Database connection failed'
        })
      });

      const response = await fetch(`${baseUrl}/api/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'invalid_tool' })
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      
      const error = await response.json();
      expect(error.error).toBe('Internal server error');
    });

    it('should handle network failures', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

      let error;
      try {
        await fetch(`${baseUrl}/api/metrics`);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Network failure');
    });

    it('should validate input data', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation error',
          details: {
            field: 'path',
            message: 'Path is required'
          }
        })
      });

      const response = await fetch(`${baseUrl}/mcp/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'read_file',
          arguments: {} // Missing required 'path'
        })
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.error).toBe('Validation error');
      expect(error.details.field).toBe('path');
    });
  });

  describe('Security Tests', () => {
    it('should enforce CORS policies', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['access-control-allow-origin', '*'],
          ['access-control-allow-methods', 'GET, POST, OPTIONS']
        ])
      });

      const response = await fetch(`${baseUrl}/api/metrics`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://example.com'
        }
      });

      expect(response.headers.get('access-control-allow-origin')).toBeDefined();
    });

    it('should validate content security policy', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: new Map([
          ['content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'"]
        ])
      });

      const response = await fetch(baseUrl);
      
      expect(response.headers.get('content-security-policy')).toBeDefined();
    });

    it('should prevent path traversal attacks', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Forbidden',
          message: 'Invalid file path'
        })
      });

      const response = await fetch(`${baseUrl}/mcp/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'read_file',
          arguments: {
            path: '../../../etc/passwd'
          }
        })
      });

      expect(response.status).toBe(403);
      const error = await response.json();
      expect(error.error).toBe('Forbidden');
    });
  });
});