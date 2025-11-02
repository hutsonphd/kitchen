import type { CalendarSource, CalendarEvent, FetchEventsOptions } from '../types';
import type { SyncMetadata } from '../types/indexeddb.types';
import { fetchCalendarEvents } from './caldav.service';
import * as indexedDB from './indexeddb.service';

// Sync timing constants
export const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
export const INITIAL_SYNC_TIMEOUT = 30 * 1000; // 30 seconds for first load
export const BACKGROUND_SYNC_TIMEOUT = 15 * 1000; // 15 seconds for background updates

/**
 * Check if a sync is needed for the given sources
 */
export async function shouldSync(sources: CalendarSource[], forceRefresh: boolean = false): Promise<boolean> {
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
  timeout: number
): Promise<CalendarEvent[]> {
  return Promise.race([
    fetchCalendarEvents(source, options),
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
  timeout: number
): Promise<{ events: CalendarEvent[]; error?: string }> {
  try {
    const events = await fetchWithTimeout(source, dateRange, timeout);

    // Save to cache
    await indexedDB.saveEvents(events, source.id);

    // Save sync metadata
    const metadata: SyncMetadata = {
      sourceId: source.id,
      lastSyncTime: new Date(),
      lastSyncSuccess: true,
      dateRangeStart: dateRange.startDate,
      dateRangeEnd: dateRange.endDate,
      eventCount: events.length,
    };
    await indexedDB.saveSyncMetadata(metadata);

    return { events };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Save error to metadata
    const metadata: SyncMetadata = {
      sourceId: source.id,
      lastSyncTime: new Date(),
      lastSyncSuccess: false,
      dateRangeStart: dateRange.startDate,
      dateRangeEnd: dateRange.endDate,
      eventCount: 0,
      errorMessage,
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
  isInitialSync: boolean = false
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
    enabledSources.map(source => syncSource(source, dateRange, timeout))
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
