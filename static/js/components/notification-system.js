// Notification System Alpine.js Component
import { ErrorHandler, ERROR_TYPES } from '../utils/error-handler.js';

/**
 * Notification System Alpine.js Component
 * 
 * This component provides a notification display system with error handling
 * and recovery mechanisms. It integrates with the global notifications store
 * to display messages to users.
 * 
 * @returns {Object} Alpine.js component object
 */
export function notificationSystem() {
    return {
        /** @type {boolean} Whether the component has encountered an error */
        hasError: false,
        
        /** @type {string|null} Current error message */
        errorMessage: null,
        
        /**
         * Initialize the notification system component
         * Sets up error handling wrappers for critical methods
         */
        init() {
            this.setupErrorHandling();
        },
        
        /**
         * Set up error handling wrappers for component methods
         * 
         * Wraps critical methods with try-catch blocks to prevent
         * component crashes and provide graceful error handling.
         */
        setupErrorHandling() {
            // Wrap critical methods with error handling
            const originalRemove = this.remove;
            this.remove = (id) => {
                try {
                    return originalRemove.call(this, id);
                } catch (error) {
                    this.handleComponentError(error, 'remove', [id]);
                }
            };
        },
        
        /**
         * Get all notifications from the store
         * 
         * @returns {Array} Array of notification objects
         */
        get notifications() {
            try {
                return Alpine.store('notifications')?.items || [];
            } catch (error) {
                this.handleComponentError(error, 'notifications getter');
                return [];
            }
        },
        
        /**
         * Remove a notification by ID
         * 
         * @param {string|number} id - The ID of the notification to remove
         */
        remove(id) {
            try {
                Alpine.store('notifications').remove(id);
            } catch (error) {
                this.handleComponentError(error, 'remove', [id]);
            }
        },
        
        /**
         * Get CSS classes for a notification based on its type
         * 
         * @param {string} type - The notification type ('success', 'error', 'warning', 'info')
         * @returns {string} CSS class string for the notification
         */
        getNotificationClass(type) {
            try {
                const classes = {
                    'success': 'bg-green-900 text-green-300 border-green-700',
                    'error': 'bg-red-900 text-red-300 border-red-700',
                    'warning': 'bg-yellow-900 text-yellow-300 border-yellow-700',
                    'info': 'bg-blue-900 text-blue-300 border-blue-700'
                };
                return classes[type] || classes.info;
            } catch (error) {
                this.handleComponentError(error, 'getNotificationClass', [type]);
                return 'bg-blue-900 text-blue-300 border-blue-700'; // fallback
            }
        },
        
        /**
         * Handle component errors with recovery mechanism
         * 
         * @param {Error} error - The error that occurred
         * @param {string} method - The method where the error occurred
         * @param {Array} args - The arguments passed to the method
         */
        handleComponentError(error, method, args = []) {
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
        recoverFromError() {
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
        }
    };
}

/**
 * HTML escaping utility function
 * 
 * Escapes HTML special characters to prevent XSS attacks
 * 
 * @param {string} text - The text to escape
 * @returns {string} The escaped HTML string
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Input sanitization function for notification messages
 * 
 * Validates and sanitizes notification messages for security
 * 
 * @param {any} message - The message to sanitize
 * @returns {string} The sanitized message
 */
function sanitizeMessage(message) {
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

/**
 * Notifications store - using Alpine.js init event
 * 
 * Global Alpine.js store for managing notification messages.
 * Provides methods to add, remove, and clear notifications.
 */
document.addEventListener('alpine:init', () => {
    Alpine.store('notifications', {
        /** @type {Array} Array of active notification objects */
        items: [],
        
        /**
         * Add a new notification to the store
         * 
         * @param {string} message - The notification message
         * @param {string} type - The notification type ('success', 'error', 'warning', 'info')
         * @param {number} duration - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
         */
        add(message, type = 'info', duration = 5000) {
            try {
                // Sanitize input parameters
                const sanitizedMessage = sanitizeMessage(message);
                const validTypes = ['success', 'error', 'warning', 'info'];
                const sanitizedType = validTypes.includes(type) ? type : 'info';
                const sanitizedDuration = Math.max(0, Math.min(duration, 30000)); // 0-30s limit
                
                const notification = {
                    id: Date.now() + Math.random(),
                    message: sanitizedMessage,
                    type: sanitizedType,
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
                    id: Date.now() + Math.random(),
                    message: 'Error processing notification',
                    type: 'error',
                    duration: 5000
                });
            }
        },
        
        /**
         * Remove a notification by ID
         * 
         * @param {string|number} id - The ID of the notification to remove
         */
        remove(id) {
            this.items = this.items.filter(item => item.id !== id);
        },
        
        /**
         * Clear all notifications
         */
        clear() {
            this.items = [];
        }
    });
});