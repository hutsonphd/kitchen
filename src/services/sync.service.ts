import type { CalendarSource, CalendarEvent, FetchEventsOptions } from '../types';
import type { SyncMetadata } from '../types/indexeddb.types';
import { fetchCalendarEvents } from './caldav.service';
import * as indexedDB from './indexeddb.service';

// Sync timing constants
export const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
export const INITIAL_SYNC_TIMEOUT = 60 * 1000; // 60 seconds for first load (increased to handle recurring events)
export const BACKGROUND_SYNC_TIMEOUT = 45 * 1000; // 45 seconds for background updates (increased to handle recurring events)

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
 * Sync events for a single source
 */
export async function syncSource(
  source: CalendarSource,
  dateRange: { startDate: Date; endDate: Date },
  timeout: number,
  fullSync: boolean = false
): Promise<{ events: CalendarEvent[]; error?: string }> {
  try {
    const events = await fetchWithTimeout(source, dateRange, timeout, fullSync);

    // Save to cache
    await indexedDB.saveEvents(events, source.id);

    // Get existing metadata to preserve sync token
    const existingMetadata = await indexedDB.getSyncMetadata(source.id);

    // Save sync metadata
    const metadata: SyncMetadata = {
      sourceId: source.id,
      lastSyncTime: new Date(),
      lastSyncSuccess: true,
      isFullSyncCompleted: fullSync || existingMetadata?.isFullSyncCompleted || false,
      eventCount: events.length,
      syncToken: existingMetadata?.syncToken, // Preserve existing sync token for now
    };
    await indexedDB.saveSyncMetadata(metadata);

    return { events };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Get existing metadata to preserve fields
    const existingMetadata = await indexedDB.getSyncMetadata(source.id);

    // Save error to metadata
    const metadata: SyncMetadata = {
      sourceId: source.id,
      lastSyncTime: new Date(),
      lastSyncSuccess: false,
      isFullSyncCompleted: existingMetadata?.isFullSyncCompleted || false,
      eventCount: 0,
      errorMessage,
      syncToken: existingMetadata?.syncToken,
    };
    await indexedDB.saveSyncMetadata(metadata);

    return { events: [], error: errorMessage };
  }
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
