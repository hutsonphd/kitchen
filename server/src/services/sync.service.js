/**
 * Backend sync service for automatic calendar synchronization
 */

import { createDAVClient } from 'tsdav';
import ICAL from 'ical.js';
import fetch from 'node-fetch';
import { getAllSources } from '../db/calendar-sources.js';
import { saveEvents, deleteEventsBySource } from '../db/events.js';
import { updateSyncMetadata, incrementRetryCount, resetRetryCount, getSyncMetadata } from '../db/sync-metadata.js';
import { getEnabledCalendarsBySource } from '../db/calendars.js';

// Sync timing constants
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes
const SYNC_INTERVAL = 5 * 60 * 1000; // Sync every 5 minutes
const INITIAL_SYNC_TIMEOUT = 60 * 1000; // 60 seconds
const BACKGROUND_SYNC_TIMEOUT = 45 * 1000; // 45 seconds

// Retry configuration
const MAX_RETRIES = 3;

// Import helper functions from server.js
// Uses configured default timezone when event doesn't specify one
function extractTimezone(icalTime) {
  if (!icalTime) return null;
  if (icalTime.isDate) return null;
  const zone = icalTime.zone;
  // If no zone specified, use default timezone from environment or fallback
  const defaultTimezone = process.env.DEFAULT_TIMEZONE || 'America/Chicago';
  if (!zone) return defaultTimezone;

  // Get the timezone ID
  const tzid = zone.tzid;
  // Treat "floating" timezone as missing timezone - use default
  // Floating time means "local time without timezone info" which should be interpreted as default timezone
  if (!tzid || tzid === 'floating') return defaultTimezone;

  return tzid;
}

function icalTimeToDate(icalTime, detectedTimezone = null) {
  if (!icalTime) return null;

  if (icalTime.isDate) {
    return new Date(Date.UTC(icalTime.year, icalTime.month - 1, icalTime.day, 12, 0, 0));
  }

  // Check if this is a floating time (no timezone specified)
  const zone = icalTime.zone;
  const isFloating = !zone || zone.tzid === 'floating';

  if (isFloating && detectedTimezone) {
    // For floating times, interpret the time in the default timezone
    // The floating time represents local time in the target timezone (e.g., 9:30 AM CST)
    // We need to convert this to the proper UTC timestamp

    // Build date string: YYYY-MM-DDTHH:mm:ss
    const dateStr = `${icalTime.year}-${String(icalTime.month).padStart(2, '0')}-${String(icalTime.day).padStart(2, '0')}T${String(icalTime.hour).padStart(2, '0')}:${String(icalTime.minute).padStart(2, '0')}:${String(icalTime.second).padStart(2, '0')}`;

    // Parse as local date (will be interpreted in server's timezone, which is UTC in Docker)
    const localDate = new Date(dateStr);

    // Calculate timezone offset for America/Chicago
    // CST (winter) = UTC-6 = 360 minutes
    // CDT (summer) = UTC-5 = 300 minutes
    // For November, it's CST (UTC-6)
    const cstOffsetMinutes = 360; // CST is UTC-6

    // Get server's timezone offset (0 for UTC)
    const serverOffsetMinutes = localDate.getTimezoneOffset();

    // Calculate adjustment needed
    // Server in UTC (offset=0), target CST (offset=360)
    // To convert 9:30 AM CST to UTC: add 6 hours
    // Adjustment = targetOffset (360) - serverOffset (0) = 360 minutes
    const adjustmentMinutes = cstOffsetMinutes - serverOffsetMinutes;

    return new Date(localDate.getTime() + (adjustmentMinutes * 60 * 1000));
  }

  return icalTime.toJSDate();
}

async function parseICSData(icsData, calendarName, calendarId, timeMin, timeMax) {
  const events = [];

  try {
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      if (event.isRecurring()) {
        const startDate = timeMin ? ICAL.Time.fromJSDate(new Date(timeMin)) : null;
        const endDate = timeMax ? ICAL.Time.fromJSDate(new Date(timeMax)) : null;

        const expand = event.iterator(startDate);
        let next;
        let occurrenceCount = 0;
        const maxOccurrences = 500;

        while ((next = expand.next()) && occurrenceCount < maxOccurrences) {
          if (endDate && next.compare(endDate) > 0) {
            break;
          }

          if (startDate && next.compare(startDate) < 0) {
            occurrenceCount++;
            continue;
          }

          const occurrence = event.getOccurrenceDetails(next);
          const startTz = extractTimezone(occurrence.startDate);

          events.push({
            id: `${event.uid}_${next.toUnixTime()}`,
            title: event.summary || 'Untitled Event',
            start: icalTimeToDate(occurrence.startDate, startTz),
            end: icalTimeToDate(occurrence.endDate, startTz),
            allDay: occurrence.startDate?.isDate || false,
            description: event.description || '',
            location: event.location || '',
            calendarId: calendarId,
            calendarName: calendarName,
            isRecurring: true,
            timezone: startTz,
          });

          occurrenceCount++;
        }
      } else {
        const startTz = extractTimezone(event.startDate);

        if (timeMin || timeMax) {
          const eventStart = event.startDate;
          const eventEnd = event.endDate;

          if (timeMin && eventEnd) {
            const minDate = ICAL.Time.fromJSDate(new Date(timeMin));
            if (eventEnd.compare(minDate) < 0) {
              continue;
            }
          }

          if (timeMax && eventStart) {
            const maxDate = ICAL.Time.fromJSDate(new Date(timeMax));
            if (eventStart.compare(maxDate) > 0) {
              continue;
            }
          }
        }

        events.push({
          id: event.uid,
          title: event.summary || 'Untitled Event',
          start: icalTimeToDate(event.startDate, startTz),
          end: icalTimeToDate(event.endDate, startTz),
          allDay: event.startDate?.isDate || false,
          description: event.description || '',
          location: event.location || '',
          calendarId: calendarId,
          calendarName: calendarName,
          isRecurring: false,
          timezone: startTz,
        });
      }
    }
  } catch (parseError) {
    console.error('[Sync] Error parsing ICS data:', parseError.message);
    throw parseError;
  }

  return events;
}

/**
 * Fetch events from a calendar source
 */
async function fetchEventsFromSource(source) {
  const events = [];

  try {
    // Get only enabled calendars for this source
    const enabledCalendars = getEnabledCalendarsBySource(source.id);

    if (enabledCalendars.length === 0) {
      console.log(`[Sync] No enabled calendars for ${source.name}`);
      return [];
    }

    console.log(`[Sync] Fetching from ${enabledCalendars.length} enabled calendar(s) for ${source.name}`);

    // Handle .ics URL type
    if (source.sourceType === 'ics') {
      // For ICS URLs, sync each enabled calendar
      for (const calendar of enabledCalendars) {
        console.log(`[Sync] Fetching from .ics URL: ${calendar.name}`);

        const response = await fetch(calendar.calendarUrl, {
          headers: source.requiresAuth ? {
            'Authorization': 'Basic ' + Buffer.from(`${source.username}:${source.password}`).toString('base64')
          } : {},
          timeout: BACKGROUND_SYNC_TIMEOUT
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const icsData = await response.text();
        const parsedEvents = await parseICSData(icsData, calendar.name, calendar.id, null, null);
        events.push(...parsedEvents);
      }

      console.log(`[Sync] Fetched ${events.length} events from ${source.name}`);
      return events;
    }

    // Handle CalDAV type
    console.log(`[Sync] Fetching from CalDAV: ${source.url}`);

    const clientConfig = {
      serverUrl: source.url,
      defaultAccountType: 'caldav',
    };

    if (source.requiresAuth) {
      clientConfig.credentials = {
        username: source.username,
        password: source.password,
      };
      clientConfig.authMethod = 'Basic';
    }

    const client = await createDAVClient(clientConfig);
    const allCalDAVCalendars = await client.fetchCalendars();

    if (allCalDAVCalendars.length === 0) {
      console.log(`[Sync] No calendars found on CalDAV server for ${source.name}`);
      return [];
    }

    // Match enabled calendars with CalDAV calendars by URL
    for (const enabledCal of enabledCalendars) {
      const caldavCal = allCalDAVCalendars.find(c => c.url === enabledCal.calendarUrl);

      if (!caldavCal) {
        console.warn(`[Sync] Could not find CalDAV calendar for ${enabledCal.name} (${enabledCal.calendarUrl})`);
        continue;
      }

      try {
        console.log(`[Sync] Fetching events from calendar: ${enabledCal.name}`);

        const calendarObjects = await client.fetchCalendarObjects({
          calendar: caldavCal,
        });

        console.log(`[Sync] Found ${calendarObjects.length} objects in "${enabledCal.name}"`);

        for (const obj of calendarObjects) {
          try {
            if (!obj.data) continue;

            const parsedEvents = await parseICSData(
              obj.data,
              enabledCal.name,
              enabledCal.id, // Use calendar ID from database
              null,
              null
            );
            events.push(...parsedEvents);
          } catch (parseError) {
            console.error('[Sync] Error parsing calendar object:', parseError.message);
          }
        }
      } catch (calendarError) {
        console.error(`[Sync] Error fetching calendar "${enabledCal.name}":`, calendarError.message);
      }
    }

    console.log(`[Sync] Fetched ${events.length} events from ${source.name}`);
    return events;
  } catch (error) {
    console.error(`[Sync] Error fetching from source ${source.name}:`, error.message);
    throw error;
  }
}

/**
 * Sync a single calendar source
 */
export async function syncSource(sourceId) {
  console.log(`[Sync] Starting sync for source: ${sourceId}`);

  try {
    // Get source from database
    const { getSourceById } = await import('../db/calendar-sources.js');
    const source = getSourceById(sourceId);

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Check retry metadata
    const metadata = getSyncMetadata(sourceId);
    if (metadata && metadata.retryCount >= MAX_RETRIES) {
      const now = Date.now();
      if (metadata.nextRetryTime && now < new Date(metadata.nextRetryTime).getTime()) {
        console.log(`[Sync] Skipping ${source.name} - retry limit exceeded, waiting until ${metadata.nextRetryTime}`);
        return { success: false, error: 'Retry limit exceeded' };
      }
    }

    // Fetch events
    const events = await fetchEventsFromSource(source);

    // Transform events for database storage
    const dbEvents = events.map(event => ({
      id: event.id,
      sourceId: sourceId,
      calendarId: event.calendarId,
      title: event.title,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      timezone: event.timezone,
      recurrenceRule: event.isRecurring ? 'RECURRING' : null,
      allDay: event.allDay
    }));

    // Clear old events and save new ones
    deleteEventsBySource(sourceId);
    saveEvents(dbEvents);

    // Update sync metadata - success
    updateSyncMetadata(sourceId, {
      lastSyncTime: Date.now(),
      lastSyncStatus: 'success',
      lastError: null,
      retryCount: 0,
      nextRetryTime: null
    });

    console.log(`[Sync] Successfully synced ${dbEvents.length} events for ${source.name}`);

    return { success: true, count: dbEvents.length };
  } catch (error) {
    console.error(`[Sync] Error syncing source ${sourceId}:`, error.message);

    // Update sync metadata - failure with retry
    incrementRetryCount(sourceId, error.message);

    return { success: false, error: error.message };
  }
}

/**
 * Sync all calendar sources
 */
export async function syncAllSources() {
  console.log('[Sync] Starting sync for all sources...');

  const sources = getAllSources();

  if (sources.length === 0) {
    console.log('[Sync] No sources configured');
    return { success: true, results: [] };
  }

  const results = await Promise.all(
    sources.map(source => syncSource(source.id))
  );

  const successCount = results.filter(r => r.success).length;
  console.log(`[Sync] Sync complete: ${successCount}/${sources.length} sources successful`);

  return { success: true, results };
}

/**
 * Start automatic background sync
 */
let syncInterval = null;

export function startBackgroundSync() {
  if (syncInterval) {
    console.log('[Sync] Background sync already running');
    return;
  }

  console.log(`[Sync] Starting background sync (every ${SYNC_INTERVAL / 1000 / 60} minutes)`);

  // Run initial sync
  syncAllSources().catch(error => {
    console.error('[Sync] Initial sync failed:', error);
  });

  // Set up periodic sync
  syncInterval = setInterval(() => {
    syncAllSources().catch(error => {
      console.error('[Sync] Background sync failed:', error);
    });
  }, SYNC_INTERVAL);
}

/**
 * Stop automatic background sync
 */
export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Sync] Background sync stopped');
  }
}
