// Enhanced Tool Executor Component
export function toolExecutor(toolName) {
    return {
        toolName,
        loading: false,
        lastResult: null,
        executionHistory: [],
        
        async execute(args = {}) {
            this.loading = true;
            const executionId = Date.now() + Math.random();
            
            try {
                const startTime = Date.now();
                
                const response = await fetch('/api/tools/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: this.toolName,
                        arguments: args
                    })
                });
                
                const data = await response.json();
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Store execution result
                this.lastResult = {
                    id: executionId,
                    success: data.success,
                    result: data.result,
                    error: data.error,
                    duration,
                    timestamp: new Date().toISOString(),
                    args
                };
                
                // Add to history
                this.executionHistory.unshift(this.lastResult);
                if (this.executionHistory.length > 10) {
                    this.executionHistory.pop();
                }
                
                if (data.success) {
                    Alpine.store('notifications').add(
                        `Tool "${this.toolName}" executed successfully (${duration}ms)`,
                        'success'
                    );
                    
                    // Trigger HTMX updates
                    Alpine.store('dashboard').refreshAll();
                } else {
                    Alpine.store('notifications').add(
                        `Tool execution failed: ${data.error}`,
                        'error'
                    );
                }
                
                return data;
                
            } catch (error) {
                const errorResult = {
                    id: executionId,
                    success: false,
                    error: error.message,
                    duration: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                    args
                };
                
                this.lastResult = errorResult;
                this.executionHistory.unshift(errorResult);
                
                Alpine.store('notifications').add(
                    `Error executing tool: ${error.message}`,
                    'error'
                );
                
                throw error;
            } finally {
                this.loading = false;
            }
        },
        
        getSuccessRate() {
            if (this.executionHistory.length === 0) return 0;
            const successful = this.executionHistory.filter(h => h.success).length;
            return Math.round((successful / this.executionHistory.length) * 100);
        },
        
        getAverageExecutionTime() {
            if (this.executionHistory.length === 0) return 0;
            const total = this.executionHistory.reduce((sum, h) => sum + h.duration, 0);
            return Math.round(total / this.executionHistory.length);
        },
        
        clearHistory() {
            this.executionHistory = [];
            this.lastResult = null;
        }
    };
}

// Global tool execution helper
window.addEventListener('alpine:init', () => {
    Alpine.store('toolExecution', {
        activeExecutions: new Map(),
        
        getExecutor(toolName) {
            if (!this.activeExecutions.has(toolName)) {
                this.activeExecutions.set(toolName, toolExecutor(toolName));
            }
            return this.activeExecutions.get(toolName);
        },
        
        async executeGlobal(toolName, args = {}) {
            const executor = this.getExecutor(toolName);
            return await executor.execute(args);
        },
        
        getToolStats(toolName) {
            const executor = this.activeExecutions.get(toolName);
            if (!executor) return null;
            
            return {
                executions: executor.executionHistory.length,
                successRate: executor.getSuccessRate(),
                averageTime: executor.getAverageExecutionTime(),
                lastResult: executor.lastResult
            };
        },
        
        getAllStats() {
            const stats = {};
            this.activeExecutions.forEach((executor, toolName) => {
                stats[toolName] = this.getToolStats(toolName);
            });
            return stats;
        }
    });
});