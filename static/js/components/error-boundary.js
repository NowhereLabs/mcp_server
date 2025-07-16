// Error Boundary System for Alpine.js Components

/**
 * Error boundary component that catches and handles component errors gracefully
 * @returns {Object} Alpine.js component with error boundary functionality
 */
export function errorBoundary() {
    return {
        hasError: false,
        errorMessage: null,
        errorStack: null,
        errorInfo: null,
        
        init() {
            this.setupErrorHandling();
        },
        
        setupErrorHandling() {
            // Wrap all component methods with error handling
            this.wrapComponentMethods();
            
            // Set up global error handlers
            this.setupGlobalErrorHandlers();
        },
        
        wrapComponentMethods() {
            const originalMethods = Object.getOwnPropertyNames(this.__proto__);
            
            originalMethods.forEach(methodName => {
                if (typeof this[methodName] === 'function' && methodName !== 'init') {
                    const originalMethod = this[methodName];
                    this[methodName] = this.createErrorBoundaryWrapper(originalMethod, methodName);
                }
            });
        },
        
        createErrorBoundaryWrapper(originalMethod, methodName) {
            return (...args) => {
                try {
                    const result = originalMethod.apply(this, args);
                    
                    // Handle async methods
                    if (result instanceof Promise) {
                        return result.catch(error => {
                            this.handleError(error, methodName, args);
                            return this.getFallbackValue(methodName);
                        });
                    }
                    
                    return result;
                } catch (error) {
                    this.handleError(error, methodName, args);
                    return this.getFallbackValue(methodName);
                }
            };
        },
        
        handleError(error, methodName, args) {
            this.hasError = true;
            this.errorMessage = error.message || 'An unexpected error occurred';
            this.errorStack = error.stack;
            this.errorInfo = {
                method: methodName,
                arguments: args,
                timestamp: new Date().toISOString(),
                component: this.$el?.id || 'unknown'
            };
            
            // Log error for debugging
            console.error('Alpine.js Component Error:', {
                error,
                method: methodName,
                args,
                component: this.$el?.id
            });
            
            // Notify error to user if notifications are available
            if (Alpine.store('notifications')) {
                Alpine.store('notifications').add(
                    `Component error in ${methodName}: ${this.errorMessage}`,
                    'error'
                );
            }
            
            // Trigger error recovery after a delay
            setTimeout(() => {
                this.recoverFromError();
            }, 2000);
        },
        
        getFallbackValue(methodName) {
            // Provide safe fallback values based on method name
            if (methodName.includes('get') || methodName.includes('format')) {
                return '';
            }
            if (methodName.includes('validate')) {
                return false;
            }
            if (methodName.includes('execute') || methodName.includes('process')) {
                return Promise.resolve(null);
            }
            return null;
        },
        
        recoverFromError() {
            // Attempt to recover from error
            this.hasError = false;
            this.errorMessage = null;
            this.errorStack = null;
            this.errorInfo = null;
            
            // Reinitialize component if needed
            if (this.init && typeof this.init === 'function') {
                try {
                    this.init();
                } catch (error) {
                    console.error('Failed to recover from error:', error);
                }
            }
        },
        
        setupGlobalErrorHandlers() {
            // Handle Alpine.js specific errors
            document.addEventListener('alpine:error', (event) => {
                this.handleError(event.detail.error, 'alpine:error', [event.detail]);
            });
            
            // Handle unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                if (event.reason && event.reason.alpineComponent === this) {
                    this.handleError(event.reason, 'unhandledrejection', [event]);
                    event.preventDefault();
                }
            });
        },
        
        retryOperation(methodName, ...args) {
            if (this.hasError) {
                this.recoverFromError();
            }
            
            setTimeout(() => {
                if (this[methodName] && typeof this[methodName] === 'function') {
                    this[methodName](...args);
                }
            }, 100);
        }
    };
}

/**
 * Mixin to add error boundary functionality to existing components
 * @param {Object} component - Alpine.js component to enhance
 * @returns {Object} Enhanced component with error boundaries
 */
export function withErrorBoundary(component) {
    const errorBoundaryMixin = errorBoundary();
    
    return {
        ...component,
        ...errorBoundaryMixin,
        
        init() {
            // Initialize error boundary first
            errorBoundaryMixin.init.call(this);
            
            // Then initialize the original component
            if (component.init) {
                try {
                    component.init.call(this);
                } catch (error) {
                    this.handleError(error, 'init', []);
                }
            }
        }
    };
}

/**
 * Global error boundary store for cross-component error handling
 */
document.addEventListener('alpine:init', () => {
    Alpine.store('errorBoundary', {
        errors: [],
        maxErrors: 10,
        
        addError(error, component, method) {
            const errorEntry = {
                id: Date.now() + Math.random(),
                error: error.message,
                component: component || 'unknown',
                method: method || 'unknown',
                timestamp: new Date().toISOString(),
                stack: error.stack
            };
            
            this.errors.unshift(errorEntry);
            
            // Keep only the most recent errors
            if (this.errors.length > this.maxErrors) {
                this.errors = this.errors.slice(0, this.maxErrors);
            }
            
            // Check for critical error patterns
            this.checkCriticalErrors();
        },
        
        checkCriticalErrors() {
            const recentErrors = this.errors.slice(0, 5);
            const criticalPatterns = [
                'Network error',
                'Failed to fetch',
                'Security error',
                'Permission denied'
            ];
            
            const hasCriticalErrors = recentErrors.some(error => 
                criticalPatterns.some(pattern => 
                    error.error.toLowerCase().includes(pattern.toLowerCase())
                )
            );
            
            if (hasCriticalErrors) {
                this.handleCriticalErrors();
            }
        },
        
        handleCriticalErrors() {
            // Show critical error notification
            if (Alpine.store('notifications')) {
                Alpine.store('notifications').add(
                    'Critical system errors detected. Please refresh the page.',
                    'error',
                    10000
                );
            }
            
            // Log critical errors for monitoring
            console.error('Critical errors detected:', this.errors.slice(0, 5));
        },
        
        clearErrors() {
            this.errors = [];
        },
        
        getErrorStats() {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            
            const recentErrors = this.errors.filter(error => 
                new Date(error.timestamp) > oneHourAgo
            );
            
            return {
                total: this.errors.length,
                recent: recentErrors.length,
                components: [...new Set(this.errors.map(e => e.component))],
                mostCommon: this.getMostCommonError()
            };
        },
        
        getMostCommonError() {
            const errorCounts = {};
            
            this.errors.forEach(error => {
                errorCounts[error.error] = (errorCounts[error.error] || 0) + 1;
            });
            
            return Object.entries(errorCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([error, count]) => ({ error, count }));
        }
    });
});