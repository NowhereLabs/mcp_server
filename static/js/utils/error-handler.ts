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

// Type guards for error classification
export function isValidationError(error: Error): boolean {
    return error.message.includes('validation') || error.message.includes('invalid');
}

export function isNetworkError(error: Error): boolean {
    return error.message.includes('network') || error.message.includes('fetch');
}

export function isSecurityError(error: Error): boolean {
    return error.message.includes('security') || error.message.includes('permission');
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
            details.stack = error.stack;
            
            // Classify error based on message content using type guards
            if (isNetworkError(error)) {
                type = ERROR_TYPES.NETWORK;
            } else if (isValidationError(error)) {
                type = ERROR_TYPES.VALIDATION;
                severity = ERROR_SEVERITY.LOW;
            } else if (isSecurityError(error)) {
                type = ERROR_TYPES.SECURITY;
                severity = ERROR_SEVERITY.HIGH;
            }
        } else if (typeof error === 'string') {
            message = error;
        } else if (error !== null && error !== undefined) {
            // Handle other types of errors
            message = String(error);
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

        // Also add to error boundary store if available
        if (typeof window !== 'undefined' && window.Alpine?.store('errorBoundary')) {
            const errorBoundaryStore = window.Alpine.store('errorBoundary') as any;
            errorBoundaryStore.addError(error, component, 'unknown');
        }
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