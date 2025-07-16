/**
 * Tests for Echo Tool Alpine.js Component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { echoTool } from '@components/echo-tool.js';

describe('Echo Tool Component', () => {
  let component;

  beforeEach(() => {
    // Create a fresh component instance
    component = echoTool();
    
    // Mock the tool executor
    component.executor = {
      execute: vi.fn(),
      loading: false,
      executionHistory: [],
      clearHistory: vi.fn(),
      getSuccessRate: vi.fn().mockReturnValue(0.95),
      getAverageExecutionTime: vi.fn().mockReturnValue(150),
      lastResult: null
    };
  });

  describe('Initialization', () => {
    it('should have default message', () => {
      expect(component.message).toBe('Hello from the MCP Dashboard!');
    });

    it('should have null result initially', () => {
      expect(component.result).toBeNull();
      expect(component.executionTime).toBeNull();
    });

    it('should have empty errors object', () => {
      expect(component.errors).toEqual({});
    });
  });

  describe('Input Validation', () => {
    it('should validate valid input', () => {
      const result = component.validateAndSanitizeInput('Hello World');
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBe('Hello World');
    });

    it('should reject empty input', () => {
      const result = component.validateAndSanitizeInput('');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message must be a non-empty string');
    });

    it('should reject non-string input', () => {
      const result = component.validateAndSanitizeInput(123);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message must be a non-empty string');
    });

    it('should reject input that is too long', () => {
      const longString = 'a'.repeat(1001);
      const result = component.validateAndSanitizeInput(longString);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message too long (max 1000 characters)');
    });

    it('should reject input with dangerous patterns', () => {
      const dangerous = '<script>alert("XSS")</script>';
      const result = component.validateAndSanitizeInput(dangerous);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Message contains potentially dangerous content');
    });

    it('should trim whitespace from input', () => {
      const result = component.validateAndSanitizeInput('  Hello World  ');
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Hello World');
    });
  });

  describe('Execute Method', () => {
    it('should execute with valid input', async () => {
      component.message = 'Test message';
      component.executor.execute.mockResolvedValue({
        success: true,
        result: { echo: 'Test message' },
        duration: 100
      });
      component.executor.lastResult = { duration: 100 };

      await component.execute();

      expect(component.executor.execute).toHaveBeenCalledWith({ 
        message: 'Test message' 
      });
      expect(component.result).toBe('{\n  "echo": "Test message"\n}');
      expect(component.executionTime).toBe('Executed in 100ms');
    });

    it('should not execute with invalid input', async () => {
      component.message = '';
      
      await component.execute();

      expect(component.executor.execute).not.toHaveBeenCalled();
      expect(component.errors.message).toBeDefined();
    });

    it('should handle execution failure', async () => {
      component.message = 'Test message';
      component.executor.execute.mockResolvedValue({
        success: false,
        error: 'Execution failed'
      });

      // Mock Alpine store
      global.Alpine = {
        store: vi.fn().mockReturnValue({
          add: vi.fn()
        })
      };

      await component.execute();

      expect(component.result).toBeNull();
      expect(component.executionTime).toBeNull();
    });

    it('should handle execution exceptions', async () => {
      component.message = 'Test message';
      component.executor.execute.mockRejectedValue(new Error('Network error'));

      await component.execute();

      expect(component.result).toBeNull();
      expect(component.executionTime).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    it('should clear history', () => {
      component.clearHistory();
      
      expect(component.executor.clearHistory).toHaveBeenCalled();
    });

    it('should get success rate', () => {
      const rate = component.getSuccessRate();
      
      expect(rate).toBe(0.95);
      expect(component.executor.getSuccessRate).toHaveBeenCalled();
    });

    it('should get average execution time', () => {
      const time = component.getAverageExecutionTime();
      
      expect(time).toBe(150);
      expect(component.executor.getAverageExecutionTime).toHaveBeenCalled();
    });

    it('should handle errors in utility methods gracefully', () => {
      component.executor.getSuccessRate.mockImplementation(() => {
        throw new Error('Test error');
      });

      const rate = component.getSuccessRate();
      
      expect(rate).toBe(0);
    });
  });

  describe('Loading State', () => {
    it('should reflect executor loading state', () => {
      expect(component.loading).toBe(false);
      
      component.executor.loading = true;
      expect(component.loading).toBe(true);
    });

    it('should handle missing executor', () => {
      component.executor = null;
      
      expect(component.loading).toBe(false);
      expect(component.executionHistory).toEqual([]);
    });
  });
});