/**
 * Tests for Error Handler Utility
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ErrorHandler, 
  StandardError, 
  ERROR_TYPES, 
  ERROR_SEVERITY,
  setupGlobalErrorHandling 
} from '@utils/error-handler.js';

describe('StandardError Class', () => {
  it('should create error with all properties', () => {
    const error = new StandardError(
      'Test error message',
      ERROR_TYPES.VALIDATION,
      ERROR_SEVERITY.MEDIUM,
      'TestComponent',
      'testMethod',
      { extra: 'data' }
    );

    expect(error.message).toBe('Test error message');
    expect(error.type).toBe(ERROR_TYPES.VALIDATION);
    expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
    expect(error.component).toBe('TestComponent');
    expect(error.method).toBe('testMethod');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.id).toBeDefined();
  });

  it('should generate unique IDs', () => {
    const error1 = new StandardError('Error 1');
    const error2 = new StandardError('Error 2');
    
    expect(error1.id).not.toBe(error2.id);
  });

  it('should convert to JSON', () => {
    const error = new StandardError(
      'Test error',
      ERROR_TYPES.NETWORK,
      ERROR_SEVERITY.HIGH
    );

    const json = error.toJSON();

    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('message', 'Test error');
    expect(json).toHaveProperty('type', ERROR_TYPES.NETWORK);
    expect(json).toHaveProperty('severity', ERROR_SEVERITY.HIGH);
    expect(json).toHaveProperty('timestamp');
  });

  it('should include user-friendly message', () => {
    const error = new StandardError(
      'Technical error details',
      ERROR_TYPES.VALIDATION
    );
    error.userMessage = 'Please check your input';

    const json = error.toJSON();
    
    expect(json.userMessage).toBe('Please check your input');
  });
});

describe('ErrorHandler', () => {
  beforeEach(() => {
    // Reset error handler state
    ErrorHandler.circuitBreaker = {};
    vi.clearAllMocks();
  });

  describe('processError', () => {
    it('should process standard Error', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.processError(error, 'TestComponent', 'testMethod');

      expect(result).toBeInstanceOf(StandardError);
      expect(result.message).toBe('Test error');
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
      expect(result.component).toBe('TestComponent');
      expect(result.method).toBe('testMethod');
    });

    it('should detect validation errors', () => {
      const error = new Error('Validation failed for email field');
      const result = ErrorHandler.processError(error);

      expect(result.type).toBe(ERROR_TYPES.VALIDATION);
    });

    it('should detect network errors', () => {
      const error = new Error('Network request failed');
      const result = ErrorHandler.processError(error);

      expect(result.type).toBe(ERROR_TYPES.NETWORK);
    });

    it('should detect security errors', () => {
      const error = new Error('Unauthorized access attempt');
      const result = ErrorHandler.processError(error);

      expect(result.type).toBe(ERROR_TYPES.SECURITY);
    });

    it('should handle StandardError instances', () => {
      const standardError = new StandardError(
        'Already processed',
        ERROR_TYPES.SYSTEM,
        ERROR_SEVERITY.LOW
      );
      
      const result = ErrorHandler.processError(standardError);

      expect(result).toBe(standardError);
    });

    it('should handle non-Error objects', () => {
      const result = ErrorHandler.processError('String error');

      expect(result.message).toBe('String error');
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
    });

    it('should handle null/undefined', () => {
      const result = ErrorHandler.processError(null);

      expect(result.message).toBe('Unknown error occurred');
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
    });
  });

  describe('Error Creation Helpers', () => {
    it('should create validation error', () => {
      const error = ErrorHandler.createValidationError(
        'Invalid email format',
        { field: 'email' }
      );

      expect(error.type).toBe(ERROR_TYPES.VALIDATION);
      expect(error.severity).toBe(ERROR_SEVERITY.LOW);
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create network error', () => {
      const error = ErrorHandler.createNetworkError(
        'API request failed',
        { url: '/api/data' }
      );

      expect(error.type).toBe(ERROR_TYPES.NETWORK);
      expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
    });

    it('should create security error', () => {
      const error = ErrorHandler.createSecurityError(
        'XSS attempt detected',
        { input: '<script>' }
      );

      expect(error.type).toBe(ERROR_TYPES.SECURITY);
      expect(error.severity).toBe(ERROR_SEVERITY.CRITICAL);
    });
  });

  describe('showErrorToUser', () => {
    let mockStore;

    beforeEach(() => {
      mockStore = {
        add: vi.fn()
      };
      
      global.Alpine = {
        store: vi.fn().mockReturnValue(mockStore)
      };
    });

    it('should show error to user via notifications', () => {
      const error = new StandardError(
        'Technical error',
        ERROR_TYPES.SYSTEM,
        ERROR_SEVERITY.HIGH
      );
      error.userMessage = 'Something went wrong';

      ErrorHandler.showErrorToUser(error, 'TestComponent');

      expect(mockStore.add).toHaveBeenCalledWith(
        'Something went wrong',
        'error',
        8000
      );
    });

    it('should use default message if no user message', () => {
      const error = new StandardError('Technical details');

      ErrorHandler.showErrorToUser(error);

      expect(mockStore.add).toHaveBeenCalledWith(
        'An error occurred. Please try again.',
        'error',
        8000
      );
    });

    it('should handle missing notification store', () => {
      global.Alpine.store.mockReturnValue(null);

      // Should not throw
      expect(() => {
        ErrorHandler.showErrorToUser(new StandardError('Test'));
      }).not.toThrow();
    });
  });

  describe('Circuit Breaker', () => {
    it('should track errors per component', () => {
      const shouldHandle = ErrorHandler.shouldHandleError('TestComponent');
      
      expect(shouldHandle).toBe(true);
      expect(ErrorHandler.circuitBreaker.TestComponent).toEqual({
        count: 1,
        lastError: expect.any(Number)
      });
    });

    it('should open circuit after threshold', () => {
      // Trigger errors up to threshold
      for (let i = 0; i < 5; i++) {
        ErrorHandler.shouldHandleError('TestComponent');
      }

      // Next error should be blocked
      const shouldHandle = ErrorHandler.shouldHandleError('TestComponent');
      
      expect(shouldHandle).toBe(false);
    });

    it('should reset circuit after cooldown', () => {
      // Set up a tripped circuit
      ErrorHandler.circuitBreaker.TestComponent = {
        count: 10,
        lastError: Date.now() - 61000 // 61 seconds ago
      };

      const shouldHandle = ErrorHandler.shouldHandleError('TestComponent');
      
      expect(shouldHandle).toBe(true);
      expect(ErrorHandler.circuitBreaker.TestComponent.count).toBe(1);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user message if available', () => {
      const error = new StandardError('Technical');
      error.userMessage = 'User friendly message';

      const message = ErrorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('User friendly message');
    });

    it('should return friendly message for validation errors', () => {
      const error = new StandardError('Validation failed', ERROR_TYPES.VALIDATION);

      const message = ErrorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('Please check your input and try again.');
    });

    it('should return friendly message for network errors', () => {
      const error = new StandardError('Network failed', ERROR_TYPES.NETWORK);

      const message = ErrorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('Connection error. Please check your internet connection.');
    });

    it('should return default message for unknown errors', () => {
      const error = new StandardError('Unknown', ERROR_TYPES.UNKNOWN);

      const message = ErrorHandler.getUserFriendlyMessage(error);
      
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });
});

describe('Global Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set up window error handler', () => {
    const windowSpy = vi.spyOn(window, 'addEventListener');
    
    setupGlobalErrorHandling();

    expect(windowSpy).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should set up unhandled rejection handler', () => {
    const windowSpy = vi.spyOn(window, 'addEventListener');
    
    setupGlobalErrorHandling();

    expect(windowSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('should process window errors', () => {
    const processSpy = vi.spyOn(ErrorHandler, 'processError');
    
    setupGlobalErrorHandling();
    
    // Trigger error event
    const errorEvent = new ErrorEvent('error', {
      error: new Error('Test window error'),
      filename: 'test.js',
      lineno: 10,
      colno: 5
    });
    
    window.dispatchEvent(errorEvent);

    expect(processSpy).toHaveBeenCalled();
  });
});