// Type declarations for error-boundary.js

export interface ErrorBoundaryComponent {
  hasError: boolean;
  errorMessage: string | null;
  errorStack: string | null;
  errorInfo: ErrorInfo | null;
  
  init(): void;
  setupErrorHandling(): void;
  wrapComponentMethods(): void;
  createErrorBoundaryWrapper<T extends any[], R>(
    originalMethod: (...args: T) => R,
    methodName: string
  ): (...args: T) => R;
  handleError(error: Error, methodName: string, args?: any[]): void;
  getFallbackValue(methodName: string): any;
  recoverFromError(): void;
  setupGlobalErrorHandlers(): void;
  retryOperation(methodName: string, ...args: any[]): void;
}

export interface ErrorInfo {
  method: string;
  arguments: any[];
  timestamp: string;
  component: string;
}

export interface ErrorEntry {
  id: number;
  error: string;
  component: string;
  method: string;
  timestamp: string;
  stack: string;
}

export interface ErrorStats {
  total: number;
  recent: number;
  components: string[];
  mostCommon: Array<{ error: string; count: number }>;
}

export interface ErrorReport {
  timestamp: string;
  summary: {
    totalErrors: number;
    recentErrors: number;
    affectedComponents: number;
    mostCommonErrors: Array<{ error: string; count: number }>;
  };
  details: {
    errors: ErrorEntry[];
    components: string[];
    timeRange: {
      oldest?: string;
      newest?: string;
    };
  };
  recommendations: Array<{
    type: string;
    message: string;
    action: string;
  }>;
}

export interface ErrorBoundaryStore {
  errors: ErrorEntry[];
  maxErrors: number;
  
  addError(error: Error, component?: string, method?: string): void;
  checkCriticalErrors(): void;
  handleCriticalErrors(errorContext: any): void;
  attemptRecovery(errorContext: any): void;
  recoverComponent(componentName: string): void;
  suggestPageRefresh(): void;
  clearErrors(): void;
  getErrorStats(): ErrorStats;
  getMostCommonError(): Array<{ error: string; count: number }>;
  generateErrorReport(): ErrorReport;
  generateRecommendations(): Array<{ type: string; message: string; action: string }>;
  exportErrorReport(): void;
}

export declare function errorBoundary(): ErrorBoundaryComponent;
export declare function withErrorBoundary<T extends object>(component: T): T & ErrorBoundaryComponent;

// Types are handled by globals.d.ts