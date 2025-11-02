export interface CalendarSource {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  color: string;
  enabled: boolean;
  selectedCalendars?: string[]; // Array of calendar display names to fetch
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
  addSource: (source: Omit<CalendarSource, 'id'>) => void;
  updateSource: (id: string, source: Partial<CalendarSource>) => void;
  removeSource: (id: string) => void;
  fetchAllEvents: () => Promise<void>;
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
