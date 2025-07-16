// Centralized Error Handling Utilities

/**
 * Standard error types for the application
 */
export const ERROR_TYPES = {
    VALIDATION: 'validation',
    NETWORK: 'network',
    SECURITY: 'security',
    SYSTEM: 'system',
    USER: 'user',
    UNKNOWN: 'unknown'
};

/**
 * Error severity levels
 */
export const ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Standard error response structure
 */
export class StandardError extends Error {
    constructor(message, type = ERROR_TYPES.UNKNOWN, severity = ERROR_SEVERITY.MEDIUM, details = {}) {
        super(message);
        this.name = 'StandardError';
        this.type = type;
        this.severity = severity;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.userMessage = this.getUserFriendlyMessage();
    }

    /**
     * Get user-friendly error message
     * @returns {string} User-friendly error message
     */
    getUserFriendlyMessage() {
        const friendlyMessages = {
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
     * @returns {Object} JSON representation of the error
     */
    toJSON() {
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
     * @param {string} message - Error message
     * @param {Object} details - Additional details
     * @returns {StandardError} Validation error
     */
    static createValidationError(message, details = {}) {
        return new StandardError(message, ERROR_TYPES.VALIDATION, ERROR_SEVERITY.LOW, details);
    }

    /**
     * Create network error
     * @param {string} message - Error message
     * @param {Object} details - Additional details
     * @returns {StandardError} Network error
     */
    static createNetworkError(message, details = {}) {
        return new StandardError(message, ERROR_TYPES.NETWORK, ERROR_SEVERITY.MEDIUM, details);
    }

    /**
     * Create security error
     * @param {string} message - Error message
     * @param {Object} details - Additional details
     * @returns {StandardError} Security error
     */
    static createSecurityError(message, details = {}) {
        return new StandardError(message, ERROR_TYPES.SECURITY, ERROR_SEVERITY.HIGH, details);
    }

    /**
     * Create system error
     * @param {string} message - Error message
     * @param {Object} details - Additional details
     * @returns {StandardError} System error
     */
    static createSystemError(message, details = {}) {
        return new StandardError(message, ERROR_TYPES.SYSTEM, ERROR_SEVERITY.MEDIUM, details);
    }

    /**
     * Create user error
     * @param {string} message - Error message
     * @param {Object} details - Additional details
     * @returns {StandardError} User error
     */
    static createUserError(message, details = {}) {
        return new StandardError(message, ERROR_TYPES.USER, ERROR_SEVERITY.LOW, details);
    }

    /**
     * Handle and normalize any error
     * @param {Error|string} error - Error to handle
     * @param {string} context - Context where error occurred
     * @returns {StandardError} Normalized error
     */
    static handleError(error, context = 'unknown') {
        if (error instanceof StandardError) {
            return error;
        }

        let message = 'An unexpected error occurred';
        let type = ERROR_TYPES.UNKNOWN;
        let severity = ERROR_SEVERITY.MEDIUM;
        let details = { context };

        if (error instanceof Error) {
            message = error.message;
            details.originalError = error.name;
            details.stack = error.stack;
            
            // Classify error based on message content
            if (error.message.includes('network') || error.message.includes('fetch')) {
                type = ERROR_TYPES.NETWORK;
            } else if (error.message.includes('validation') || error.message.includes('invalid')) {
                type = ERROR_TYPES.VALIDATION;
                severity = ERROR_SEVERITY.LOW;
            } else if (error.message.includes('security') || error.message.includes('permission')) {
                type = ERROR_TYPES.SECURITY;
                severity = ERROR_SEVERITY.HIGH;
            }
        } else if (typeof error === 'string') {
            message = error;
        }

        return new StandardError(message, type, severity, details);
    }

    /**
     * Log error with appropriate level
     * @param {StandardError} error - Error to log
     * @param {string} component - Component where error occurred
     */
    static logError(error, component = 'unknown') {
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
     * @param {StandardError} error - Error to display
     * @param {string} component - Component where error occurred
     */
    static showErrorToUser(error, component = 'unknown') {
        if (typeof Alpine !== 'undefined' && Alpine.store('notifications')) {
            let notificationType = 'error';
            
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

            Alpine.store('notifications').add(
                error.userMessage,
                notificationType,
                error.severity === ERROR_SEVERITY.CRITICAL ? 10000 : 5000
            );
        }

        // Also add to error boundary store if available
        if (typeof Alpine !== 'undefined' && Alpine.store('errorBoundary')) {
            Alpine.store('errorBoundary').addError(error, component, 'unknown');
        }
    }

    /**
     * Process error through complete error handling pipeline
     * @param {Error|string} error - Error to process
     * @param {string} component - Component where error occurred
     * @param {string} context - Additional context
     * @returns {StandardError} Processed error
     */
    static processError(error, component = 'unknown', context = 'unknown') {
        const standardError = this.handleError(error, context);
        
        this.logError(standardError, component);
        this.showErrorToUser(standardError, component);
        
        return standardError;
    }
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
    /**
     * Retry operation with exponential backoff
     * @param {Function} operation - Operation to retry
     * @param {number} maxRetries - Maximum number of retries
     * @param {number} baseDelay - Base delay in milliseconds
     * @returns {Promise} Result of the operation
     */
    static async retry(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
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
     * @param {Function} operation - Operation to execute
     * @param {number} failureThreshold - Number of failures before circuit opens
     * @param {number} resetTimeout - Time before attempting to reset circuit
     * @returns {Promise} Result of the operation
     */
    static createCircuitBreaker(operation, failureThreshold = 5, resetTimeout = 60000) {
        let state = 'closed'; // closed, open, half-open
        let failureCount = 0;
        let lastFailureTime = 0;

        return async function(...args) {
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
export function setupGlobalErrorHandling() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const error = ErrorHandler.processError(
            event.reason,
            'global',
            'unhandledrejection'
        );
        
        console.error('Unhandled promise rejection:', error);
        event.preventDefault();
    });

    // Handle global errors
    window.addEventListener('error', (event) => {
        const error = ErrorHandler.processError(
            event.error || event.message,
            'global',
            'global_error'
        );
        
        console.error('Global error:', error);
    });

    // Handle Alpine.js errors if available
    document.addEventListener('alpine:error', (event) => {
        const error = ErrorHandler.processError(
            event.detail.error,
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