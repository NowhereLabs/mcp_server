// Event Stream Alpine.js Component
export function eventStream() {
    return {
        get events() {
            return Alpine.store('eventStream').events;
        },
        
        initializeSSE() {
            // SSE initialization handled by HTMX
        },
        
        handleSSEMessage(event) {
            try {
                const data = JSON.parse(event.detail.data);
                Alpine.store('eventStream').addEvent(data);
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        },
        
        getEventClass(type) {
            const classes = {
                'error': 'bg-red-900 bg-opacity-30 text-red-300 border-red-500',
                'tool_called': 'bg-green-900 bg-opacity-30 text-green-300 border-green-500',
                'default': 'bg-blue-900 bg-opacity-30 text-blue-300 border-blue-500'
            };
            return classes[type] || classes.default;
        },
        
        formatEvent(event) {
            const timestamp = new Date(event.timestamp).toLocaleTimeString();
            let message = `[${timestamp}] ${event.type}`;
            
            if (event.name) message += `: ${event.name}`;
            if (event.message) message += `: ${event.message}`;
            if (event.uri) message += `: ${event.uri}`;
            if (event.id) message += ` (${event.id})`;
            
            return message;
        }
    };
}

// Global event stream store
window.addEventListener('alpine:init', () => {
    Alpine.store('eventStream', {
        events: [],
        maxEvents: 20,
        
        addEvent(event) {
            const eventWithId = { ...event, id: Date.now() + Math.random() };
            this.events.unshift(eventWithId);
            
            if (this.events.length > this.maxEvents) {
                this.events.pop();
            }
        },
        
        clear() {
            this.events = [];
        }
    });
});