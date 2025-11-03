import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { CalendarSource, CalendarEvent, CalendarContextType } from '../types';
import type { UISettings } from '../types/settings.types';
import type { SyncMetadata } from '../types/indexeddb.types';
import { storage } from '../utils/storage';
import * as api from '../services/api.service';
import { getAvailableImages, isImageValid, type SlideshowImage } from '../services/staticImages.service';

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
  const [slideshowActive, setSlideshowActive] = useState(false);
  const [slideshowImages, setSlideshowImages] = useState<SlideshowImage[]>([]);

  // Use ref to track sources without triggering fetchAllEvents re-creation
  const sourcesRef = useRef<CalendarSource[]>([]);

  // AbortController for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update sourcesRef whenever sources change
  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  // Load calendar sources from backend on mount
  useEffect(() => {
    const loadSources = async () => {
      try {
        const loadedSources = await api.fetchSources();
        setSources(loadedSources);
      } catch (err) {
        console.error('Failed to load sources from backend:', err);
        setError('Failed to load calendar sources');
      }
    };
    loadSources();
  }, []);

  // Debounced save UI settings to localStorage (keep this client-side)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      storage.saveUISettings(uiSettings);
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [uiSettings]);

  // Load slideshow images on mount
  useEffect(() => {
    const loadImages = async () => {
      try {
        const images = await getAvailableImages();
        // Only include valid images for slideshow display
        const validImages = images.filter(isImageValid);
        setSlideshowImages(validImages);
      } catch (err) {
        console.error('Failed to load slideshow images:', err);
      }
    };
    loadImages();
  }, []);

  const addSource = useCallback(async (source: Omit<CalendarSource, 'id'>) => {
    try {
      console.log('[CalendarContext] Adding new source:', source.name);
      const newSource = await api.createSource(source);
      setSources(prev => [...prev, newSource]);
      console.log('[CalendarContext] Source created with ID:', newSource.id);

      // Trigger sync for the new source
      console.log('[CalendarContext] Triggering sync for source:', newSource.id);
      setLoading(true);
      const syncResult = await api.triggerSync(newSource.id);
      console.log('[CalendarContext] Sync completed:', syncResult);

      // Wait a moment for sync to complete before fetching events
      console.log('[CalendarContext] Waiting for sync to settle...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh events
      console.log('[CalendarContext] Fetching events after sync...');
      await fetchAllEvents(true);
      console.log('[CalendarContext] Events fetched successfully');
      setLoading(false);
    } catch (err) {
      console.error('[CalendarContext] Failed to add source:', err);
      setLoading(false);
      // Extract error message from API response if available
      const errorMessage = err instanceof Error
        ? err.message
        : 'Failed to add calendar source';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const updateSource = useCallback(async (id: string, updates: Partial<CalendarSource>) => {
    try {
      const updatedSource = await api.updateSource(id, updates);
      setSources(prev => prev.map(source =>
        source.id === id ? updatedSource : source
      ));

      // Trigger sync for the updated source
      await api.triggerSync(id);

      // Refresh events
      await fetchAllEvents(true);
    } catch (err) {
      console.error('Failed to update source:', err);
      setError('Failed to update calendar source');
      throw err;
    }
  }, []);

  const removeSource = useCallback(async (id: string) => {
    try {
      await api.deleteSource(id);

      // Remove from state
      setSources(prev => prev.filter(source => source.id !== id));
      setEvents(prev => prev.filter(event => event.calendarId !== id));
    } catch (err) {
      console.error('Failed to remove source:', err);
      setError('Failed to remove calendar source');
      throw err;
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
    console.log('[CalendarContext] fetchAllEvents called, forceRefresh:', forceRefresh);
    setError(null);

    // Cancel any previous in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);

      // Memory optimized date range: 1 month back, 3 months forward
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      const endDate = new Date(now);
      endDate.setMonth(now.getMonth() + 3);
      console.log('[CalendarContext] Date range:', startDate.toISOString(), 'to', endDate.toISOString());

      // Trigger manual sync if forced
      if (forceRefresh) {
        console.log('[CalendarContext] Force refresh - triggering sync');
        await api.triggerSync();
      }

      // Fetch events from backend
      console.log('[CalendarContext] Fetching events from API...');
      const fetchedEvents = await api.fetchEvents({
        start: startDate.toISOString(),
        end: endDate.toISOString()
      });
      console.log('[CalendarContext] Received', fetchedEvents.length, 'events from API');

      // Deduplicate events by ID (same event from multiple sources)
      const uniqueEvents = Array.from(
        new Map(
          fetchedEvents.map(event => [event.id, event])
        ).values()
      );
      console.log('[CalendarContext] After deduplication:', uniqueEvents.length, 'unique events');

      setEvents(uniqueEvents);
      setLastSyncTime(new Date());
      setIsCacheData(false);
      setLoading(false);

      // Fetch sync metadata
      try {
        console.log('[CalendarContext] Fetching sync metadata...');
        const metadata = await api.getSyncStatus();
        console.log('[CalendarContext] Sync metadata:', metadata);
        setSyncMetadata(Array.isArray(metadata) ? metadata : [metadata]);
      } catch (metaErr) {
        console.error('[CalendarContext] Failed to fetch sync metadata:', metaErr);
      }

      // Update source metadata
      setSources(prev => prev.map(s => ({
        ...s,
        lastFetched: new Date(),
        fetchError: undefined
      })));
    } catch (err) {
      // Don't set error if request was cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[CalendarContext] Fetch cancelled');
        return;
      }

      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(errorMsg);
      console.error('Error fetching events:', err);
      setLoading(false);
    } finally {
      // Clear abort controller reference if it's the current one
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, []); // Empty dependencies - uses sourcesRef.current to avoid re-creation

  // Cancel any in-flight requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateUISettings = useCallback((settings: UISettings) => {
    setUISettings(settings);
  }, []);

  const clearAllEventsHandler = useCallback(async () => {
    try {
      // Backend will handle clearing events
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
      // Delete all sources from backend
      for (const source of sourcesRef.current) {
        await api.deleteSource(source.id);
      }

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
      await api.resetRetryCount(sourceId);

      // Update sync metadata state
      const metadata = await api.getSyncStatus();
      setSyncMetadata(Array.isArray(metadata) ? metadata : [metadata]);

      // Trigger a sync attempt
      await fetchAllEvents(true);
    } catch (err) {
      console.error('Failed to reset retry counter:', err);
      setError('Failed to reset retry counter');
    }
  }, [fetchAllEvents]);

  const startSlideshow = useCallback(() => {
    if (slideshowImages.length > 0 && uiSettings.slideshowEnabled) {
      setSlideshowActive(true);
    }
  }, [slideshowImages.length, uiSettings.slideshowEnabled]);

  const stopSlideshow = useCallback(() => {
    setSlideshowActive(false);
  }, []);

  const refreshSlideshowImages = useCallback(async () => {
    try {
      const images = await getAvailableImages();
      setSlideshowImages(images);
    } catch (err) {
      console.error('Failed to refresh slideshow images:', err);
      setError('Failed to refresh slideshow images');
    }
  }, [setError]);

  // Memoize context value to prevent unnecessary re-renders of all consumers
  const value: CalendarContextType = useMemo(() => ({
    sources,
    events,
    loading,
    error,
    lastSyncTime,
    isCacheData,
    uiSettings,
    syncMetadata,
    slideshowActive,
    slideshowImages,
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
    startSlideshow,
    stopSlideshow,
    refreshSlideshowImages,
  }), [
    sources,
    events,
    loading,
    error,
    lastSyncTime,
    isCacheData,
    uiSettings,
    syncMetadata,
    slideshowActive,
    slideshowImages,
    addSource,
    updateSource,
    removeSource,
    updateCalendar,
    fetchAllEvents,
    updateUISettings,
    clearError,
    clearAllEventsHandler,
    resetEverythingHandler,
    resetRetryHandler,
    startSlideshow,
    stopSlideshow,
    refreshSlideshowImages,
  ]);

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
