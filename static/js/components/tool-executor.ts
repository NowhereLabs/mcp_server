// Enhanced Tool Executor Component

import type * as Alpine from 'alpinejs';
import { ToolParameter, ToolResult, CustomAlpineComponent } from '../types/alpine';
import { ErrorHandler, ERROR_TYPES } from '../utils/error-handler';

// Tool execution result interface
interface ToolExecutionResult {
    id: string;
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
    timestamp: string;
    args: Record<string, any>;
}

// Tool statistics interface
interface ToolStats {
    executions: number;
    successRate: number;
    averageTime: number;
    lastResult: ToolExecutionResult | null;
}

// Tool executor component data interface
interface ToolExecutorData {
    toolName: string;
    loading: boolean;
    lastResult: ToolExecutionResult | null;
    executionHistory: ToolExecutionResult[];
    
    execute(args?: Record<string, any>): Promise<any>;
    getSuccessRate(): number;
    getAverageExecutionTime(): number;
    clearHistory(): void;
}

// API response interface
interface ToolExecutionResponse {
    success: boolean;
    result?: any;
    error?: string;
}

export function toolExecutor(toolName: string): CustomAlpineComponent<ToolExecutorData> {
    return {
        toolName,
        loading: false,
        lastResult: null,
        executionHistory: [],
        
        async execute(args: Record<string, any> = {}): Promise<ToolExecutionResponse> {
            (this as any).loading = true;
            const executionId = (Date.now() + Math.random()).toString();
            const startTime = Date.now();
            
            try {
                const response = await fetch('/api/tools/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: (this as any).toolName,
                        arguments: args
                    })
                });
                
                const data: ToolExecutionResponse = await response.json();
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Store execution result
                (this as any).lastResult = {
                    id: executionId,
                    success: data.success,
                    result: data.result,
                    error: data.error,
                    duration,
                    timestamp: new Date().toISOString(),
                    args
                };
                
                // Add to history
                (this as any).executionHistory.unshift((this as any).lastResult);
                if ((this as any).executionHistory.length > 10) {
                    (this as any).executionHistory.pop();
                }
                
                if (data.success) {
                    (this as any).$store.notifications.add(
                        `Tool "${(this as any).toolName}" executed successfully (${duration}ms)`,
                        'success'
                    );
                    
                    // Trigger HTMX updates
                    (this as any).$store.dashboard.refreshAll();
                } else {
                    (this as any).$store.notifications.add(
                        `Tool execution failed: ${data.error}`,
                        'error'
                    );
                }
                
                return data;
                
            } catch (error) {
                // Use standardized error handler
                const standardError = ErrorHandler.processError(
                    error as Error,
                    'toolExecutor',
                    `execute_${(this as any).toolName}`
                );
                
                const errorResult: ToolExecutionResult = {
                    id: executionId,
                    success: false,
                    error: standardError.message,
                    duration: Date.now() - startTime,
                    timestamp: new Date().toISOString(),
                    args
                };
                
                (this as any).lastResult = errorResult;
                (this as any).executionHistory.unshift(errorResult);
                
                // Show standardized error to user
                ErrorHandler.showErrorToUser(standardError, 'toolExecutor');
                
                throw standardError;
            } finally {
                (this as any).loading = false;
            }
        },
        
        getSuccessRate(): number {
            if ((this as any).executionHistory.length === 0) return 0;
            const successful = (this as any).executionHistory.filter((h: any) => h.success).length;
            return Math.round((successful / (this as any).executionHistory.length) * 100);
        },
        
        getAverageExecutionTime(): number {
            if ((this as any).executionHistory.length === 0) return 0;
            const total = (this as any).executionHistory.reduce((sum: number, h: any) => sum + h.duration, 0);
            return Math.round(total / (this as any).executionHistory.length);
        },
        
        clearHistory(): void {
            (this as any).executionHistory = [];
            (this as any).lastResult = null;
        }
    } as unknown as CustomAlpineComponent<ToolExecutorData>;
}

// Tool execution store interface
export interface ToolExecutionStore {
    activeExecutions: Map<string, CustomAlpineComponent<ToolExecutorData>>;
    getExecutor(toolName: string): CustomAlpineComponent<ToolExecutorData>;
    executeGlobal(toolName: string, args?: Record<string, any>): Promise<ToolExecutionResponse>;
    getToolStats(toolName: string): ToolStats | null;
    getAllStats(): Record<string, ToolStats>;
}

// Global tool execution helper
if (typeof window !== 'undefined') {
    window.addEventListener('alpine:init', () => {
        if (window.Alpine) {
            window.Alpine.store('toolExecution', {
                activeExecutions: new Map<string, ToolExecutorComponent>(),
                
                getExecutor(toolName: string): ToolExecutorComponent {
                    if (!this.activeExecutions.has(toolName)) {
                        this.activeExecutions.set(toolName, toolExecutor(toolName));
                    }
                    return this.activeExecutions.get(toolName)!;
                },
                
                async executeGlobal(toolName: string, args: Record<string, any> = {}): Promise<ToolExecutionResponse> {
                    const executor = this.getExecutor(toolName);
                    return await executor.execute(args);
                },
                
                getToolStats(toolName: string): ToolStats | null {
                    const executor = this.activeExecutions.get(toolName);
                    if (!executor) return null;
                    
                    return {
                        executions: executor.executionHistory.length,
                        successRate: executor.getSuccessRate(),
                        averageTime: executor.getAverageExecutionTime(),
                        lastResult: executor.lastResult
                    };
                },
                
                getAllStats(): Record<string, ToolStats> {
                    const stats: Record<string, ToolStats> = {};
                    this.activeExecutions.forEach((executor, toolName) => {
                        const toolStats = this.getToolStats(toolName);
                        if (toolStats) {
                            stats[toolName] = toolStats;
                        }
                    });
                    return stats;
                },
                
                /**
                 * Clear all execution history
                 */
                clearAllHistory(): void {
                    this.activeExecutions.forEach(executor => {
                        executor.clearHistory();
                    });
                },
                
                /**
                 * Get total execution count across all tools
                 */
                getTotalExecutions(): number {
                    let total = 0;
                    this.activeExecutions.forEach(executor => {
                        total += executor.executionHistory.length;
                    });
                    return total;
                },
                
                /**
                 * Get overall success rate across all tools
                 */
                getOverallSuccessRate(): number {
                    let totalExecutions = 0;
                    let successfulExecutions = 0;
                    
                    this.activeExecutions.forEach(executor => {
                        totalExecutions += executor.executionHistory.length;
                        successfulExecutions += executor.executionHistory.filter(h => h.success).length;
                    });
                    
                    return totalExecutions > 0 ? Math.round((successfulExecutions / totalExecutions) * 100) : 0;
                }
            } as ToolExecutionStore);
        }
    });
}

// Export type for testing and module usage
export type ToolExecutorComponent = CustomAlpineComponent<ToolExecutorData>;