import type { CalendarEvent } from './calendar.types';

/**
 * Extended calendar event stored in IndexedDB
 */
export interface StoredCalendarEvent extends CalendarEvent {
  sourceId: string; // Reference to the source that provided this event
  syncTime: Date; // When this event was last synced
}

/**
 * Sync metadata for each calendar source
 */
export interface SyncMetadata {
  sourceId: string;
  lastSyncTime: Date;
  lastSyncSuccess: boolean;
  syncToken?: string; // CalDAV sync-token for incremental sync
  isFullSyncCompleted: boolean; // Whether initial full sync has completed
  eventCount: number;
  errorMessage?: string;
  retryCount: number; // Number of consecutive failed sync attempts
  maxRetries: number; // Maximum retry attempts before stopping (default: 3)
  nextRetryTime?: Date; // When the next retry should occur (exponential backoff)
}

/**
 * Cache status information
 */
export interface CacheStatus {
  hasCache: boolean;
  lastSyncTime: Date | null;
  eventCount: number;
  isStale: boolean; // True if cache is older than CACHE_MAX_AGE
}

/**
 * Options for fetching events with cache
 */
export interface FetchWithCacheOptions {
  forceRefresh?: boolean;
  timeout?: number;
}

