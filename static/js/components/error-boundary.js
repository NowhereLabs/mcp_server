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
                'Permission denied',
                'WebSocket connection error',
                'Hot-reload connection lost',
                'Origin validation failed',
                'Authentication failed',
                'CORS error',
                'Cannot read properties of undefined',
                'Maximum call stack size exceeded',
                'Out of memory'
            ];
            
            // Check for critical error patterns
            const hasCriticalErrors = recentErrors.some(error => 
                criticalPatterns.some(pattern => 
                    error.error.toLowerCase().includes(pattern.toLowerCase())
                )
            );
            
            // Check for error frequency (more than 3 errors in last 5 minutes)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentFrequentErrors = this.errors.filter(error => 
                new Date(error.timestamp) > fiveMinutesAgo
            );
            
            const hasFrequentErrors = recentFrequentErrors.length > 3;
            
            // Check for component-specific error storms
            const componentErrorCounts = {};
            recentErrors.forEach(error => {
                componentErrorCounts[error.component] = (componentErrorCounts[error.component] || 0) + 1;
            });
            
            const hasComponentErrorStorm = Object.values(componentErrorCounts).some(count => count > 2);
            
            if (hasCriticalErrors || hasFrequentErrors || hasComponentErrorStorm) {
                this.handleCriticalErrors({
                    hasCriticalErrors,
                    hasFrequentErrors,
                    hasComponentErrorStorm,
                    errorCounts: componentErrorCounts
                });
            }
        },
        
        handleCriticalErrors(errorContext) {
            const {
                hasCriticalErrors,
                hasFrequentErrors,
                hasComponentErrorStorm,
                errorCounts
            } = errorContext;
            
            // Generate appropriate error message
            let errorMessage = 'Critical system errors detected.';
            let recoveryAction = 'Please refresh the page.';
            
            if (hasCriticalErrors) {
                errorMessage = 'Critical system errors detected.';
                recoveryAction = 'Please refresh the page or contact support.';
            } else if (hasFrequentErrors) {
                errorMessage = 'Multiple errors detected in a short time.';
                recoveryAction = 'The system will attempt automatic recovery.';
            } else if (hasComponentErrorStorm) {
                const problematicComponents = Object.entries(errorCounts)
                    .filter(([, count]) => count > 2)
                    .map(([component]) => component)
                    .join(', ');
                errorMessage = `Component errors detected: ${problematicComponents}`;
                recoveryAction = 'Affected components will be restarted.';
            }
            
            // Show critical error notification
            if (Alpine.store('notifications')) {
                Alpine.store('notifications').add(
                    `${errorMessage} ${recoveryAction}`,
                    'error',
                    15000
                );
            }
            
            // Log critical errors for monitoring
            console.error('Critical errors detected:', {
                context: errorContext,
                recentErrors: this.errors.slice(0, 5),
                timestamp: new Date().toISOString()
            });
            
            // Attempt recovery actions
            this.attemptRecovery(errorContext);
        },
        
        attemptRecovery(errorContext) {
            const { hasComponentErrorStorm, errorCounts } = errorContext;
            
            // If it's a component error storm, try to recover specific components
            if (hasComponentErrorStorm) {
                Object.entries(errorCounts).forEach(([component, count]) => {
                    if (count > 2) {
                        this.recoverComponent(component);
                    }
                });
            }
            
            // If errors persist, suggest page refresh after a delay
            setTimeout(() => {
                const currentErrors = this.errors.filter(error => 
                    new Date(error.timestamp) > new Date(Date.now() - 2 * 60 * 1000)
                );
                
                if (currentErrors.length > 2) {
                    this.suggestPageRefresh();
                }
            }, 30000); // Check again in 30 seconds
        },
        
        recoverComponent(componentName) {
            try {
                // Find and reinitialize the component
                const componentElements = document.querySelectorAll(`[x-data*="${componentName}"]`);
                
                componentElements.forEach(element => {
                    if (element._x_dataStack && element._x_dataStack.length > 0) {
                        const componentData = element._x_dataStack[0];
                        
                        // If component has a recovery method, call it
                        if (componentData.recoverFromError) {
                            componentData.recoverFromError();
                        } else if (componentData.init) {
                            // Otherwise, try to reinitialize
                            componentData.init();
                        }
                    }
                });
                
                console.log(`Attempted recovery for component: ${componentName}`);
            } catch (error) {
                console.error(`Failed to recover component ${componentName}:`, error);
            }
        },
        
        suggestPageRefresh() {
            if (Alpine.store('notifications')) {
                Alpine.store('notifications').add(
                    'System errors persist. Consider refreshing the page to restore full functionality.',
                    'warning',
                    0 // No auto-dismiss
                );
            }
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
        },
        
        generateErrorReport() {
            const stats = this.getErrorStats();
            const report = {
                timestamp: new Date().toISOString(),
                summary: {
                    totalErrors: stats.total,
                    recentErrors: stats.recent,
                    affectedComponents: stats.components.length,
                    mostCommonErrors: stats.mostCommon
                },
                details: {
                    errors: this.errors.slice(0, 20), // Last 20 errors
                    components: stats.components,
                    timeRange: {
                        oldest: this.errors[this.errors.length - 1]?.timestamp,
                        newest: this.errors[0]?.timestamp
                    }
                },
                recommendations: this.generateRecommendations()
            };
            
            return report;
        },
        
        generateRecommendations() {
            const recommendations = [];
            const stats = this.getErrorStats();
            
            // High error rate
            if (stats.recent > 5) {
                recommendations.push({
                    type: 'high_error_rate',
                    message: 'High error rate detected in the last hour',
                    action: 'Consider refreshing the page or checking your internet connection'
                });
            }
            
            // Multiple component errors
            if (stats.components.length > 3) {
                recommendations.push({
                    type: 'multiple_components',
                    message: 'Multiple components are experiencing errors',
                    action: 'System-wide issue detected - page refresh recommended'
                });
            }
            
            // Specific error patterns
            const commonErrors = stats.mostCommon;
            commonErrors.forEach(({ error, count }) => {
                if (count > 2) {
                    if (error.toLowerCase().includes('network')) {
                        recommendations.push({
                            type: 'network_issue',
                            message: 'Network connectivity issues detected',
                            action: 'Check your internet connection and try again'
                        });
                    } else if (error.toLowerCase().includes('websocket')) {
                        recommendations.push({
                            type: 'websocket_issue',
                            message: 'WebSocket connection problems detected',
                            action: 'Hot-reload functionality may be affected'
                        });
                    }
                }
            });
            
            return recommendations;
        },
        
        exportErrorReport() {
            const report = this.generateErrorReport();
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    });
});