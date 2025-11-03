import type { CalendarSource, CalendarEvent, FetchEventsOptions } from '../types';
import type { SyncMetadata } from '../types/indexeddb.types';
import { fetchCalendarEvents } from './caldav.service';
import * as indexedDB from './indexeddb.service';

// Sync timing constants
export const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
export const INITIAL_SYNC_TIMEOUT = 60 * 1000; // 60 seconds for first load (increased to handle recurring events)
export const BACKGROUND_SYNC_TIMEOUT = 45 * 1000; // 45 seconds for background updates (increased to handle recurring events)

// Retry configuration
export const MAX_RETRIES = 3; // Maximum number of retry attempts before stopping
export const RETRY_DELAYS = [1 * 60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000]; // 1min, 5min, 15min exponential backoff

// Sync lock management
interface SyncLock {
  promise: Promise<{ events: CalendarEvent[]; error?: string }>;
  timestamp: number;
}

const syncLocks = new Map<string, SyncLock>();
const LOCK_TIMEOUT = 30000; // 30 seconds - reduced from 2min for faster cleanup and less memory

/**
 * Clean up stale sync locks to prevent memory leaks
 */
function cleanupStaleLocks(): void {
  const now = Date.now();
  const staleLocks: string[] = [];

  for (const [sourceId, lock] of syncLocks.entries()) {
    if (now - lock.timestamp > LOCK_TIMEOUT) {
      staleLocks.push(sourceId);
    }
  }

  staleLocks.forEach(sourceId => {
    console.warn(`Cleaning up stale sync lock for ${sourceId}`);
    syncLocks.delete(sourceId);
  });
}

// Periodic cleanup of stale locks every 30 seconds
setInterval(cleanupStaleLocks, LOCK_TIMEOUT);

/**
 * Check if a source should be retried based on retry metadata
 */
export function shouldRetry(metadata: SyncMetadata | null): boolean {
  if (!metadata) {
    return true; // No metadata means we should try
  }

  // If last sync was successful, no need to retry
  if (metadata.lastSyncSuccess) {
    return false;
  }

  // If we've exceeded max retries, don't retry
  if (metadata.retryCount >= metadata.maxRetries) {
    return false;
  }

  // Check if enough time has passed for next retry
  if (metadata.nextRetryTime) {
    return Date.now() >= metadata.nextRetryTime.getTime();
  }

  return true; // Should retry if no nextRetryTime set
}

/**
 * Calculate the next retry time using exponential backoff
 */
export function calculateNextRetryTime(retryCount: number): Date {
  const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
  return new Date(Date.now() + delay);
}

/**
 * Check if a sync is needed for the given sources
 */
export async function shouldSync(_sources: CalendarSource[], forceRefresh: boolean = false): Promise<boolean> {
  if (forceRefresh) {
    return true;
  }

  if (!indexedDB.isIndexedDBAvailable()) {
    return true; // Always sync if no cache available
  }

  const cacheStatus = await indexedDB.getCacheStatus();

  // No cache exists - need to sync
  if (!cacheStatus.hasCache) {
    return true;
  }

  // Cache exists but is stale - need to sync
  if (cacheStatus.isStale) {
    return true;
  }

  return false;
}

/**
 * Fetch events from network with timeout
 */
async function fetchWithTimeout(
  source: CalendarSource,
  options: FetchEventsOptions,
  timeout: number,
  fullSync: boolean = false
): Promise<CalendarEvent[]> {
  return Promise.race([
    fetchCalendarEvents(source, options, fullSync),
    new Promise<CalendarEvent[]>((_, reject) =>
      setTimeout(() => reject(new Error('Fetch timeout')), timeout)
    ),
  ]);
}

/**
 * Acquire sync lock for a source, or return existing sync if one is in progress
 */
function acquireSyncLock(
  sourceId: string,
  syncPromise: Promise<{ events: CalendarEvent[]; error?: string }>
): Promise<{ events: CalendarEvent[]; error?: string }> {
  // Check for existing lock
  const existingLock = syncLocks.get(sourceId);

  if (existingLock) {
    // Check if lock is stale (older than timeout)
    const lockAge = Date.now() - existingLock.timestamp;
    if (lockAge < LOCK_TIMEOUT) {
      console.log(`Sync already in progress for source ${sourceId}, returning existing sync`);
      return existingLock.promise;
    } else {
      // Lock is stale, remove it
      console.warn(`Stale sync lock detected for source ${sourceId}, removing`);
      syncLocks.delete(sourceId);
    }
  }

  // Create new lock
  const lock: SyncLock = {
    promise: syncPromise,
    timestamp: Date.now(),
  };

  syncLocks.set(sourceId, lock);

  // Remove lock when sync completes (success or failure)
  lock.promise.finally(() => {
    syncLocks.delete(sourceId);
  });

  return lock.promise;
}

/**
 * Sync events for a single source
 */
export async function syncSource(
  source: CalendarSource,
  dateRange: { startDate: Date; endDate: Date },
  timeout: number,
  fullSync: boolean = false
): Promise<{ events: CalendarEvent[]; error?: string }> {
  // Create the actual sync operation
  const syncOperation = async (): Promise<{ events: CalendarEvent[]; error?: string }> => {
    // Get existing metadata to check retry status
    const existingMetadata = await indexedDB.getSyncMetadata(source.id);

    // Check if we should skip this sync due to retry limits
    if (existingMetadata && !shouldRetry(existingMetadata)) {
      // Return cached events if available, or empty array
      const cachedEvents = await indexedDB.loadEventsBySource(source.id);
      return {
        events: cachedEvents,
        error: existingMetadata.errorMessage || 'Sync failed - retry limit exceeded'
      };
    }

    try {
    const events = await fetchWithTimeout(source, dateRange, timeout, fullSync);

    // Save to cache
    await indexedDB.saveEvents(events, source.id);

    // Save sync metadata - success, reset retry count
    const metadata: SyncMetadata = {
      sourceId: source.id,
      lastSyncTime: new Date(),
      lastSyncSuccess: true,
      isFullSyncCompleted: fullSync || existingMetadata?.isFullSyncCompleted || false,
      eventCount: events.length,
      syncToken: existingMetadata?.syncToken,
      retryCount: 0, // Reset retry count on success
      maxRetries: MAX_RETRIES,
      nextRetryTime: undefined, // Clear next retry time
    };
    await indexedDB.saveSyncMetadata(metadata);

    return { events };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Increment retry count
    const currentRetryCount = existingMetadata?.retryCount || 0;
    const newRetryCount = currentRetryCount + 1;

    // Calculate next retry time using exponential backoff
    const nextRetryTime = newRetryCount < MAX_RETRIES
      ? calculateNextRetryTime(newRetryCount)
      : undefined;

    // Save error to metadata with retry info
    const metadata: SyncMetadata = {
      sourceId: source.id,
      lastSyncTime: new Date(),
      lastSyncSuccess: false,
      isFullSyncCompleted: existingMetadata?.isFullSyncCompleted || false,
      eventCount: existingMetadata?.eventCount || 0,
      errorMessage,
      syncToken: existingMetadata?.syncToken,
      retryCount: newRetryCount,
      maxRetries: MAX_RETRIES,
      nextRetryTime,
    };
    await indexedDB.saveSyncMetadata(metadata);

    // Return cached events if available
    const cachedEvents = await indexedDB.loadEventsBySource(source.id);
    return { events: cachedEvents, error: errorMessage };
    }
  };

  // Acquire lock and perform sync
  return acquireSyncLock(source.id, syncOperation());
}

/**
 * Sync events from all enabled sources
 */
export async function syncAllSources(
  sources: CalendarSource[],
  dateRange: { startDate: Date; endDate: Date },
  isInitialSync: boolean = false,
  fullSync: boolean = false
): Promise<{ events: CalendarEvent[]; errors: string[] }> {
  // Filter to enabled sources with at least one enabled calendar
  const enabledSources = sources.filter(s =>
    s.enabled && s.calendars.some(cal => cal.enabled)
  );

  if (enabledSources.length === 0) {
    return { events: [], errors: [] };
  }

  // Use appropriate timeout based on sync type
  const timeout = isInitialSync ? INITIAL_SYNC_TIMEOUT : BACKGROUND_SYNC_TIMEOUT;

  // Sync all sources in parallel
  const results = await Promise.all(
    enabledSources.map(source => syncSource(source, dateRange, timeout, fullSync))
  );

  // Collect events and errors
  const allEvents = results.flatMap(r => r.events);
  const errors = results
    .filter(r => r.error)
    .map(r => r.error!);

  return { events: allEvents, errors };
}

/**
 * Load events from cache
 */
export async function loadFromCache(): Promise<CalendarEvent[]> {
  if (!indexedDB.isIndexedDBAvailable()) {
    return [];
  }

  return await indexedDB.loadEvents();
}

/**
 * Get the current cache status
 */
export async function getCacheInfo() {
  return await indexedDB.getCacheStatus();
}

/**
 * Get all sync metadata
 */
export async function getAllSyncMetadata() {
  return await indexedDB.getAllSyncMetadata();
}

/**
 * Clear cache for a specific source
 */
export async function clearSourceCache(sourceId: string): Promise<void> {
  await indexedDB.clearEventsBySource(sourceId);
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  await indexedDB.clearAllEvents();
}

/**
 * Reset retry counter for a source (allows manual retry after max retries exceeded)
 */
export async function resetRetryCounter(sourceId: string): Promise<void> {
  const metadata = await indexedDB.getSyncMetadata(sourceId);
  if (metadata) {
    metadata.retryCount = 0;
    metadata.nextRetryTime = undefined;
    await indexedDB.saveSyncMetadata(metadata);
  }
}
