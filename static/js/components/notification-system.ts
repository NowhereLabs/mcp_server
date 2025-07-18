// Notification System Alpine.js Component

import type * as Alpine from 'alpinejs';
import { ErrorHandler, ERROR_TYPES } from '../utils/error-handler';
import { NotificationItem, NotificationType, CustomAlpineComponent } from '../types/alpine';

// Notification system component data interface
interface NotificationSystemData {
    hasError: boolean;
    errorMessage: string | null;
    notifications: NotificationItem[];
    _errorHandler: ((event: ErrorEvent) => void) | null;
    
    init(): void;
    setupErrorHandling(): void;
    remove(id: string | number): void;
    getNotificationClass(type: NotificationType): string;
    handleComponentError(error: Error, method: string, args?: any[]): void;
    recoverFromError(): void;
    destroy(): void;
}

/**
 * Notification System Alpine.js Component
 * 
 * This component provides a notification display system with error handling
 * and recovery mechanisms. It integrates with the global notifications store
 * to display messages to users.
 */
export function notificationSystem(): CustomAlpineComponent<NotificationSystemData> {
    return {
        /** Whether the component has encountered an error */
        hasError: false,
        
        /** Current error message */
        errorMessage: null,
        
        /** Reference to the error event handler for cleanup */
        _errorHandler: null as ((event: ErrorEvent) => void) | null,
        
        /**
         * Initialize the notification system component
         * Sets up error handling wrappers for critical methods
         */
        init(): void {
            this.setupErrorHandling();
        },
        
        /**
         * Set up error handling wrappers for component methods
         * 
         * Wraps critical methods with try-catch blocks to prevent
         * component crashes and provide graceful error handling.
         */
        setupErrorHandling(): void {
            // Wrap critical methods with error handling
            const originalRemove = this.remove;
            this.remove = (id: string | number) => {
                try {
                    return originalRemove.call(this, id);
                } catch (error) {
                    this.handleComponentError(error as Error, 'remove', [id]);
                }
            };
            
            // Set up global error handler
            this._errorHandler = (event: ErrorEvent) => {
                this.handleComponentError(event.error || new Error(event.message), 'globalError');
            };
            
            window.addEventListener('error', this._errorHandler);
        },
        
        /**
         * Get all notifications from the store
         */
        get notifications(): NotificationItem[] {
            try {
                return this.$store.notifications?.items || [];
            } catch (error) {
                this.handleComponentError(error as Error, 'notifications getter');
                return [];
            }
        },
        
        /**
         * Remove a notification by ID
         */
        remove(id: string | number): void {
            try {
                this.$store.notifications.remove(id.toString());
            } catch (error) {
                this.handleComponentError(error as Error, 'remove', [id]);
            }
        },
        
        /**
         * Get CSS classes for a notification based on its type
         */
        getNotificationClass(type: NotificationType): string {
            try {
                const classes: Record<NotificationType, string> = {
                    'success': 'bg-green-900 text-green-300 border-green-700',
                    'error': 'bg-red-900 text-red-300 border-red-700',
                    'warning': 'bg-yellow-900 text-yellow-300 border-yellow-700',
                    'info': 'bg-blue-900 text-blue-300 border-blue-700'
                };
                return classes[type] || classes.info;
            } catch (error) {
                this.handleComponentError(error as Error, 'getNotificationClass', [type]);
                return 'bg-blue-900 text-blue-300 border-blue-700'; // fallback
            }
        },
        
        /**
         * Handle component errors with recovery mechanism
         */
        handleComponentError(error: Error, method: string, args: any[] = []): void {
            this.hasError = true;
            this.errorMessage = error.message || 'Notification component error';
            
            // Use centralized error handling
            const standardError = ErrorHandler.processError(
                error,
                'notificationSystem',
                method
            );
            
            // For notification system errors, don't show to user to avoid recursion
            if (process.env.NODE_ENV === 'development') {
                console.error('Notification System Error:', standardError.toJSON());
            }
            
            // Attempt recovery after delay
            setTimeout(() => {
                this.recoverFromError();
            }, 2000);
        },
        
        /**
         * Recover from component errors
         * 
         * Resets error state and attempts to reinitialize the component.
         */
        recoverFromError(): void {
            this.hasError = false;
            this.errorMessage = null;
            
            // Reinitialize if needed
            try {
                this.setupErrorHandling();
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Failed to recover notification system:', error);
                }
            }
        },

        /**
         * Destroy the notification system
         */
        destroy(): void {
            // Cleanup any timers or observers
            this.$store.notifications.clear();
            
            // Remove window event listeners
            if (this._errorHandler) {
                window.removeEventListener('error', this._errorHandler);
                this._errorHandler = null;
            }
        }
    } as CustomAlpineComponent<NotificationSystemData>;
}

/**
 * HTML escaping utility function
 * 
 * Escapes HTML special characters to prevent XSS attacks
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Input sanitization function for notification messages
 * 
 * Validates and sanitizes notification messages for security
 */
function sanitizeMessage(message: any): string {
    if (typeof message !== 'string') {
        return 'Invalid message format';
    }
    
    // Limit message length
    if (message.length > 1000) {
        message = message.substring(0, 1000) + '...';
    }
    
    // Escape HTML and remove potentially dangerous content
    return escapeHtml(message);
}

// Notification store interface
interface NotificationStore {
    items: NotificationItem[];
    add(message: string, type?: NotificationType, duration?: number): void;
    remove(id: string | number): void;
    clear(): void;
}

/**
 * Notifications store - using Alpine.js init event
 * 
 * Global Alpine.js store for managing notification messages.
 * Provides methods to add, remove, and clear notifications.
 */
document.addEventListener('alpine:init', () => {
    if (typeof window !== 'undefined' && window.Alpine) {
        window.Alpine.store('notifications', {
            /** Array of active notification objects */
            items: [] as NotificationItem[],
            
            /**
             * Add a new notification to the store
             */
            add(message: string, type: NotificationType = 'info', duration: number = 5000): void {
                try {
                    // Sanitize input parameters
                    const sanitizedMessage = sanitizeMessage(message);
                    const validTypes: NotificationType[] = ['success', 'error', 'warning', 'info'];
                    const sanitizedType = validTypes.includes(type) ? type : 'info';
                    const sanitizedDuration = Math.max(0, Math.min(duration, 30000)); // 0-30s limit
                    
                    const notification: NotificationItem = {
                        id: (Date.now() + Math.random()).toString(),
                        message: sanitizedMessage,
                        type: sanitizedType,
                        timestamp: Date.now(),
                        duration: sanitizedDuration
                    };
                    
                    this.items.push(notification);
                    
                    if (sanitizedDuration > 0) {
                        setTimeout(() => {
                            this.remove(notification.id);
                        }, sanitizedDuration);
                    }
                } catch (error) {
                    if (process.env.NODE_ENV === 'development') {
                        console.error('Error adding notification:', error);
                    }
                    
                    // Fallback: add a basic error notification
                    this.items.push({
                        id: (Date.now() + Math.random()).toString(),
                        message: 'Error processing notification',
                        type: 'error',
                        timestamp: Date.now(),
                        duration: 5000
                    });
                }
            },
            
            /**
             * Remove a notification by ID
             */
            remove(id: string | number): void {
                this.items = this.items.filter(item => item.id !== id);
            },
            
            /**
             * Clear all notifications
             */
            clear(): void {
                this.items = [];
            },
            
            /**
             * Get notifications by type
             */
            getByType(type: NotificationType): NotificationItem[] {
                return this.items.filter((item: NotificationItem) => item.type === type);
            },
            
            /**
             * Get notification count
             */
            getCount(): number {
                return this.items.length;
            },
            
            /**
             * Get notification count by type
             */
            getCountByType(type: NotificationType): number {
                return this.items.filter((item: NotificationItem) => item.type === type).length;
            }
        } as NotificationStore);
    }
});

// Export type for testing and module usage
export type NotificationSystemComponent = CustomAlpineComponent<NotificationSystemData>;