// Echo Tool Alpine.js Component
export function echoTool() {
    return {
        message: 'Hello from the MCP Dashboard!',
        result: null,
        executionTime: null,
        errors: {},
        executor: null,
        
        init() {
            // Initialize the tool executor
            this.executor = Alpine.store('toolExecution').getExecutor('echo');
        },
        
        get loading() {
            return this.executor ? this.executor.loading : false;
        },
        
        get executionHistory() {
            return this.executor ? this.executor.executionHistory : [];
        },
        
        async execute() {
            this.validateForm();
            if (Object.keys(this.errors).length > 0) return;
            
            if (!this.executor) {
                this.executor = Alpine.store('toolExecution').getExecutor('echo');
            }
            
            try {
                const result = await this.executor.execute({ message: this.message });
                
                if (result.success) {
                    this.result = JSON.stringify(result.result, null, 2);
                    this.executionTime = `Executed in ${this.executor.lastResult.duration}ms`;
                } else {
                    this.result = null;
                    this.executionTime = null;
                }
                
            } catch (error) {
                this.result = null;
                this.executionTime = null;
            }
        },
        
        validateForm() {
            this.errors = {};
            if (!this.message.trim()) {
                this.errors.message = 'Message is required';
            }
        },
        
        clearHistory() {
            if (this.executor) {
                this.executor.clearHistory();
            }
        },
        
        getSuccessRate() {
            return this.executor ? this.executor.getSuccessRate() : 0;
        },
        
        getAverageExecutionTime() {
            return this.executor ? this.executor.getAverageExecutionTime() : 0;
        }
    };
}