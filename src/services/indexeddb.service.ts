import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CalendarEvent } from '../types';
import type { StoredCalendarEvent, SyncMetadata, CacheStatus } from '../types/indexeddb.types';

const DB_NAME = 'CalendarKioskDB';
const DB_VERSION = 2; // Updated for sync token support
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CalendarDB extends DBSchema {
  events: {
    key: string;
    value: StoredCalendarEvent;
    indexes: {
      'by-source': string;
      'by-calendar': string;
      'by-start': Date;
      'by-end': Date;
    };
  };
  syncMetadata: {
    key: string;
    value: SyncMetadata;
  };
}

let dbInstance: IDBPDatabase<CalendarDB> | null = null;

/**
 * Check if IndexedDB is available in the browser
 */
export function isIndexedDBAvailable(): boolean {
  try {
    return 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Initialize and get the database instance
 */
async function getDB(): Promise<IDBPDatabase<CalendarDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available in this browser');
  }

  try {
    dbInstance = await openDB<CalendarDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Create events store
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('by-source', 'sourceId');
          eventStore.createIndex('by-calendar', 'calendarId');
          eventStore.createIndex('by-start', 'start');
          eventStore.createIndex('by-end', 'end');
        } else if (oldVersion < 2) {
          // Upgrade from version 1: add new indexes
          const eventStore = transaction.objectStore('events');

          // Remove old index if it exists (using type assertion for legacy index name)
          const indexNames = eventStore.indexNames as DOMStringList;
          if (indexNames.contains('by-date')) {
            eventStore.deleteIndex('by-date' as any);
          }

          // Add new indexes
          if (!indexNames.contains('by-start')) {
            eventStore.createIndex('by-start', 'start');
          }
          if (!indexNames.contains('by-end')) {
            eventStore.createIndex('by-end', 'end');
          }
        }

        // Create sync metadata store
        if (!db.objectStoreNames.contains('syncMetadata')) {
          db.createObjectStore('syncMetadata', { keyPath: 'sourceId' });
        }
      },
    });

    return dbInstance;
  } catch (error) {
    console.error('Failed to open IndexedDB:', error);
    throw new Error('Failed to initialize database');
  }
}

/**
 * Save events to IndexedDB
 */
export async function saveEvents(events: CalendarEvent[], sourceId: string): Promise<void> {
  if (!isIndexedDBAvailable()) {
    console.warn('IndexedDB not available, skipping cache');
    return;
  }

  try {
    const db = await getDB();
    const syncTime = new Date();

    // Batch events in groups of 50 for better performance
    const BATCH_SIZE = 50;
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const tx = db.transaction('events', 'readwrite');
      const store = tx.objectStore('events');

      // Process batch
      const promises = batch.map(event => {
        const storedEvent: StoredCalendarEvent = {
          ...event,
          sourceId,
          syncTime,
        };
        return store.put(storedEvent);
      });

      await Promise.all(promises);
      await tx.done;
    }
  } catch (error) {
    console.error('Failed to save events to IndexedDB:', error);
    // Don't throw - cache failure shouldn't break the app
  }
}

/**
 * Load all events from IndexedDB
 */
export async function loadEvents(): Promise<CalendarEvent[]> {
  if (!isIndexedDBAvailable()) {
    return [];
  }

  try {
    const db = await getDB();
    const storedEvents = await db.getAll('events');

    // Convert StoredCalendarEvent back to CalendarEvent
    return storedEvents.map(({ sourceId, syncTime, ...event }) => event);
  } catch (error) {
    console.error('Failed to load events from IndexedDB:', error);
    return [];
  }
}

/**
 * Load events for a specific source
 */
export async function loadEventsBySource(sourceId: string): Promise<CalendarEvent[]> {
  if (!isIndexedDBAvailable()) {
    return [];
  }

  try {
    const db = await getDB();
    const index = db.transaction('events').store.index('by-source');
    const storedEvents = await index.getAll(sourceId);

    return storedEvents.map(({ sourceId, syncTime, ...event }) => event);
  } catch (error) {
    console.error('Failed to load events by source:', error);
    return [];
  }
}

/**
 * Clear all events for a specific source
 */
export async function clearEventsBySource(sourceId: string): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDB();
    const tx = db.transaction('events', 'readwrite');
    const store = tx.objectStore('events');
    const index = store.index('by-source');

    const keys = await index.getAllKeys(sourceId);
    await Promise.all(keys.map(key => store.delete(key)));
    await tx.done;
  } catch (error) {
    console.error('Failed to clear events by source:', error);
  }
}

/**
 * Clear all events from the cache
 */
export async function clearAllEvents(): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDB();
    await db.clear('events');
  } catch (error) {
    console.error('Failed to clear all events:', error);
  }
}

/**
 * Save sync metadata for a source
 */
export async function saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDB();
    await db.put('syncMetadata', metadata);
  } catch (error) {
    console.error('Failed to save sync metadata:', error);
  }
}

/**
 * Get sync metadata for a source
 */
export async function getSyncMetadata(sourceId: string): Promise<SyncMetadata | null> {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  try {
    const db = await getDB();
    const metadata = await db.get('syncMetadata', sourceId);
    return metadata || null;
  } catch (error) {
    console.error('Failed to get sync metadata:', error);
    return null;
  }
}

/**
 * Get all sync metadata
 */
export async function getAllSyncMetadata(): Promise<SyncMetadata[]> {
  if (!isIndexedDBAvailable()) {
    return [];
  }

  try {
    const db = await getDB();
    return await db.getAll('syncMetadata');
  } catch (error) {
    console.error('Failed to get all sync metadata:', error);
    return [];
  }
}

/**
 * Delete sync metadata for a source
 */
export async function deleteSyncMetadata(sourceId: string): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDB();
    await db.delete('syncMetadata', sourceId);
  } catch (error) {
    console.error('Failed to delete sync metadata:', error);
  }
}

/**
 * Get cache status
 */
export async function getCacheStatus(): Promise<CacheStatus> {
  if (!isIndexedDBAvailable()) {
    return {
      hasCache: false,
      lastSyncTime: null,
      eventCount: 0,
      isStale: true,
    };
  }

  try {
    const db = await getDB();
    const events = await db.getAll('events');
    const allMetadata = await db.getAll('syncMetadata');

    const eventCount = events.length;
    const hasCache = eventCount > 0;

    // Find the most recent sync time
    let lastSyncTime: Date | null = null;
    if (allMetadata.length > 0) {
      const timestamps = allMetadata.map(m => m.lastSyncTime.getTime());
      lastSyncTime = new Date(Math.max(...timestamps));
    }

    // Check if cache is stale
    const isStale = !lastSyncTime || (Date.now() - lastSyncTime.getTime()) > CACHE_MAX_AGE;

    return {
      hasCache,
      lastSyncTime,
      eventCount,
      isStale,
    };
  } catch (error) {
    console.error('Failed to get cache status:', error);
    return {
      hasCache: false,
      lastSyncTime: null,
      eventCount: 0,
      isStale: true,
    };
  }
}

/**
 * Clear the entire database (for debugging/reset)
 */
export async function clearDatabase(): Promise<void> {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await getDB();
    await db.clear('events');
    await db.clear('syncMetadata');
  } catch (error) {
    console.error('Failed to clear database:', error);
  }
}
