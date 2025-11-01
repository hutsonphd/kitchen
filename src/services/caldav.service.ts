import { createDAVClient } from 'tsdav';
import type { DAVClient } from 'tsdav';
import ICAL from 'ical.js';
import type { CalendarSource, CalendarEvent, FetchEventsOptions } from '../types';

/**
 * Create a DAV client with authentication
 */
async function createAuthenticatedClient(source: CalendarSource): Promise<DAVClient> {
  try {
    const client = await createDAVClient({
      serverUrl: source.url,
      credentials: {
        username: source.username,
        password: source.password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    return client;
  } catch (error) {
    console.error('Failed to create DAV client:', error);
    throw new Error(`Failed to connect to ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse iCalendar data and convert to CalendarEvent objects
 */
function parseICalendarData(
  icalData: string,
  calendarId: string,
  color: string,
  startDate: Date,
  endDate: Date
): CalendarEvent[] {
  try {
    const jcalData = ICAL.parse(icalData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events: CalendarEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      // Get event times
      const eventStart = event.startDate.toJSDate();
      const eventEnd = event.endDate.toJSDate();

      // Filter events within date range
      if (eventEnd < startDate || eventStart > endDate) {
        continue;
      }

      // Handle recurring events
      if (event.isRecurring()) {
        const expand = event.iterator();
        let next;

        while ((next = expand.next())) {
          const occurrenceStart = next.toJSDate();
          const duration = eventEnd.getTime() - eventStart.getTime();
          const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

          // Only include occurrences within our date range
          if (occurrenceStart >= startDate && occurrenceStart <= endDate) {
            events.push({
              id: `${event.uid}-${occurrenceStart.getTime()}`,
              title: event.summary || 'Untitled Event',
              start: occurrenceStart,
              end: occurrenceEnd,
              allDay: !event.startDate.isDate ? false : true,
              description: event.description || undefined,
              location: event.location || undefined,
              calendarId,
              color,
              backgroundColor: color,
              borderColor: color,
            });
          }

          // Stop after reasonable number of occurrences to prevent infinite loops
          if (occurrenceStart > endDate) break;
        }
      } else {
        // Non-recurring event
        events.push({
          id: event.uid,
          title: event.summary || 'Untitled Event',
          start: eventStart,
          end: eventEnd,
          allDay: !event.startDate.isDate ? false : true,
          description: event.description || undefined,
          location: event.location || undefined,
          calendarId,
          color,
          backgroundColor: color,
          borderColor: color,
        });
      }
    }

    return events;
  } catch (error) {
    console.error('Failed to parse iCalendar data:', error);
    throw new Error('Failed to parse calendar data');
  }
}

/**
 * Fetch calendar events from a CalDAV source
 */
export async function fetchCalendarEvents(
  source: CalendarSource,
  options: FetchEventsOptions
): Promise<CalendarEvent[]> {
  try {
    const client = await createAuthenticatedClient(source);

    // Fetch calendars
    const calendars = await client.fetchCalendars();

    if (!calendars || calendars.length === 0) {
      console.warn(`No calendars found for ${source.name}`);
      return [];
    }

    // Fetch calendar objects (events) from all calendars
    const allEvents: CalendarEvent[] = [];

    for (const calendar of calendars) {
      try {
        const calendarObjects = await client.fetchCalendarObjects({
          calendar: calendar,
          timeRange: {
            start: options.startDate.toISOString(),
            end: options.endDate.toISOString(),
          },
        });

        // Parse each calendar object
        for (const obj of calendarObjects) {
          if (obj.data) {
            const events = parseICalendarData(
              obj.data,
              source.id,
              source.color,
              options.startDate,
              options.endDate
            );
            allEvents.push(...events);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch objects from calendar ${calendar.displayName}:`, error);
        // Continue with other calendars even if one fails
      }
    }

    return allEvents;
  } catch (error) {
    console.error(`Failed to fetch events from ${source.name}:`, error);
    throw error;
  }
}

/**
 * Test CalDAV connection with provided credentials
 */
export async function testConnection(source: Omit<CalendarSource, 'id' | 'enabled' | 'color'>): Promise<boolean> {
  try {
    const testSource: CalendarSource = {
      ...source,
      id: 'test',
      enabled: true,
      color: '#000000'
    };

    const client = await createAuthenticatedClient(testSource);
    const calendars = await client.fetchCalendars();

    return calendars && calendars.length > 0;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}
