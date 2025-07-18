// Echo Tool Alpine.js Component

import type * as Alpine from 'alpinejs';
import { ErrorHandler, ERROR_TYPES } from '../utils/error-handler';
import { CustomAlpineComponent } from '../types/alpine';

// Validation result interface
interface ValidationResult {
    valid: boolean;
    errors: string[];
    sanitized: string;
}

// Tool executor interface (simplified)
interface ToolExecutor {
    loading: boolean;
    executionHistory: any[];
    lastResult: any;
    execute(args: Record<string, any>): Promise<any>;
    clearHistory(): void;
    getSuccessRate(): number;
    getAverageExecutionTime(): number;
}

// Echo tool component data interface
interface EchoToolData {
    message: string;
    result: string | null;
    executionTime: string | null;
    errors: Record<string, string>;
    executor: ToolExecutor | null;
    loading: boolean;
    executionHistory: any[];
    
    init(): void;
    validateAndSanitizeInput(input: string): ValidationResult;
    execute(): Promise<void>;
    handleExecutionError(error: Error): void;
    validateForm(): boolean;
    clearHistory(): void;
    getSuccessRate(): number;
    getAverageExecutionTime(): number;
}

/**
 * Echo Tool Alpine.js Component
 * 
 * This component provides a simple echo tool interface for the MCP Dashboard.
 * It handles input validation, sanitization, and execution of echo commands
 * with proper error handling and user feedback.
 */
export function echoTool(): CustomAlpineComponent<EchoToolData> {
    return {
        /** The input message to echo */
        message: 'Hello from the MCP Dashboard!',
        
        /** The result of the last echo execution */
        result: null,
        
        /** The execution time of the last command */
        executionTime: null,
        
        /** Form validation errors */
        errors: {},
        
        /** The tool executor instance */
        executor: null,
        
        /**
         * Validates and sanitizes user input for security
         */
        validateAndSanitizeInput(input: string): ValidationResult {
            const errors: string[] = [];
            
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
        init(): void {
            // Initialize the tool executor
            this.executor = this.$store.toolExecution.getExecutor('echo');
        },
        
        /**
         * Get the current loading state of the tool executor
         */
        get loading(): boolean {
            return this.executor ? this.executor.loading : false;
        },
        
        /**
         * Get the execution history from the tool executor
         */
        get executionHistory(): any[] {
            return this.executor ? this.executor.executionHistory : [];
        },
        
        /**
         * Execute the echo tool with the current message
         * 
         * Validates input, executes the tool, and handles the response.
         * Updates the result and execution time on success, or shows errors on failure.
         */
        async execute(): Promise<void> {
            try {
                if (!this.validateForm()) return;
                
                if (!this.executor) {
                    this.executor = this.$store.toolExecution?.getExecutor('echo');
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
                    if (this.$store.notifications) {
                        this.$store.notifications.add(
                            `Tool execution failed: ${result.error || 'Unknown error'}`,
                            'error'
                        );
                    }
                }
                
            } catch (error) {
                this.handleExecutionError(error as Error);
            }
        },
        
        /**
         * Handle execution errors with centralized error processing
         */
        handleExecutionError(error: Error): void {
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
         */
        validateForm(): boolean {
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
        clearHistory(): void {
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
         */
        getSuccessRate(): number {
            try {
                return this.executor ? this.executor.getSuccessRate() : 0;
            } catch (error) {
                ErrorHandler.processError(error, 'echoTool', 'getSuccessRate');
                return 0;
            }
        },
        
        /**
         * Get the average execution time of tool executions
         */
        getAverageExecutionTime(): number {
            try {
                return this.executor ? this.executor.getAverageExecutionTime() : 0;
            } catch (error) {
                ErrorHandler.processError(error, 'echoTool', 'getAverageExecutionTime');
                return 0;
            }
        }
    } as CustomAlpineComponent<EchoToolData>;
}

// Export types for testing and module usage
export type EchoToolComponent = CustomAlpineComponent<EchoToolData>;
export { ToolExecutor };