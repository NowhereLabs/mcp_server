// Metrics Dashboard Alpine.js Component

/**
 * Metrics Dashboard Alpine.js Component
 * 
 * This component provides a dashboard interface for displaying system metrics
 * and performance data. It integrates with the metrics store to manage real-time
 * data updates and loading states.
 * 
 * @returns {Object} Alpine.js component object
 */
export function metricsStore() {
    return {
        /**
         * Get the current metrics data from the store
         * 
         * @returns {Object} Current metrics data
         */
        get metrics() {
            return Alpine.store('metrics').data;
        },
        
        /**
         * Get the current loading state from the store
         * 
         * @returns {boolean} True if metrics are currently loading
         */
        get loading() {
            return Alpine.store('metrics').loading;
        },
        
        /**
         * Initialize metrics updates by setting loading state
         */
        initializeUpdates() {
            Alpine.store('metrics').setLoading(true);
        },
        
        /**
         * Update metrics data from an event
         * 
         * @param {Event} event - The event containing metrics data in xhr.response
         */
        updateMetrics(event) {
            try {
                const data = JSON.parse(event.detail.xhr.response);
                Alpine.store('metrics').update(data);
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error parsing metrics:', error);
                }
                Alpine.store('metrics').setLoading(false);
            }
        }
    };
}

/**
 * Metrics store - using Alpine.js init event
 * 
 * Global Alpine.js store for managing system metrics data.
 * Provides methods to update metrics data and manage loading states.
 */
document.addEventListener('alpine:init', () => {
    Alpine.store('metrics', {
        /** @type {Object} Current metrics data */
        data: {},
        
        /** @type {boolean} Loading state indicator */
        loading: false,
        
        /**
         * Update metrics data with new values
         * 
         * @param {Object} newData - New metrics data to merge with existing data
         */
        update(newData) {
            this.data = { ...this.data, ...newData };
            this.loading = false;
        },
        
        /**
         * Set the loading state
         * 
         * @param {boolean} state - The loading state to set
         */
        setLoading(state) {
            this.loading = state;
        }
    });
});