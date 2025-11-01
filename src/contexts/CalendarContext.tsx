import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { CalendarSource, CalendarEvent, CalendarContextType } from '../types';
import { storage } from '../utils/storage';
import { fetchCalendarEvents } from '../services/caldav.service';

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const CalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchAllEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const enabledSources = sources.filter(s => s.enabled);

      if (enabledSources.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Calculate date range: current week (Sunday - Saturday)
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - currentDay);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Fetch events from all enabled sources
      const allEventsPromises = enabledSources.map(async (source) => {
        try {
          const sourceEvents = await fetchCalendarEvents(source, {
            startDate: startOfWeek,
            endDate: endOfWeek
          });

          // Update last fetched time
          setSources(prev => prev.map(s =>
            s.id === source.id
              ? { ...s, lastFetched: new Date(), fetchError: undefined }
              : s
          ));

          return sourceEvents;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';

          // Update source with error
          setSources(prev => prev.map(s =>
            s.id === source.id
              ? { ...s, fetchError: errorMsg }
              : s
          ));

          console.error(`Failed to fetch events from ${source.name}:`, err);
          return [];
        }
      });

      const eventsArrays = await Promise.all(allEventsPromises);
      const allEvents = eventsArrays.flat();

      setEvents(allEvents);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(errorMsg);
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }, [sources]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: CalendarContextType = {
    sources,
    events,
    loading,
    error,
    addSource,
    updateSource,
    removeSource,
    fetchAllEvents,
    clearError
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
