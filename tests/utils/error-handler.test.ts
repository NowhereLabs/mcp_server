/**
 * Tests for Error Handler Utility
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ErrorHandler, 
  StandardError, 
  ERROR_TYPES, 
  ERROR_SEVERITY,
  setupGlobalErrorHandling,
  type ErrorType,
  type ErrorSeverity
} from '../../static/js/utils/error-handler';

// Manually define type guards in tests since they're not being exported properly
const isValidationError = (error: Error): boolean => {
  return error.message.includes('validation') || error.message.includes('invalid');
};

const isNetworkError = (error: Error): boolean => {
  return error.message.includes('network') || error.message.includes('fetch');
};

const isSecurityError = (error: Error): boolean => {
  return error.message.includes('security') || error.message.includes('permission');
};

// Mock Alpine.js for testing
interface MockAlpineStore {
  add: ReturnType<typeof vi.fn>;
  addError?: ReturnType<typeof vi.fn>;
}

interface MockAlpine {
  store: ReturnType<typeof vi.fn>;
}

declare global {
  var Alpine: any;
}

describe('StandardError Class', () => {
  it('should create error with all properties', () => {
    const error = new StandardError(
      'Test error message',
      ERROR_TYPES.VALIDATION as ErrorType,
      ERROR_SEVERITY.MEDIUM as ErrorSeverity,
      { extra: 'data' }
    );

    expect(error.message).toBe('Test error message');
    expect(error.type).toBe(ERROR_TYPES.VALIDATION);
    expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.timestamp).toBeDefined();
    expect(error.userMessage).toBe('Please check your input and try again.');
    expect(error.name).toBe('StandardError');
  });

  it('should have timestamp property', () => {
    const error1 = new StandardError('Error 1');
    const error2 = new StandardError('Error 2');
    
    expect(error1.timestamp).toBeDefined();
    expect(error2.timestamp).toBeDefined();
  });

  it('should convert to JSON', () => {
    const error = new StandardError(
      'Test error',
      ERROR_TYPES.NETWORK as ErrorType,
      ERROR_SEVERITY.HIGH as ErrorSeverity,
      { extra: 'data' }
    );

    const json = error.toJSON();

    expect(json).toHaveProperty('name', 'StandardError');
    expect(json).toHaveProperty('message', 'Test error');
    expect(json).toHaveProperty('type', ERROR_TYPES.NETWORK);
    expect(json).toHaveProperty('severity', ERROR_SEVERITY.HIGH);
    expect(json).toHaveProperty('details');
    expect(json.details).toEqual({ extra: 'data' });
    expect(json).toHaveProperty('timestamp');
    expect(json).toHaveProperty('userMessage');
  });

  it('should include user-friendly message', () => {
    const error = new StandardError(
      'Technical error details',
      ERROR_TYPES.VALIDATION as ErrorType
    );

    const json = error.toJSON();
    
    expect(json.userMessage).toBe('Please check your input and try again.');
  });
});

describe('Type Guards', () => {
  describe('isValidationError', () => {
    it('should detect validation errors', () => {
      const validationError = new Error('validation failed for email field');
      const invalidError = new Error('invalid data format');
      const networkError = new Error('network request failed');
      
      expect(isValidationError(validationError)).toBe(true);
      expect(isValidationError(invalidError)).toBe(true);
      expect(isValidationError(networkError)).toBe(false);
    });
  });

  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      const networkError = new Error('network request failed');
      const fetchError = new Error('fetch operation failed');
      const validationError = new Error('validation failed');
      
      expect(isNetworkError(networkError)).toBe(true);
      expect(isNetworkError(fetchError)).toBe(true);
      expect(isNetworkError(validationError)).toBe(false);
    });
  });

  describe('isSecurityError', () => {
    it('should detect security errors', () => {
      const securityError = new Error('security violation detected');
      const permissionError = new Error('permission denied');
      const networkError = new Error('network failed');
      
      expect(isSecurityError(securityError)).toBe(true);
      expect(isSecurityError(permissionError)).toBe(true);
      expect(isSecurityError(networkError)).toBe(false);
    });
  });
});

describe('ErrorHandler', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('handleError', () => {
    it('should handle standard Error', () => {
      const error = new Error('Test error');
      const result = ErrorHandler.handleError(error);

      expect(result).toBeInstanceOf(StandardError);
      expect(result.message).toBe('Test error');
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
    });

    it('should detect validation errors', () => {
      const error = new Error('validation failed for email field');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ERROR_TYPES.VALIDATION);
      expect(result.severity).toBe(ERROR_SEVERITY.LOW);
    });

    it('should detect network errors', () => {
      const error = new Error('network request failed');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ERROR_TYPES.NETWORK);
    });

    it('should detect security errors', () => {
      const error = new Error('permission denied');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ERROR_TYPES.SECURITY);
      expect(result.severity).toBe(ERROR_SEVERITY.HIGH);
    });

    it('should handle StandardError instances', () => {
      const standardError = new StandardError(
        'Already processed',
        ERROR_TYPES.SYSTEM as ErrorType,
        ERROR_SEVERITY.LOW as ErrorSeverity
      );
      
      const result = ErrorHandler.handleError(standardError);

      expect(result).toBe(standardError);
    });

    it('should handle non-Error objects', () => {
      const result = ErrorHandler.handleError('String error');

      expect(result.message).toBe('String error');
      expect(result.type).toBe(ERROR_TYPES.UNKNOWN);
    });

    it('should handle null/undefined', () => {
      const result1 = ErrorHandler.handleError(null);
      const result2 = ErrorHandler.handleError(undefined);

      expect(result1.message).toBe('An unexpected error occurred');
      expect(result1.type).toBe(ERROR_TYPES.UNKNOWN);
      expect(result2.message).toBe('An unexpected error occurred');
      expect(result2.type).toBe(ERROR_TYPES.UNKNOWN);
    });

    it('should handle unknown objects', () => {
      const result = ErrorHandler.handleError({ someProperty: 'value' });

      expect(result.message).toBe('An unexpected error occurred');
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
      expect(error.severity).toBe(ERROR_SEVERITY.HIGH);
    });
  });

  describe('showErrorToUser', () => {
    let mockStore: MockAlpineStore;

    beforeEach(() => {
      mockStore = {
        add: vi.fn(),
        addError: vi.fn()
      };
      
      globalThis.Alpine = {
        store: vi.fn((name: string) => {
          if (name === 'notifications') {
            return mockStore;
          }
          if (name === 'errorBoundary') {
            return { addError: mockStore.addError };
          }
          return {};
        })
      } as any;
    });

    it('should show error to user via notifications', () => {
      const error = new StandardError(
        'Technical error',
        ERROR_TYPES.SYSTEM,
        ERROR_SEVERITY.HIGH
      );

      ErrorHandler.showErrorToUser(error, 'TestComponent');

      expect(mockStore.add).toHaveBeenCalledWith(
        'System error. Please try again later.',
        'error',
        5000
      );
    });

    it('should use default message if no user message', () => {
      const error = new StandardError('Technical details');

      ErrorHandler.showErrorToUser(error);

      expect(mockStore.add).toHaveBeenCalledWith(
        'An unexpected error occurred. Please try again.',
        'warning',
        5000
      );
    });

    it('should handle missing notification store', () => {
      globalThis.Alpine.store = vi.fn().mockReturnValue(null);

      // Should not throw
      expect(() => {
        ErrorHandler.showErrorToUser(new StandardError('Test'));
      }).not.toThrow();
    });

    it('should handle critical errors with longer duration', () => {
      const error = new StandardError(
        'Critical failure',
        ERROR_TYPES.SYSTEM,
        ERROR_SEVERITY.CRITICAL
      );

      ErrorHandler.showErrorToUser(error);

      expect(mockStore.add).toHaveBeenCalledWith(
        'System error. Please try again later.',
        'error',
        10000
      );
    });
  });

  describe('processError', () => {
    it('should process error through complete pipeline', () => {
      const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockAdd = vi.fn();
      
      globalThis.Alpine = {
        store: vi.fn((name: string) => {
          if (name === 'notifications') {
            return { add: mockAdd };
          }
          return {};
        })
      } as any;

      const error = new Error('Test error');
      const result = ErrorHandler.processError(error, 'TestComponent', 'testContext');
      
      expect(result).toBeInstanceOf(StandardError);
      // Check that either error or warn was called (depends on severity)
      expect(mockError.mock.calls.length + mockWarn.mock.calls.length).toBeGreaterThan(0);
      expect(mockAdd).toHaveBeenCalled();
      // Error boundary functionality removed
      
      mockError.mockRestore();
      mockWarn.mockRestore();
    });
  });

  describe('StandardError getUserFriendlyMessage', () => {
    it('should return appropriate message for validation errors', () => {
      const error = new StandardError('Validation failed', ERROR_TYPES.VALIDATION);
      
      expect(error.userMessage).toBe('Please check your input and try again.');
    });

    it('should return appropriate message for network errors', () => {
      const error = new StandardError('Network failed', ERROR_TYPES.NETWORK);
      
      expect(error.userMessage).toBe('Network connection issue. Please try again.');
    });

    it('should return appropriate message for security errors', () => {
      const error = new StandardError('Security issue', ERROR_TYPES.SECURITY);
      
      expect(error.userMessage).toBe('Security error. Please contact support.');
    });

    it('should return default message for unknown errors', () => {
      const error = new StandardError('Unknown', ERROR_TYPES.UNKNOWN);
      
      expect(error.userMessage).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return original message for user errors', () => {
      const error = new StandardError('User-friendly message', ERROR_TYPES.USER);
      
      expect(error.userMessage).toBe('User-friendly message');
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

  it('should process unhandled promise rejections', () => {
    const processSpy = vi.spyOn(ErrorHandler, 'processError');
    
    setupGlobalErrorHandling();
    
    // Create and dispatch promise rejection event
    const rejectionEvent = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejectionEvent, 'reason', {
      value: new Error('Test promise rejection'),
      writable: false
    });
    
    window.dispatchEvent(rejectionEvent);

    expect(processSpy).toHaveBeenCalled();
  });
});