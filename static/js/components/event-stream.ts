// Event Stream Alpine.js Component

import type * as Alpine from 'alpinejs';
import { EventData, SSEMessage, CustomAlpineComponent } from '../types/alpine';
import { ErrorHandler, ERROR_TYPES } from '../utils/error-handler';

// Event Stream component data interface
interface EventStreamData {
    events: EventData[];
    initializeSSE(): void;
    handleSSEMessage(event: SSEMessage): void;
    handleEventStreamError(error: Error, method: string, args?: any[]): void;
    sanitizeEventData(data: any): EventData;
    sanitizeString(value: any): string;
    getEventClass(type: string): string;
    formatEvent(event: EventData): string;
}

/**
 * Event Stream Alpine.js Component
 * 
 * This component manages server-sent events (SSE) for real-time event streaming.
 * It handles event reception, sanitization, and display with proper error handling.
 */
export function eventStream(): CustomAlpineComponent<EventStreamData> {
    return {
        /**
         * Get all events from the event stream store
         */
        get events(): EventData[] {
            return this.$store.eventStream.events;
        },
        
        /**
         * Initialize server-sent events (SSE)
         * 
         * Note: SSE initialization is handled by HTMX
         */
        initializeSSE(): void {
            // SSE initialization handled by HTMX
        },
        
        /**
         * Handle incoming SSE messages
         */
        handleSSEMessage(event: SSEMessage): void {
            try {
                const data = JSON.parse(event.detail.data);
                // Sanitize event data before storing
                const sanitizedData = this.sanitizeEventData(data);
                this.$store.eventStream.addEvent(sanitizedData);
            } catch (error) {
                this.handleEventStreamError(error as Error, 'handleSSEMessage', [event]);
            }
        },
        
        /**
         * Handle event stream errors with recovery mechanism
         */
        handleEventStreamError(error: Error, method: string, args: any[] = []): void {
            // Use standardized error handler
            const standardError = ErrorHandler.processError(
                error,
                'eventStream',
                `${method}_event_stream_processing`
            );
            
            // Show error to user through notification system
            ErrorHandler.showErrorToUser(standardError, 'eventStream');
            
            // Add a fallback error event to the stream
            try {
                this.$store.eventStream.addEvent({
                    type: 'error',
                    message: 'Error processing event stream',
                    timestamp: new Date().toISOString()
                });
            } catch (fallbackError) {
                ErrorHandler.processError(
                    fallbackError as Error,
                    'eventStream',
                    'fallbackErrorEvent'
                );
            }
        },
        
        /**
         * Sanitize event data to prevent XSS attacks
         */
        sanitizeEventData(data: any): EventData {
            try {
                const sanitized: Partial<EventData> = {};
                
                // Whitelist allowed properties and sanitize their values
                const allowedProps: (keyof EventData)[] = ['type', 'name', 'message', 'uri', 'timestamp'];
                
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
                
                // Ensure required fields are present
                const result: EventData = {
                    type: sanitized.type || 'unknown',
                    timestamp: sanitized.timestamp,
                    ...sanitized
                };
                
                return result;
            } catch (error) {
                this.handleEventStreamError(error as Error, 'sanitizeEventData', [data]);
                
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
         */
        sanitizeString(value: any): string {
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
         */
        getEventClass(type: string): string {
            const classes: Record<string, string> = {
                'error': 'bg-red-900 bg-opacity-30 text-red-300 border-red-500',
                'tool_called': 'bg-green-900 bg-opacity-30 text-green-300 border-green-500',
                'default': 'bg-blue-900 bg-opacity-30 text-blue-300 border-blue-500'
            };
            return classes[type] || classes.default;
        },
        
        /**
         * Format an event object into a display string
         */
        formatEvent(event: EventData): string {
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
    } as CustomAlpineComponent<EventStreamData>;
}

/**
 * Event stream store - using Alpine.js init event
 * 
 * Global Alpine.js store for managing event stream data.
 * Provides methods to add events and manage the event history.
 */
document.addEventListener('alpine:init', () => {
    if (typeof window !== 'undefined' && window.Alpine) {
        window.Alpine.store('eventStream', {
            /** Array of event objects */
            events: [] as EventData[],
            
            /** Maximum number of events to keep in memory */
            maxEvents: 20,
            
            /**
             * Add a new event to the stream
             */
            addEvent(event: EventData): void {
                // Additional validation at store level
                if (!event || typeof event !== 'object') {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn('Invalid event data received');
                    }
                    return;
                }
                
                const eventWithId: EventData = { 
                    ...event, 
                    id: (Date.now() + Math.random()).toString()
                };
                this.events.unshift(eventWithId);
                
                if (this.events.length > this.maxEvents) {
                    this.events.pop();
                }
            },
            
            /**
             * Clear all events from the stream
             */
            clear(): void {
                this.events = [];
            }
        });
    }
});

// Export component type for testing and module usage
export type EventStreamComponent = CustomAlpineComponent<EventStreamData>;