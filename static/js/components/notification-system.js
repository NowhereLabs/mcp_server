// Notification System Alpine.js Component
export function notificationSystem() {
    return {
        get notifications() {
            return Alpine.store('notifications').items;
        },
        
        remove(id) {
            Alpine.store('notifications').remove(id);
        },
        
        getNotificationClass(type) {
            const classes = {
                'success': 'bg-green-900 text-green-300 border-green-700',
                'error': 'bg-red-900 text-red-300 border-red-700',
                'warning': 'bg-yellow-900 text-yellow-300 border-yellow-700',
                'info': 'bg-blue-900 text-blue-300 border-blue-700'
            };
            return classes[type] || classes.info;
        }
    };
}

// Global notifications store
window.addEventListener('alpine:init', () => {
    Alpine.store('notifications', {
        items: [],
        
        add(message, type = 'info', duration = 5000) {
            const notification = {
                id: Date.now() + Math.random(),
                message,
                type,
                duration
            };
            
            this.items.push(notification);
            
            if (duration > 0) {
                setTimeout(() => {
                    this.remove(notification.id);
                }, duration);
            }
        },
        
        remove(id) {
            this.items = this.items.filter(item => item.id !== id);
        },
        
        clear() {
            this.items = [];
        }
    });
});