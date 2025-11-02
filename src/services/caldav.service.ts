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
    const response = await proxyRequest<{ events: any[] }>('/api/caldav/fetch-events', {
      url: source.url,
      username: source.username,
      password: source.password,
      timeMin: options.startDate.toISOString(),
      timeMax: options.endDate.toISOString(),
      selectedCalendars: source.selectedCalendars,
    });

    // Transform events from proxy to match CalendarEvent format
    const events: CalendarEvent[] = response.events.map((event: any) => ({
      id: event.id,
      title: event.title,
      start: new Date(event.start),
      end: new Date(event.end),
      allDay: event.allDay || false,
      description: event.description || undefined,
      location: event.location || undefined,
      calendarId: source.id,
      color: source.color,
      backgroundColor: source.color,
      borderColor: source.color,
    }));

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
  source: Omit<CalendarSource, 'id' | 'enabled' | 'color'>
): Promise<{ displayName: string; url: string }[] | null> {
  try {
    const response = await proxyRequest<{
      success: boolean;
      calendars: { displayName: string; url: string }[]
    }>('/api/caldav/test-connection', {
      url: source.url,
      username: source.username,
      password: source.password,
    });

    return response.success ? response.calendars : null;
  } catch (error) {
    console.error('Connection test failed:', error);
    return null;
  }
}
