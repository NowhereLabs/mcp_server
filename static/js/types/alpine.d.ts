/**
 * Alpine.js type definitions using official @types/alpinejs package
 * Custom store interfaces integrated with official Alpine.js types
 */

// Import official Alpine.js types
import type * as Alpine from 'alpinejs';
import type { ToolExecutionStore } from '../components/tool-executor';
import type { 
  DashboardMetrics, 
  McpStatus, 
  SessionInfo, 
  ToolCall as GeneratedToolCall, 
  ToolCallResult,
  SystemEvent
} from './generated';

// Legacy interface for backward compatibility during migration
// TODO: Remove after migration complete
interface LegacyDashboardMetrics {
    total_tool_calls: number;
    success_rate: number;
    active_sessions: number;
    avg_duration_ms: number;
    tools_available: number;
    resources_available: number;
}

// Alpine.js Store Types
interface AlpineStore {
  [key: string]: any;
}

// Use generated SystemEvent type instead of manual EventData
// Keep legacy for backward compatibility
interface EventData {
  id?: string;
  type: string;
  name?: string;
  message?: string;
  uri?: string;
  timestamp: string;
}

// Type alias for generated event type
type EventDataGenerated = SystemEvent;

interface EventStreamStore {
  events: EventData[];
  maxEvents: number;
  addEvent(event: EventData): void;
  clear(): void;
}

interface NotificationItem {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  duration?: number;
}

interface NotificationStore {
  items: NotificationItem[];
  add(message: string, type: NotificationType, duration?: number): void;
  remove(id: string): void;
  clear(): void;
  getByType(type: NotificationType): NotificationItem[];
  getCount(): number;
  getCountByType(type: NotificationType): number;
}

// Event System Types
interface SSEMessage {
  detail: {
    data: string;
  };
}

type NotificationType = 'info' | 'success' | 'warning' | 'error';

// Error Handling Types
enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  SECURITY = 'security',
  SYSTEM = 'system',
  USER = 'user',
  UNKNOWN = 'unknown'
}

enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface ErrorDetails {
  context?: string;
  originalError?: string;
  stack?: string;
  [key: string]: any;
}

// Metrics Types
interface MetricsData {
  timestamp: number;
  value: number;
  type: string;
  [key: string]: any;
}

interface MetricsStore {
  data: LegacyDashboardMetrics;
  loading: boolean;
  history: MetricsData[];
  addMetric(metric: MetricsData): void;
  clear(): void;
  getByType(type: string): MetricsData[];
  update(newData: LegacyDashboardMetrics): void;
  setLoading(state: boolean): void;
}

// Tool Execution Types
interface ToolParameter {
  name: string;
  type: string;
  value: any;
  required?: boolean;
}

interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

interface ToolStore {
  parameters: ToolParameter[];
  result: ToolResult | null;
  isExecuting: boolean;
  activeExecutions: any[];
  execute(params: ToolParameter[]): Promise<ToolResult>;
  clear(): void;
  getAllStats(): any;
}

// Dashboard Control Types
interface DashboardState {
  isRefreshing: boolean;
  lastRefresh: number;
  autoRefresh: boolean;
  refreshInterval: number;
}

interface DashboardStore {
  state: DashboardState;
  sseConnected: boolean;
  lastUpdate: string;
  refresh(): Promise<void>;
  refreshAll(): Promise<void>;
  toggleAutoRefresh(): void;
  setRefreshInterval(interval: number): void;
  triggerUpdate(type: string): void;
}

// Legacy interface for backward compatibility during migration
// TODO: Remove after migration complete
interface AlpineGlobalStores extends Alpine.Stores {}

// Extend Alpine.js official Stores interface with our custom stores
declare module 'alpinejs' {
  namespace Alpine {
    interface Stores {
      eventStream: EventStreamStore;
      notifications: NotificationStore;
      metrics: MetricsStore;
      tools: ToolStore;
      dashboard: DashboardStore;
      toolExecution: ToolExecutionStore;
      errorBoundary?: {
        errors: any[];
        addError: (error: any, component: string, method: string) => void;
        clearErrors: () => void;
      };
    }
  }
}

// Custom Alpine component type with proper store typing
type CustomAlpineComponent<T> = T & {
  $store: {
    eventStream: EventStreamStore;
    notifications: NotificationStore;
    metrics: MetricsStore;
    tools: ToolStore;
    dashboard: DashboardStore;
    toolExecution: ToolExecutionStore;
    errorBoundary?: {
      errors: any[];
      addError: (error: any, component: string, method: string) => void;
      clearErrors: () => void;
    };
  };
  $el: HTMLElement;
  $refs: { [key: string]: HTMLElement };
  $watch: <K extends keyof T | string>(property: K, callback: (newValue: any, oldValue: any) => void) => void;
  $dispatch: (event: string, detail?: any) => void;
  $nextTick: (callback?: () => void) => Promise<void>;
};

// Alpine.js Component Magic Properties for backwards compatibility
type AlpineComponentMagic<T = {}> = CustomAlpineComponent<T>;

// Performance Monitoring Types
interface MemoryUsageSnapshot {
  used: number;
  total: number;
  limit: number;
  timestamp: number;
}

interface NavigationTimingData {
  loadEventEnd: number;
  domContentLoadedEventEnd: number;
  domComplete: number;
}

interface PerformanceMetrics {
  bundleLoadTime: number;
  componentInitTimes: Record<string, number>;
  memoryUsage: MemoryUsageSnapshot[];
  renderTimes: Record<string, number>;
  eventHandlerTimes: Record<string, number[]>;
  startTime: number;
  navigationTiming?: NavigationTimingData;
  customMetrics?: Record<string, number>;
}

interface PerformanceReport {
  summary: {
    bundleLoadTime: number;
    totalComponents: number;
    memoryTrend: 'stable' | 'increasing' | 'decreasing';
    monitoringDuration: number;
  };
  components: Record<string, number>;
  memory: {
    samples: number;
    trend: 'stable' | 'increasing' | 'decreasing';
    current: MemoryUsageSnapshot;
    peak: MemoryUsageSnapshot;
  };
  recommendations: string[];
}

interface PerformanceObserver {
  observe(target: Element, options: MutationObserverInit): void;
  disconnect(): void;
}

// Export types for use in components
export {
  // Alpine.js types
  Alpine,
  AlpineComponentMagic,
  CustomAlpineComponent,
  
  // Store types
  AlpineStore,
  EventData,
  EventStreamStore,
  NotificationItem,
  NotificationStore,
  MetricsData,
  MetricsStore,
  ToolParameter,
  ToolResult,
  ToolStore,
  DashboardState,
  DashboardStore,
  AlpineGlobalStores, // Legacy - to be removed
  
  // Event and utility types
  SSEMessage,
  NotificationType,
  ErrorType,
  ErrorSeverity,
  ErrorDetails,
  
  // Performance monitoring types
  MemoryUsageSnapshot,
  NavigationTimingData,
  PerformanceMetrics,
  PerformanceReport,
  PerformanceObserver
};