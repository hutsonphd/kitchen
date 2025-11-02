import type { CalendarSource, CalendarEvent, FetchEventsOptions } from '../types';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';

/**
 * Make a request to the CalDAV proxy server
 */
async function proxyRequest<T>(endpoint: string, data: any): Promise<T> {
  try {
    const response = await fetch(`${PROXY_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Proxy request failed:', error);
    throw new Error(`Proxy request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch calendar events from a CalDAV source via proxy
 */
export async function fetchCalendarEvents(
  source: CalendarSource,
  options: FetchEventsOptions
): Promise<CalendarEvent[]> {
  try {
    // Only fetch from enabled calendars
    const enabledCalendars = source.calendars.filter(cal => cal.enabled);

    if (enabledCalendars.length === 0) {
      return [];
    }

    // Get calendar names for filtering on the backend
    const selectedCalendarNames = enabledCalendars.map(cal => cal.name);

    const response = await proxyRequest<{ events: any[] }>('/api/caldav/fetch-events', {
      url: source.url,
      username: source.username,
      password: source.password,
      timeMin: options.startDate.toISOString(),
      timeMax: options.endDate.toISOString(),
      selectedCalendars: selectedCalendarNames,
      sourceType: source.sourceType,
      requiresAuth: source.requiresAuth,
    });

    // Create a lookup map for calendar colors by URL
    const calendarColorMap = new Map(
      enabledCalendars.map(cal => [cal.calendarUrl, cal])
    );

    // Transform events from proxy to match CalendarEvent format
    const events: CalendarEvent[] = response.events.map((event: any) => {
      // Find the calendar this event belongs to
      const calendar = calendarColorMap.get(event.calendarUrl);
      const color = calendar?.color || source.calendars[0]?.color || '#3788d8';
      const calendarId = calendar?.id || source.id;

      return {
        id: event.id,
        title: event.title,
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: event.allDay || false,
        description: event.description || undefined,
        location: event.location || undefined,
        calendarId: calendarId,
        color: color,
        backgroundColor: color,
        borderColor: color,
        timezone: event.timezone || undefined,
        originalTimezone: event.originalTimezone || undefined,
      };
    });

    return events;
  } catch (error) {
    console.error(`Failed to fetch events from ${source.name}:`, error);
    throw error;
  }
}

/**
 * Test CalDAV connection with provided credentials via proxy
 * Returns the list of available calendars on success, or null on failure
 */
export async function testConnection(
  source: Omit<CalendarSource, 'id' | 'enabled' | 'calendars'>
): Promise<{ displayName: string; url: string }[] | null> {
  try {
    const response = await proxyRequest<{
      success: boolean;
      calendars: { displayName: string; url: string }[]
    }>('/api/caldav/test-connection', {
      url: source.url,
      username: source.username,
      password: source.password,
      sourceType: source.sourceType,
      requiresAuth: source.requiresAuth,
    });

    return response.success ? response.calendars : null;
  } catch (error) {
    console.error('Connection test failed:', error);
    return null;
  }
}
