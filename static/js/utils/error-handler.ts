// Centralized Error Handling Utilities

import { ErrorDetails } from '../types/alpine';

/**
 * Standard error types for the application
 */
export const ERROR_TYPES = {
    VALIDATION: 'validation' as const,
    NETWORK: 'network' as const,
    SECURITY: 'security' as const,
    SYSTEM: 'system' as const,
    USER: 'user' as const,
    UNKNOWN: 'unknown' as const
} as const;

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
    LOW: 'low' as const,
    MEDIUM: 'medium' as const,
    HIGH: 'high' as const,
    CRITICAL: 'critical' as const
} as const;

// Type aliases for easier use
export type ErrorType = typeof ERROR_TYPES[keyof typeof ERROR_TYPES];
export type ErrorSeverity = typeof ERROR_SEVERITY[keyof typeof ERROR_SEVERITY];

// Enhanced type guards for error classification
export function isValidationError(error: Error): boolean {
    const validationKeywords = [
        'validation', 'invalid', 'required', 'missing', 'empty', 'null', 'undefined',
        'format', 'syntax', 'parse', 'malformed', 'expected', 'must be', 'cannot be',
        'too short', 'too long', 'out of range', 'not allowed', 'schema', 'type error'
    ];
    
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return validationKeywords.some(keyword => 
        message.includes(keyword) || name.includes(keyword)
    ) || error.name === 'TypeError' || error.name === 'SyntaxError';
}

export function isNetworkError(error: Error): boolean {
    const networkKeywords = [
        'network', 'fetch', 'request', 'response', 'connection', 'timeout', 'abort',
        'offline', 'cors', 'http', 'ssl', 'tls', 'dns', 'socket', 'refused',
        'unreachable', 'gateway', 'proxy', 'status 4', 'status 5'
    ];
    
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return networkKeywords.some(keyword => 
        message.includes(keyword) || name.includes(keyword)
    ) || /failed to fetch|network error|load failed/i.test(error.message);
}

export function isSecurityError(error: Error): boolean {
    const securityKeywords = [
        'security', 'permission', 'unauthorized', 'forbidden', 'access denied',
        'authentication', 'authorization', 'token', 'csrf', 'xss', 'injection',
        'blocked', 'restricted', 'credentials', 'login', 'session expired'
    ];
    
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return securityKeywords.some(keyword => 
        message.includes(keyword) || name.includes(keyword)
    ) || /status 40[13]/i.test(error.message); // 401, 403 status codes
}

export function isSystemError(error: Error): boolean {
    const systemKeywords = [
        'memory', 'disk', 'file system', 'database', 'server', 'internal',
        'crash', 'overflow', 'stack', 'heap', 'resource', 'quota', 'limit',
        'unavailable', 'maintenance', 'overload', 'capacity'
    ];
    
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return systemKeywords.some(keyword => 
        message.includes(keyword) || name.includes(keyword)
    ) || /status 50\d/i.test(error.message) || // 5xx status codes
       error.name === 'RangeError' || error.name === 'ReferenceError';
}

export function isUserError(error: Error): boolean {
    const userKeywords = [
        'user', 'input', 'action', 'operation', 'cancelled', 'aborted',
        'interrupted', 'duplicate', 'already exists', 'not found', 'empty result'
    ];
    
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    
    return userKeywords.some(keyword => 
        message.includes(keyword) || name.includes(keyword)
    ) || /status 404|status 409|status 410/i.test(error.message); // 404, 409, 410 status codes
}

/**
 * Standard error response structure
 */
export class StandardError extends Error {
    public readonly name: string = 'StandardError';
    public readonly type: ErrorType;
    public readonly severity: ErrorSeverity;
    public readonly details: ErrorDetails;
    public readonly timestamp: string;
    public readonly userMessage: string;

    constructor(
        message: string,
        type: ErrorType = ERROR_TYPES.UNKNOWN,
        severity: ErrorSeverity = ERROR_SEVERITY.MEDIUM,
        details: ErrorDetails = {}
    ) {
        super(message);
        this.type = type;
        this.severity = severity;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.userMessage = this.getUserFriendlyMessage();
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(): string {
        const friendlyMessages: Record<ErrorType, string> = {
            [ERROR_TYPES.VALIDATION]: 'Please check your input and try again.',
            [ERROR_TYPES.NETWORK]: 'Network connection issue. Please try again.',
            [ERROR_TYPES.SECURITY]: 'Security error. Please contact support.',
            [ERROR_TYPES.SYSTEM]: 'System error. Please try again later.',
            [ERROR_TYPES.USER]: this.message,
            [ERROR_TYPES.UNKNOWN]: 'An unexpected error occurred. Please try again.'
        };

        return friendlyMessages[this.type] || friendlyMessages[ERROR_TYPES.UNKNOWN];
    }

    /**
     * Convert error to JSON format
     */
    toJSON(): Record<string, any> {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            severity: this.severity,
            details: this.details,
            timestamp: this.timestamp,
            userMessage: this.userMessage
        };
    }
}

/**
 * Error handler utility class
 */
export class ErrorHandler {
    /**
     * Sanitize stack traces for production environments
     */
    static sanitizeStackTrace(stack?: string): string | undefined {
        if (!stack) return undefined;
        
        // In production, sanitize stack traces to prevent information leakage
        if (process.env.NODE_ENV === 'production') {
            // Remove file paths and only keep function/error names
            return stack
                .split('\n')
                .map(line => {
                    // Keep the error message line
                    if (!line.trim().startsWith('at ')) {
                        return line;
                    }
                    
                    // For stack frames, remove file paths and line numbers
                    const match = line.match(/at\s+([^(]+)/);
                    if (match) {
                        return `    at ${match[1].trim()}`;
                    }
                    
                    return '    at <sanitized>';
                })
                .slice(0, 5) // Limit to first 5 frames
                .join('\n');
        }
        
        // In development, return full stack trace
        return stack;
    }

    /**
     * Create validation error
     */
    static createValidationError(message: string, details: ErrorDetails = {}): StandardError {
        return new StandardError(message, ERROR_TYPES.VALIDATION, ERROR_SEVERITY.LOW, details);
    }

    /**
     * Create network error
     */
    static createNetworkError(message: string, details: ErrorDetails = {}): StandardError {
        return new StandardError(message, ERROR_TYPES.NETWORK, ERROR_SEVERITY.MEDIUM, details);
    }

    /**
     * Create security error
     */
    static createSecurityError(message: string, details: ErrorDetails = {}): StandardError {
        return new StandardError(message, ERROR_TYPES.SECURITY, ERROR_SEVERITY.HIGH, details);
    }

    /**
     * Create system error
     */
    static createSystemError(message: string, details: ErrorDetails = {}): StandardError {
        return new StandardError(message, ERROR_TYPES.SYSTEM, ERROR_SEVERITY.MEDIUM, details);
    }

    /**
     * Create user error
     */
    static createUserError(message: string, details: ErrorDetails = {}): StandardError {
        return new StandardError(message, ERROR_TYPES.USER, ERROR_SEVERITY.LOW, details);
    }

    /**
     * Get error category and suggestions based on error type
     */
    static getErrorAnalysis(error: StandardError): {
        category: string;
        suggestions: string[];
        isRecoverable: boolean;
        userAction: string;
    } {
        const analysisMap = {
            [ERROR_TYPES.VALIDATION]: {
                category: 'Input Validation',
                suggestions: [
                    'Check that all required fields are filled',
                    'Verify data format matches expected pattern',
                    'Ensure values are within acceptable ranges'
                ],
                isRecoverable: true,
                userAction: 'Please correct your input and try again'
            },
            [ERROR_TYPES.NETWORK]: {
                category: 'Network/Connectivity',
                suggestions: [
                    'Check your internet connection',
                    'Try refreshing the page',
                    'Check if the server is accessible',
                    'Verify proxy/firewall settings'
                ],
                isRecoverable: true,
                userAction: 'Please check your connection and retry'
            },
            [ERROR_TYPES.SECURITY]: {
                category: 'Security/Authentication',
                suggestions: [
                    'Verify your login credentials',
                    'Check if your session has expired',
                    'Ensure you have proper permissions',
                    'Contact administrator if needed'
                ],
                isRecoverable: false,
                userAction: 'Authentication required - please log in again'
            },
            [ERROR_TYPES.SYSTEM]: {
                category: 'System/Server',
                suggestions: [
                    'Wait a moment and try again',
                    'Check system status page',
                    'Contact technical support',
                    'Save your work and restart the application'
                ],
                isRecoverable: false,
                userAction: 'System issue detected - please try again later'
            },
            [ERROR_TYPES.USER]: {
                category: 'User Operation',
                suggestions: [
                    'Review the requested operation',
                    'Check if the resource exists',
                    'Verify you have the right permissions',
                    'Try a different approach'
                ],
                isRecoverable: true,
                userAction: 'Please review your action and try again'
            },
            [ERROR_TYPES.UNKNOWN]: {
                category: 'Unknown',
                suggestions: [
                    'Try refreshing the page',
                    'Check browser console for details',
                    'Contact support with error details',
                    'Try again in a few minutes'
                ],
                isRecoverable: true,
                userAction: 'Unexpected error - please try again'
            }
        };

        return analysisMap[error.type] || analysisMap[ERROR_TYPES.UNKNOWN];
    }

    /**
     * Handle and normalize any error
     */
    static handleError(error: Error | string | unknown, context: string = 'unknown'): StandardError {
        if (error instanceof StandardError) {
            return error;
        }

        let message = 'An unexpected error occurred';
        let type: ErrorType = ERROR_TYPES.UNKNOWN;
        let severity: ErrorSeverity = ERROR_SEVERITY.MEDIUM;
        const details: ErrorDetails = { context };

        if (error instanceof Error) {
            message = error.message;
            details.originalError = error.name;
            details.stack = this.sanitizeStackTrace(error.stack);
            
            // Enhanced error classification using expanded type guards
            if (isValidationError(error)) {
                type = ERROR_TYPES.VALIDATION;
                severity = ERROR_SEVERITY.LOW;
            } else if (isNetworkError(error)) {
                type = ERROR_TYPES.NETWORK;
                severity = ERROR_SEVERITY.MEDIUM;
            } else if (isSecurityError(error)) {
                type = ERROR_TYPES.SECURITY;
                severity = ERROR_SEVERITY.HIGH;
            } else if (isSystemError(error)) {
                type = ERROR_TYPES.SYSTEM;
                severity = ERROR_SEVERITY.HIGH;
            } else if (isUserError(error)) {
                type = ERROR_TYPES.USER;
                severity = ERROR_SEVERITY.LOW;
            }
        } else if (typeof error === 'string') {
            message = error;
        } else if (error !== null && error !== undefined) {
            // Handle other types of errors (objects, arrays, etc.)
            if (typeof error === 'object') {
                message = 'An unexpected error occurred';
                details.originalError = error.toString();
            } else {
                message = String(error);
            }
        }

        return new StandardError(message, type, severity, details);
    }

    /**
     * Log error with appropriate level
     */
    static logError(error: StandardError, component: string = 'unknown'): void {
        const logData = {
            component,
            error: error.toJSON(),
            timestamp: new Date().toISOString()
        };

        switch (error.severity) {
            case ERROR_SEVERITY.CRITICAL:
                console.error('🚨 CRITICAL ERROR:', logData);
                break;
            case ERROR_SEVERITY.HIGH:
                console.error('❌ HIGH ERROR:', logData);
                break;
            case ERROR_SEVERITY.MEDIUM:
                console.warn('⚠️ MEDIUM ERROR:', logData);
                break;
            case ERROR_SEVERITY.LOW:
                console.info('ℹ️ LOW ERROR:', logData);
                break;
            default:
                console.error('❓ UNKNOWN ERROR:', logData);
        }
    }

    /**
     * Show error to user via notification system
     */
    static showErrorToUser(error: StandardError, component: string = 'unknown'): void {
        if (typeof window !== 'undefined' && window.Alpine?.store('notifications')) {
            let notificationType: 'error' | 'warning' | 'info' = 'error';
            
            switch (error.severity) {
                case ERROR_SEVERITY.CRITICAL:
                case ERROR_SEVERITY.HIGH:
                    notificationType = 'error';
                    break;
                case ERROR_SEVERITY.MEDIUM:
                    notificationType = 'warning';
                    break;
                case ERROR_SEVERITY.LOW:
                    notificationType = 'info';
                    break;
            }

            const notificationStore = window.Alpine.store('notifications') as any;
            notificationStore.add(
                error.userMessage,
                notificationType,
                error.severity === ERROR_SEVERITY.CRITICAL ? 10000 : 5000
            );
        }

        // Error boundary functionality removed - handled via notifications instead
    }

    /**
     * Process error through complete error handling pipeline
     */
    static processError(error: Error | string | unknown, component: string = 'unknown', context: string = 'unknown'): StandardError {
        const standardError = this.handleError(error, context);
        
        this.logError(standardError, component);
        this.showErrorToUser(standardError, component);
        
        return standardError;
    }
}

/**
 * Operation function type for retry operations
 */
type RetryableOperation<T> = () => Promise<T>;

/**
 * Circuit breaker function type
 */
type CircuitBreakerOperation<T extends any[], R> = (...args: T) => Promise<R>;

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
    /**
     * Retry operation with exponential backoff
     */
    static async retry<T>(
        operation: RetryableOperation<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T> {
        let lastError: unknown;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries - 1) {
                    throw ErrorHandler.handleError(error, 'retry_failed');
                }
                
                // Exponential backoff
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw ErrorHandler.handleError(lastError, 'retry_exhausted');
    }

    /**
     * Circuit breaker pattern for error handling
     */
    static createCircuitBreaker<T extends any[], R>(
        operation: CircuitBreakerOperation<T, R>,
        failureThreshold: number = 5,
        resetTimeout: number = 60000
    ): CircuitBreakerOperation<T, R> {
        let state: 'closed' | 'open' | 'half-open' = 'closed';
        let failureCount = 0;
        let lastFailureTime = 0;

        return async function(...args: T): Promise<R> {
            if (state === 'open') {
                if (Date.now() - lastFailureTime > resetTimeout) {
                    state = 'half-open';
                } else {
                    throw ErrorHandler.createSystemError('Circuit breaker is open');
                }
            }

            try {
                const result = await operation(...args);
                
                if (state === 'half-open') {
                    state = 'closed';
                    failureCount = 0;
                }
                
                return result;
            } catch (error) {
                failureCount++;
                lastFailureTime = Date.now();
                
                if (failureCount >= failureThreshold) {
                    state = 'open';
                }
                
                throw ErrorHandler.handleError(error, 'circuit_breaker');
            }
        };
    }
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandling(): void {
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        const error = ErrorHandler.processError(
            event.reason,
            'global',
            'unhandledrejection'
        );
        
        console.error('Unhandled promise rejection:', error);
        event.preventDefault();
    });

    // Handle global errors
    window.addEventListener('error', (event: ErrorEvent) => {
        const error = ErrorHandler.processError(
            event.error || event.message,
            'global',
            'global_error'
        );
        
        console.error('Global error:', error);
    });

    // Handle Alpine.js errors if available
    document.addEventListener('alpine:error', (event: Event) => {
        const customEvent = event as CustomEvent;
        const error = ErrorHandler.processError(
            customEvent.detail.error,
            'alpine',
            'alpine_error'
        );
        
        console.error('Alpine.js error:', error);
    });
}

// Auto-setup global error handling
if (typeof window !== 'undefined') {
    setupGlobalErrorHandling();
}