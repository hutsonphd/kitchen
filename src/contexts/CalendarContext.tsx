import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { CalendarSource, CalendarEvent, CalendarContextType } from '../types';
import type { UISettings } from '../types/settings.types';
import type { SyncMetadata } from '../types/indexeddb.types';
import { storage } from '../utils/storage';
import * as syncService from '../services/sync.service';
import { clearAllEvents as clearEventsFromDB, clearEventsBySource, deleteSyncMetadata } from '../services/indexeddb.service';

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const CalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isCacheData, setIsCacheData] = useState(false);
  const [uiSettings, setUISettings] = useState<UISettings>(storage.loadUISettings());
  const [syncMetadata, setSyncMetadata] = useState<SyncMetadata[]>([]);

  // Load calendar sources from localStorage on mount
  useEffect(() => {
    const loadedSources = storage.loadSources();
    setSources(loadedSources);
  }, []);

  // Save sources to localStorage whenever they change
  useEffect(() => {
    if (sources.length > 0) {
      storage.saveSources(sources);
    }
  }, [sources]);

  // Save UI settings to localStorage whenever they change
  useEffect(() => {
    storage.saveUISettings(uiSettings);
  }, [uiSettings]);

  const addSource = useCallback((source: Omit<CalendarSource, 'id'>) => {
    const newSource: CalendarSource = {
      ...source,
      id: crypto.randomUUID(),
    };
    setSources(prev => [...prev, newSource]);
  }, []);

  const updateSource = useCallback((id: string, updates: Partial<CalendarSource>) => {
    setSources(prev => prev.map(source =>
      source.id === id ? { ...source, ...updates } : source
    ));
  }, []);

  const removeSource = useCallback(async (id: string) => {
    // Remove from state
    setSources(prev => prev.filter(source => source.id !== id));
    setEvents(prev => prev.filter(event => event.calendarId !== id));

    // Clean up IndexedDB - remove events and sync metadata
    try {
      await clearEventsBySource(id);
      await deleteSyncMetadata(id);
    } catch (err) {
      console.error('Failed to clean up IndexedDB for source:', id, err);
    }
  }, []);

  const updateCalendar = useCallback((sourceId: string, calendarId: string, updates: Partial<CalendarSource['calendars'][0]>) => {
    setSources(prev => prev.map(source => {
      if (source.id === sourceId) {
        return {
          ...source,
          calendars: source.calendars.map(cal =>
            cal.id === calendarId ? { ...cal, ...updates } : cal
          )
        };
      }
      return source;
    }));
  }, []);

  const fetchAllEvents = useCallback(async (forceRefresh: boolean = false) => {
    setError(null);

    try {
      // Dummy date range for API compatibility (not used in fullSync mode)
      // For incremental sync, we'll use a wide range (1 year back, 1 year forward)
      const now = new Date();
      const startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      const endDate = new Date(now);
      endDate.setFullYear(now.getFullYear() + 1);
      const dateRange = { startDate, endDate };

      // Check cache status
      const cacheStatus = await syncService.getCacheInfo();
      const hasCache = cacheStatus.hasCache;

      // Check if full sync has been completed for all sources
      const allMetadata = await syncService.getAllSyncMetadata();
      setSyncMetadata(allMetadata); // Update sync metadata state

      const needsFullSync = !hasCache || sources.some(source => {
        const meta = allMetadata.find(m => m.sourceId === source.id);
        return !meta || !meta.isFullSyncCompleted;
      });

      // STRATEGY 1: No cache OR full sync not completed - Initial full sync
      if (!hasCache || needsFullSync) {
        setLoading(true);
        setIsCacheData(false);

        const { events: freshEvents, errors } = await syncService.syncAllSources(
          sources,
          dateRange,
          true, // isInitialSync = true (60 second timeout)
          true  // fullSync = true (fetch all events)
        );

        setEvents(freshEvents);
        setLastSyncTime(new Date());
        setLoading(false);

        // Update sync metadata after sync
        const updatedMetadata = await syncService.getAllSyncMetadata();
        setSyncMetadata(updatedMetadata);

        // Update source metadata
        setSources(prev => prev.map(s => ({
          ...s,
          lastFetched: new Date(),
          fetchError: undefined
        })));

        if (errors.length > 0) {
          setError(errors.join(', '));
        }

        return;
      }

      // STRATEGY 2: Has cache and full sync completed - Load immediately, then check if refresh needed
      const cachedEvents = await syncService.loadFromCache();
      setEvents(cachedEvents);
      setIsCacheData(true);
      setLastSyncTime(cacheStatus.lastSyncTime);

      // Determine if sync is needed
      const needsSync = await syncService.shouldSync(sources, forceRefresh);

      if (needsSync) {
        setLoading(true); // Show subtle "updating" indicator

        // For incremental sync, use fullSync to get any new events
        // In the future, this could use CalDAV sync-token for true incremental sync
        const { events: freshEvents, errors } = await syncService.syncAllSources(
          sources,
          dateRange,
          false, // isInitialSync = false (45 second timeout)
          true   // fullSync = true (for now, always fetch all events)
        );

        setEvents(freshEvents);
        setLastSyncTime(new Date());
        setIsCacheData(false);
        setLoading(false);

        // Update sync metadata after sync
        const updatedMetadata = await syncService.getAllSyncMetadata();
        setSyncMetadata(updatedMetadata);

        // Update source metadata
        setSources(prev => prev.map(s => ({
          ...s,
          lastFetched: new Date(),
          fetchError: undefined
        })));

        if (errors.length > 0) {
          setError(errors.join(', '));
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(errorMsg);
      console.error('Error fetching events:', err);
      setLoading(false);
    }
  }, [sources]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateUISettings = useCallback((settings: UISettings) => {
    setUISettings(settings);
  }, []);

  const clearAllEventsHandler = useCallback(async () => {
    try {
      await clearEventsFromDB();
      setEvents([]);
      setLastSyncTime(null);
      setIsCacheData(false);
    } catch (err) {
      console.error('Failed to clear all events:', err);
      setError('Failed to clear events');
    }
  }, []);

  const resetEverythingHandler = useCallback(async () => {
    try {
      await clearEventsFromDB();
      storage.clearSources();
      setSources([]);
      setEvents([]);
      setLastSyncTime(null);
      setIsCacheData(false);
      setSyncMetadata([]);
    } catch (err) {
      console.error('Failed to reset everything:', err);
      setError('Failed to reset data');
    }
  }, []);

  const resetRetryHandler = useCallback(async (sourceId: string) => {
    try {
      await syncService.resetRetryCounter(sourceId);
      // Update sync metadata state
      const updatedMetadata = await syncService.getAllSyncMetadata();
      setSyncMetadata(updatedMetadata);
      // Trigger a sync attempt
      await fetchAllEvents(true);
    } catch (err) {
      console.error('Failed to reset retry counter:', err);
      setError('Failed to reset retry counter');
    }
  }, [fetchAllEvents]);

  const value: CalendarContextType = {
    sources,
    events,
    loading,
    error,
    lastSyncTime,
    isCacheData,
    uiSettings,
    syncMetadata,
    addSource,
    updateSource,
    removeSource,
    updateCalendar,
    fetchAllEvents,
    updateUISettings,
    clearError,
    clearAllEvents: clearAllEventsHandler,
    resetEverything: resetEverythingHandler,
    resetRetry: resetRetryHandler,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = (): CalendarContextType => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendar must be used within CalendarProvider');
  }
  return context;
};
