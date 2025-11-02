import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { CalendarSource, CalendarEvent, CalendarContextType } from '../types';
import type { UISettings } from '../types/settings.types';
import { storage } from '../utils/storage';
import * as syncService from '../services/sync.service';
import { clearAllEvents as clearEventsFromDB } from '../services/indexeddb.service';

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const CalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isCacheData, setIsCacheData] = useState(false);
  const [uiSettings, setUISettings] = useState<UISettings>(storage.loadUISettings());

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

  const removeSource = useCallback((id: string) => {
    setSources(prev => prev.filter(source => source.id !== id));
    setEvents(prev => prev.filter(event => event.calendarId !== id));
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
      // Calculate date range: current week (Sunday - Saturday)
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - currentDay);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const dateRange = { startDate: startOfWeek, endDate: endOfWeek };

      // Check cache status
      const cacheStatus = await syncService.getCacheInfo();
      const hasCache = cacheStatus.hasCache;

      // STRATEGY 1: No cache exists - Initial sync
      if (!hasCache) {
        setLoading(true);
        setIsCacheData(false);

        const { events: freshEvents, errors } = await syncService.syncAllSources(
          sources,
          dateRange,
          true // isInitialSync = true (30 second timeout)
        );

        setEvents(freshEvents);
        setLastSyncTime(new Date());
        setLoading(false);

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

      // STRATEGY 2: Has cache - Load immediately, then check if refresh needed
      const cachedEvents = await syncService.loadFromCache();
      setEvents(cachedEvents);
      setIsCacheData(true);
      setLastSyncTime(cacheStatus.lastSyncTime);

      // Determine if sync is needed
      const needsSync = await syncService.shouldSync(sources, forceRefresh);

      if (needsSync) {
        setLoading(true); // Show subtle "updating" indicator

        const { events: freshEvents, errors } = await syncService.syncAllSources(
          sources,
          dateRange,
          false // isInitialSync = false (15 second timeout)
        );

        setEvents(freshEvents);
        setLastSyncTime(new Date());
        setIsCacheData(false);
        setLoading(false);

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
    } catch (err) {
      console.error('Failed to reset everything:', err);
      setError('Failed to reset data');
    }
  }, []);

  const value: CalendarContextType = {
    sources,
    events,
    loading,
    error,
    lastSyncTime,
    isCacheData,
    uiSettings,
    addSource,
    updateSource,
    removeSource,
    updateCalendar,
    fetchAllEvents,
    updateUISettings,
    clearError,
    clearAllEvents: clearAllEventsHandler,
    resetEverything: resetEverythingHandler,
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
