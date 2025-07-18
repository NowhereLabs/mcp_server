// Error Boundary System for Alpine.js Components
// TypeScript version with comprehensive error handling

import type { 
  ErrorInfo, 
  ErrorEntry, 
  ErrorStats, 
  ErrorReport
} from './error-boundary.d';

// Enhanced interfaces for TypeScript implementation
interface ErrorBoundaryComponent {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
  errorInfo: ErrorInfo | null;
  
  init(): void;
  sanitizeStackTrace(stack: string | undefined): string | undefined;
  setupErrorHandling(): void;
  wrapComponentMethods(): void;
  createErrorBoundaryWrapper<T extends any[], R>(
    originalMethod: (...args: T) => R,
    methodName: string
  ): (...args: T) => R;
  handleError(error: Error, methodName: string, args?: any[]): void;
  getFallbackValue(methodName: string): any;
  recoverFromError(): void;
  setupGlobalErrorHandlers(): void;
  retryOperation(methodName: string, ...args: any[]): void;
}

interface ErrorBoundaryStore {
  errors: ErrorEntry[];
  maxErrors: number;
  
  addError(error: Error, component?: string, method?: string): void;
  sanitizeStackTrace(stack: string | undefined): string | undefined;
  checkCriticalErrors(): void;
  handleCriticalErrors(errorContext: any): void;
  attemptRecovery(errorContext: any): void;
  recoverComponent(componentName: string): void;
  suggestPageRefresh(): void;
  clearErrors(): void;
  getErrorStats(): ErrorStats;
  getMostCommonError(): Array<{ error: string; count: number }>;
  generateErrorReport(): ErrorReport;
  generateRecommendations(): Array<{ type: string; message: string; action: string }>;
  exportErrorReport(): void;
}

// Extended Alpine.js interface for error boundary
interface AlpineWithErrorBoundary extends AlpineComponent {
  hasError?: boolean;
  errorMessage?: string | null;
  errorStack?: string | null;
  errorInfo?: ErrorInfo | null;
  handleError?: (error: Error, methodName: string, args?: any[]) => void;
  recoverFromError?: () => void;
  init?: () => void;
}

/**
 * Error boundary component that catches and handles component errors gracefully
 */
export function errorBoundary(): ErrorBoundaryComponent {
    return {
        hasError: false,
        errorMessage: null,
        errorStack: null,
        errorInfo: null,
        
        init(): void {
            this.setupErrorHandling();
        },
        
        /**
         * Sanitize stack traces for production environments
         */
        sanitizeStackTrace(stack: string | undefined): string | undefined {
            if (!stack) return undefined;
            
            // In production, sanitize stack traces to prevent information leakage
            if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
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
        },
        
        setupErrorHandling(): void {
            // Wrap all component methods with error handling
            this.wrapComponentMethods();
            
            // Set up global error handlers
            this.setupGlobalErrorHandlers();
        },
        
        wrapComponentMethods(): void {
            const originalMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
            
            originalMethods.forEach(methodName => {
                if (typeof (this as any)[methodName] === 'function' && methodName !== 'init') {
                    const originalMethod = (this as any)[methodName];
                    (this as any)[methodName] = this.createErrorBoundaryWrapper(originalMethod, methodName);
                }
            });
        },
        
        createErrorBoundaryWrapper<T extends any[], R>(
            originalMethod: (...args: T) => R,
            methodName: string
        ): (...args: T) => R {
            return (...args: T): R => {
                try {
                    const result = originalMethod.apply(this, args);
                    
                    // Handle async methods
                    if (result instanceof Promise) {
                        return result.catch((error: Error) => {
                            this.handleError(error, methodName, args);
                            return this.getFallbackValue(methodName);
                        }) as R;
                    }
                    
                    return result;
                } catch (error) {
                    this.handleError(error as Error, methodName, args);
                    return this.getFallbackValue(methodName);
                }
            };
        },
        
        handleError(error: Error, methodName: string, args?: any[]): void {
            this.hasError = true;
            this.errorMessage = error.message || 'An unexpected error occurred';
            this.errorStack = this.sanitizeStackTrace(error.stack) || null;
            this.errorInfo = {
                method: methodName,
                arguments: args || [],
                timestamp: new Date().toISOString(),
                component: (this as any).$el?.id || 'unknown'
            };
            
            // Log error for debugging
            console.error('Alpine.js Component Error:', {
                error,
                method: methodName,
                args,
                component: (this as any).$el?.id
            });
            
            // Notify error to user if notifications are available
            if (window.Alpine && window.Alpine.store) {
                const notificationStore = window.Alpine.store('notifications');
                if (notificationStore && typeof notificationStore.add === 'function') {
                    notificationStore.add(
                        `Component error in ${methodName}: ${this.errorMessage}`,
                        'error'
                    );
                }
            }
            
            // Add to global error boundary store
            const errorBoundaryStore = window.Alpine?.store('errorBoundary') as ErrorBoundaryStore;
            if (errorBoundaryStore && typeof errorBoundaryStore.addError === 'function') {
                errorBoundaryStore.addError(error, (this as any).$el?.id || 'unknown', methodName);
            }
            
            // Trigger error recovery after a delay
            setTimeout(() => {
                this.recoverFromError();
            }, 2000);
        },
        
        getFallbackValue(methodName: string): any {
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
        
        recoverFromError(): void {
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
        
        setupGlobalErrorHandlers(): void {
            // Handle Alpine.js specific errors
            document.addEventListener('alpine:error', (event: Event) => {
                const customEvent = event as CustomEvent;
                this.handleError(customEvent.detail.error, 'alpine:error', [customEvent.detail]);
            });
            
            // Handle unhandled promise rejections
            window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
                if (event.reason && (event.reason as any).alpineComponent === this) {
                    this.handleError(event.reason, 'unhandledrejection', [event]);
                    event.preventDefault();
                }
            });
        },
        
        retryOperation(methodName: string, ...args: any[]): void {
            if (this.hasError) {
                this.recoverFromError();
            }
            
            setTimeout(() => {
                if ((this as any)[methodName] && typeof (this as any)[methodName] === 'function') {
                    (this as any)[methodName](...args);
                }
            }, 100);
        }
    };
}

/**
 * Mixin to add error boundary functionality to existing components
 */
export function withErrorBoundary<T extends object>(component: T): T & ErrorBoundaryComponent {
    const errorBoundaryMixin = errorBoundary();
    
    return {
        ...component,
        ...errorBoundaryMixin,
        
        init(): void {
            // Initialize error boundary first
            errorBoundaryMixin.init.call(this);
            
            // Then initialize the original component
            if ((component as any).init) {
                try {
                    (component as any).init.call(this);
                } catch (error) {
                    this.handleError(error as Error, 'init', []);
                }
            }
        }
    };
}

/**
 * Global error boundary store for cross-component error handling
 */
document.addEventListener('alpine:init', () => {
    if (!window.Alpine) return;
    
    const errorBoundaryStore: ErrorBoundaryStore = {
        errors: [],
        maxErrors: 10,
        
        addError(error: Error, component?: string, method?: string): void {
            const errorEntry: ErrorEntry = {
                id: Date.now() + Math.random(),
                error: error.message,
                component: component || 'unknown',
                method: method || 'unknown',
                timestamp: new Date().toISOString(),
                stack: this.sanitizeStackTrace(error.stack) || ''
            };
            
            this.errors.unshift(errorEntry);
            
            // Keep only the most recent errors
            if (this.errors.length > this.maxErrors) {
                this.errors = this.errors.slice(0, this.maxErrors);
            }
            
            // Check for critical error patterns
            this.checkCriticalErrors();
        },
        
        sanitizeStackTrace(stack: string | undefined): string | undefined {
            if (!stack) return undefined;
            
            // In production, sanitize stack traces to prevent information leakage
            if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
                return stack
                    .split('\n')
                    .map(line => {
                        if (!line.trim().startsWith('at ')) {
                            return line;
                        }
                        
                        const match = line.match(/at\s+([^(]+)/);
                        if (match) {
                            return `    at ${match[1].trim()}`;
                        }
                        
                        return '    at <sanitized>';
                    })
                    .slice(0, 5)
                    .join('\n');
            }
            
            return stack;
        },
        
        checkCriticalErrors(): void {
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
            const componentErrorCounts: Record<string, number> = {};
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
        
        handleCriticalErrors(errorContext: any): void {
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
                    .filter(([, count]) => typeof count === 'number' && count > 2)
                    .map(([component]) => component)
                    .join(', ');
                errorMessage = `Component errors detected: ${problematicComponents}`;
                recoveryAction = 'Affected components will be restarted.';
            }
            
            // Show critical error notification
            if (window.Alpine && window.Alpine.store) {
                const notificationStore = window.Alpine.store('notifications');
                if (notificationStore && typeof notificationStore.add === 'function') {
                    notificationStore.add(
                        `${errorMessage} ${recoveryAction}`,
                        'error',
                        15000
                    );
                }
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
        
        attemptRecovery(errorContext: any): void {
            const { hasComponentErrorStorm, errorCounts } = errorContext;
            
            // If it's a component error storm, try to recover specific components
            if (hasComponentErrorStorm) {
                Object.entries(errorCounts).forEach(([component, count]) => {
                    if (typeof count === 'number' && count > 2) {
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
        
        recoverComponent(componentName: string): void {
            try {
                // Find and reinitialize the component
                const componentElements = document.querySelectorAll(`[x-data*="${componentName}"]`);
                
                componentElements.forEach(element => {
                    const alpineElement = element as any;
                    if (alpineElement._x_dataStack && alpineElement._x_dataStack.length > 0) {
                        const componentData = alpineElement._x_dataStack[0] as AlpineWithErrorBoundary;
                        
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
        
        suggestPageRefresh(): void {
            if (window.Alpine && window.Alpine.store) {
                const notificationStore = window.Alpine.store('notifications');
                if (notificationStore && typeof notificationStore.add === 'function') {
                    notificationStore.add(
                        'System errors persist. Consider refreshing the page to restore full functionality.',
                        'warning',
                        0 // No auto-dismiss
                    );
                }
            }
        },
        
        clearErrors(): void {
            this.errors = [];
        },
        
        getErrorStats(): ErrorStats {
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
        
        getMostCommonError(): Array<{ error: string; count: number }> {
            const errorCounts: Record<string, number> = {};
            
            this.errors.forEach(error => {
                errorCounts[error.error] = (errorCounts[error.error] || 0) + 1;
            });
            
            return Object.entries(errorCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([error, count]) => ({ error, count }));
        },
        
        generateErrorReport(): ErrorReport {
            const stats = this.getErrorStats();
            const report: ErrorReport = {
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
        
        generateRecommendations(): Array<{ type: string; message: string; action: string }> {
            const recommendations: Array<{ type: string; message: string; action: string }> = [];
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
                if (typeof count === 'number' && count > 2) {
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
        
        exportErrorReport(): void {
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
    };
    
    window.Alpine.store('errorBoundary', errorBoundaryStore);
});