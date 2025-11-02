export interface Calendar {
  id: string;
  name: string; // User-defined or from CalDAV
  calendarUrl: string; // Individual calendar URL from CalDAV
  color: string;
  enabled: boolean;
  sourceId: string; // Reference to parent CalendarSource
}

export interface CalendarSource {
  id: string;
  name: string; // Source/account name
  url: string; // CalDAV server URL
  username: string;
  password: string;
  enabled: boolean;
  calendars: Calendar[]; // Individual calendars from this source
  lastFetched?: Date;
  fetchError?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  description?: string;
  location?: string;
  calendarId: string;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
}

export interface CalendarContextType {
  sources: CalendarSource[];
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  lastSyncTime: Date | null;
  isCacheData: boolean;
  addSource: (source: Omit<CalendarSource, 'id'>) => void;
  updateSource: (id: string, source: Partial<CalendarSource>) => void;
  removeSource: (id: string) => void;
  updateCalendar: (sourceId: string, calendarId: string, updates: Partial<Calendar>) => void;
  fetchAllEvents: (forceRefresh?: boolean) => Promise<void>;
  clearError: () => void;
}

export interface CalDAVCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface FetchEventsOptions {
  startDate: Date;
  endDate: Date;
}

export type ViewMode = 'kiosk' | 'admin';
