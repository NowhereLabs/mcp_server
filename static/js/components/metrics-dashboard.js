// Metrics Dashboard Alpine.js Component
export function metricsStore() {
    return {
        get metrics() {
            return Alpine.store('metrics').data;
        },
        
        get loading() {
            return Alpine.store('metrics').loading;
        },
        
        initializeUpdates() {
            Alpine.store('metrics').setLoading(true);
        },
        
        updateMetrics(event) {
            try {
                const data = JSON.parse(event.detail.xhr.response);
                Alpine.store('metrics').update(data);
            } catch (error) {
                console.error('Error parsing metrics:', error);
                Alpine.store('metrics').setLoading(false);
            }
        }
    };
}

// Global metrics store
window.addEventListener('alpine:init', () => {
    Alpine.store('metrics', {
        data: {},
        loading: false,
        
        update(newData) {
            this.data = { ...this.data, ...newData };
            this.loading = false;
        },
        
        setLoading(state) {
            this.loading = state;
        }
    });
});