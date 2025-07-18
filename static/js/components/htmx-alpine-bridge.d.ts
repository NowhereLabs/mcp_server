// Type declarations for htmx-alpine-bridge.js

export declare function initializeHtmxAlpineBridge(): void;

// Types are handled by globals.d.ts

export interface DashboardStore {
  sseConnected: boolean;
  lastUpdate: string | null;
  
  setSSEConnected(connected: boolean): void;
  triggerUpdate(endpoint: string): void;
  refreshAll(): void;
}

export interface StatusStore {
  data: Record<string, any>;
  loading: boolean;
  
  update(newData: Record<string, any>): void;
  setLoading(state: boolean): void;
}

export interface ToolCallsStore {
  data: any[];
  loading: boolean;
  
  update(newData: any[]): void;
  setLoading(state: boolean): void;
}