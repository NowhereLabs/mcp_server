// Event Stream Alpine.js Component

/**
 * Event Stream Alpine.js Component
 * 
 * This component manages server-sent events (SSE) for real-time event streaming.
 * It handles event reception, sanitization, and display with proper error handling.
 * 
 * @returns {Object} Alpine.js component object
 */
export function eventStream() {
    return {
        /**
         * Get all events from the event stream store
         * 
         * @returns {Array} Array of event objects
         */
        get events() {
            return Alpine.store('eventStream').events;
        },
        
        /**
         * Initialize server-sent events (SSE)
         * 
         * Note: SSE initialization is handled by HTMX
         */
        initializeSSE() {
            // SSE initialization handled by HTMX
        },
        
        /**
         * Handle incoming SSE messages
         * 
         * @param {Event} event - The SSE event containing data
         */
        handleSSEMessage(event) {
            try {
                const data = JSON.parse(event.detail.data);
                // Sanitize event data before storing
                const sanitizedData = this.sanitizeEventData(data);
                Alpine.store('eventStream').addEvent(sanitizedData);
            } catch (error) {
                this.handleEventStreamError(error, 'handleSSEMessage', [event]);
            }
        },
        
        /**
         * Handle event stream errors with recovery mechanism
         * 
         * @param {Error} error - The error that occurred
         * @param {string} method - The method where the error occurred
         * @param {Array} args - The arguments passed to the method
         */
        handleEventStreamError(error, method, args = []) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Event Stream Error:', {
                    error,
                    method,
                    args,
                    component: 'eventStream'
                });
            }
            
            // Add error to global error boundary
            if (Alpine.store('errorBoundary')) {
                Alpine.store('errorBoundary').addError(error, 'eventStream', method);
            }
            
            // Add a fallback error event to the stream
            try {
                Alpine.store('eventStream').addEvent({
                    type: 'error',
                    message: 'Error processing event stream',
                    timestamp: new Date().toISOString()
                });
            } catch (fallbackError) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Failed to add fallback error event:', fallbackError);
                }
            }
        },
        
        /**
         * Sanitize event data to prevent XSS attacks
         * 
         * @param {Object} data - The raw event data to sanitize
         * @returns {Object} Sanitized event data
         */
        sanitizeEventData(data) {
            try {
                const sanitized = {};
                
                // Whitelist allowed properties and sanitize their values
                const allowedProps = ['type', 'name', 'message', 'uri', 'timestamp'];
                
                for (const prop of allowedProps) {
                    if (data[prop] !== undefined) {
                        sanitized[prop] = this.sanitizeString(data[prop]);
                    }
                }
                
                // Ensure timestamp is valid
                if (sanitized.timestamp && !isNaN(Date.parse(sanitized.timestamp))) {
                    sanitized.timestamp = new Date(sanitized.timestamp).toISOString();
                } else {
                    sanitized.timestamp = new Date().toISOString();
                }
                
                return sanitized;
            } catch (error) {
                this.handleEventStreamError(error, 'sanitizeEventData', [data]);
                
                // Return a safe fallback event
                return {
                    type: 'error',
                    message: 'Failed to process event data',
                    timestamp: new Date().toISOString()
                };
            }
        },
        
        /**
         * Sanitize a string value to prevent XSS
         * 
         * @param {any} value - The value to sanitize
         * @returns {string} The sanitized string
         */
        sanitizeString(value) {
            if (typeof value !== 'string') {
                return String(value);
            }
            
            // Limit length to prevent DoS
            if (value.length > 500) {
                value = value.substring(0, 500) + '...';
            }
            
            // Escape HTML entities
            const div = document.createElement('div');
            div.textContent = value;
            return div.innerHTML;
        },
        
        /**
         * Get CSS classes for an event based on its type
         * 
         * @param {string} type - The event type
         * @returns {string} CSS class string for the event
         */
        getEventClass(type) {
            const classes = {
                'error': 'bg-red-900 bg-opacity-30 text-red-300 border-red-500',
                'tool_called': 'bg-green-900 bg-opacity-30 text-green-300 border-green-500',
                'default': 'bg-blue-900 bg-opacity-30 text-blue-300 border-blue-500'
            };
            return classes[type] || classes.default;
        },
        
        /**
         * Format an event object into a display string
         * 
         * @param {Object} event - The event object to format
         * @returns {string} Formatted event string
         */
        formatEvent(event) {
            try {
                const timestamp = new Date(event.timestamp).toLocaleTimeString();
                let message = `[${timestamp}] ${event.type || 'unknown'}`;
                
                // All event properties are already sanitized at this point
                if (event.name) message += `: ${event.name}`;
                if (event.message) message += `: ${event.message}`;
                if (event.uri) message += `: ${event.uri}`;
                if (event.id) message += ` (${event.id})`;
                
                return message;
            } catch (error) {
                return '[Invalid event data]';
            }
        }
    };
}

/**
 * Event stream store - using Alpine.js init event
 * 
 * Global Alpine.js store for managing event stream data.
 * Provides methods to add events and manage the event history.
 */
document.addEventListener('alpine:init', () => {
    Alpine.store('eventStream', {
        /** @type {Array} Array of event objects */
        events: [],
        
        /** @type {number} Maximum number of events to keep in memory */
        maxEvents: 20,
        
        /**
         * Add a new event to the stream
         * 
         * @param {Object} event - The event object to add
         */
        addEvent(event) {
            // Additional validation at store level
            if (!event || typeof event !== 'object') {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('Invalid event data received');
                }
                return;
            }
            
            const eventWithId = { ...event, id: Date.now() + Math.random() };
            this.events.unshift(eventWithId);
            
            if (this.events.length > this.maxEvents) {
                this.events.pop();
            }
        },
        
        /**
         * Clear all events from the stream
         */
        clear() {
            this.events = [];
        }
    });
});