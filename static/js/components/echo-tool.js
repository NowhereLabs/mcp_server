// Echo Tool Alpine.js Component
import { ErrorHandler, ERROR_TYPES } from '../utils/error-handler.js';

/**
 * Echo Tool Alpine.js Component
 * 
 * This component provides a simple echo tool interface for the MCP Dashboard.
 * It handles input validation, sanitization, and execution of echo commands
 * with proper error handling and user feedback.
 * 
 * @returns {Object} Alpine.js component object
 */
export function echoTool() {
    return {
        /** @type {string} The input message to echo */
        message: 'Hello from the MCP Dashboard!',
        
        /** @type {string|null} The result of the last echo execution */
        result: null,
        
        /** @type {string|null} The execution time of the last command */
        executionTime: null,
        
        /** @type {Object} Form validation errors */
        errors: {},
        
        /** @type {Object|null} The tool executor instance */
        executor: null,
        
        /**
         * Validates and sanitizes user input for security
         * 
         * @param {string} input - The input string to validate
         * @returns {Object} Validation result with valid flag, errors array, and sanitized input
         * @returns {boolean} returns.valid - Whether the input is valid
         * @returns {string[]} returns.errors - Array of validation error messages
         * @returns {string} returns.sanitized - The sanitized input string
         */
        validateAndSanitizeInput(input) {
            const errors = [];
            
            if (!input || typeof input !== 'string') {
                errors.push('Message must be a non-empty string');
                return { valid: false, errors, sanitized: '' };
            }
            
            // Length validation
            if (input.length > 1000) {
                errors.push('Message too long (max 1000 characters)');
            }
            
            // Check for potentially dangerous patterns
            const dangerousPatterns = [
                /<script[^>]*>/i,
                /javascript:/i,
                /vbscript:/i,
                /onload\s*=/i,
                /onerror\s*=/i
            ];
            
            for (const pattern of dangerousPatterns) {
                if (pattern.test(input)) {
                    errors.push('Message contains potentially dangerous content');
                    break;
                }
            }
            
            return {
                valid: errors.length === 0,
                errors,
                sanitized: input.trim()
            };
        },
        
        /**
         * Initialize the component
         * Sets up the tool executor instance from the Alpine store
         */
        init() {
            // Initialize the tool executor
            this.executor = Alpine.store('toolExecution').getExecutor('echo');
        },
        
        /**
         * Get the current loading state of the tool executor
         * @returns {boolean} True if the executor is currently loading
         */
        get loading() {
            return this.executor ? this.executor.loading : false;
        },
        
        /**
         * Get the execution history from the tool executor
         * @returns {Array} Array of previous execution results
         */
        get executionHistory() {
            return this.executor ? this.executor.executionHistory : [];
        },
        
        /**
         * Execute the echo tool with the current message
         * 
         * Validates input, executes the tool, and handles the response.
         * Updates the result and execution time on success, or shows errors on failure.
         * 
         * @async
         * @returns {Promise<void>}
         */
        async execute() {
            try {
                if (!this.validateForm()) return;
                
                if (!this.executor) {
                    this.executor = Alpine.store('toolExecution')?.getExecutor('echo');
                    if (!this.executor) {
                        throw new Error('Tool executor not available');
                    }
                }
                
                const result = await this.executor.execute({ message: this.message });
                
                if (result.success) {
                    this.result = JSON.stringify(result.result, null, 2);
                    this.executionTime = `Executed in ${this.executor.lastResult?.duration || 0}ms`;
                } else {
                    this.result = null;
                    this.executionTime = null;
                    
                    // Show error to user
                    if (Alpine.store('notifications')) {
                        Alpine.store('notifications').add(
                            `Tool execution failed: ${result.error || 'Unknown error'}`,
                            'error'
                        );
                    }
                }
                
            } catch (error) {
                this.handleExecutionError(error);
            }
        },
        
        /**
         * Handle execution errors with centralized error processing
         * 
         * @param {Error} error - The error that occurred during execution
         */
        handleExecutionError(error) {
            // Use centralized error handling
            const standardError = ErrorHandler.processError(
                error,
                'echoTool',
                'execute'
            );
            
            this.result = null;
            this.executionTime = null;
            
            // For user errors, show the original message
            if (error.message && error.message.includes('validation')) {
                const validationError = ErrorHandler.createValidationError(
                    'Please check your input and try again.',
                    { originalError: error.message }
                );
                ErrorHandler.showErrorToUser(validationError, 'echoTool');
            }
        },
        
        /**
         * Validate the form input before execution
         * 
         * @returns {boolean} True if the form is valid, false otherwise
         */
        validateForm() {
            this.errors = {};
            
            const validation = this.validateAndSanitizeInput(this.message);
            
            if (!validation.valid) {
                this.errors.message = validation.errors.join(', ');
                return false;
            }
            
            // Update message with sanitized version
            this.message = validation.sanitized;
            return true;
        },
        
        /**
         * Clear the execution history
         * 
         * Clears all previous execution results from the tool executor.
         * Handles any errors that occur during the clearing process.
         */
        clearHistory() {
            try {
                if (this.executor) {
                    this.executor.clearHistory();
                }
            } catch (error) {
                ErrorHandler.processError(error, 'echoTool', 'clearHistory');
            }
        },
        
        /**
         * Get the success rate of tool executions
         * 
         * @returns {number} The success rate as a decimal (0.0 to 1.0)
         */
        getSuccessRate() {
            try {
                return this.executor ? this.executor.getSuccessRate() : 0;
            } catch (error) {
                ErrorHandler.processError(error, 'echoTool', 'getSuccessRate');
                return 0;
            }
        },
        
        /**
         * Get the average execution time of tool executions
         * 
         * @returns {number} The average execution time in milliseconds
         */
        getAverageExecutionTime() {
            try {
                return this.executor ? this.executor.getAverageExecutionTime() : 0;
            } catch (error) {
                ErrorHandler.processError(error, 'echoTool', 'getAverageExecutionTime');
                return 0;
            }
        }
    };
}