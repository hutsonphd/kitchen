/**
 * Data access layer for calendar events
 */

import { getDatabase } from './index.js';

/**
 * Get all events within optional date range
 */
export const getEvents = (options = {}) => {
  const db = getDatabase();
  let query = `
    SELECT
      events.*,
      calendars.color as calendar_color
    FROM events
    LEFT JOIN calendars ON events.calendar_id = calendars.id
  `;
  const conditions = [];
  const params = [];

  // Filter by source ID
  if (options.sourceId) {
    conditions.push('events.source_id = ?');
    params.push(options.sourceId);
  }

  // Filter by calendar ID
  if (options.calendarId) {
    conditions.push('events.calendar_id = ?');
    params.push(options.calendarId);
  }

  // Filter by date range
  if (options.start) {
    const startTime = typeof options.start === 'string' ? new Date(options.start).getTime() : options.start;
    conditions.push('events.end_time >= ?');
    params.push(startTime);
  }

  if (options.end) {
    const endTime = typeof options.end === 'string' ? new Date(options.end).getTime() : options.end;
    conditions.push('events.start_time <= ?');
    params.push(endTime);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY events.start_time ASC';

  const events = db.prepare(query).all(...params);

  return events.map(event => ({
    id: event.id,
    sourceId: event.source_id,
    calendarId: event.calendar_id,
    title: event.title,
    description: event.description,
    location: event.location,
    start: new Date(event.start_time).toISOString(),
    end: new Date(event.end_time).toISOString(),
    timezone: event.timezone,
    recurrenceRule: event.recurrence_rule,
    allDay: event.is_all_day === 1,
    color: event.calendar_color || '#3788d8',
    createdAt: new Date(event.created_at),
    updatedAt: new Date(event.updated_at)
  }));
};

/**
 * Get event by ID
 */
export const getEventById = (id) => {
  const db = getDatabase();
  const event = db.prepare(`
    SELECT
      events.*,
      calendars.color as calendar_color
    FROM events
    LEFT JOIN calendars ON events.calendar_id = calendars.id
    WHERE events.id = ?
  `).get(id);

  if (!event) return null;

  return {
    id: event.id,
    sourceId: event.source_id,
    calendarId: event.calendar_id,
    title: event.title,
    description: event.description,
    location: event.location,
    start: new Date(event.start_time).toISOString(),
    end: new Date(event.end_time).toISOString(),
    timezone: event.timezone,
    recurrenceRule: event.recurrence_rule,
    allDay: event.is_all_day === 1,
    color: event.calendar_color || '#3788d8',
    createdAt: new Date(event.created_at),
    updatedAt: new Date(event.updated_at)
  };
};

/**
 * Save events (batch insert/replace)
 */
export const saveEvents = (events) => {
  const db = getDatabase();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO events (
      id, source_id, calendar_id, title, description, location,
      start_time, end_time, timezone, recurrence_rule, is_all_day,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((eventsToSave) => {
    for (const event of eventsToSave) {
      // Convert start/end to Unix timestamp (milliseconds)
      // Handle Date objects, ISO strings, or existing timestamps
      const startTime = event.start instanceof Date
        ? event.start.getTime()
        : typeof event.start === 'string'
          ? new Date(event.start).getTime()
          : event.start;

      const endTime = event.end instanceof Date
        ? event.end.getTime()
        : typeof event.end === 'string'
          ? new Date(event.end).getTime()
          : event.end;

      // Validate timestamp values
      if (typeof startTime !== 'number' || typeof endTime !== 'number') {
        console.error('[DB Events] Invalid timestamp type:', {
          eventId: event.id,
          startType: typeof event.start,
          endType: typeof event.end,
          startTime,
          endTime
        });
        continue; // Skip this event
      }

      stmt.run(
        event.id,
        event.sourceId,
        event.calendarId,
        event.title || '',
        event.description || '',
        event.location || '',
        startTime,
        endTime,
        event.timezone || 'UTC',
        event.recurrenceRule || null,
        (event.allDay || event.isAllDay) ? 1 : 0,
        now,
        now
      );
    }
  });

  transaction(events);

  return events.length;
};

/**
 * Delete event by ID
 */
export const deleteEvent = (id) => {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM events WHERE id = ?');
  stmt.run(id);
};

/**
 * Delete all events for a source
 */
export const deleteEventsBySource = (sourceId) => {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM events WHERE source_id = ?');
  const result = stmt.run(sourceId);
  return result.changes;
};

/**
 * Delete all events for a calendar
 */
export const deleteEventsByCalendar = (calendarId) => {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM events WHERE calendar_id = ?');
  const result = stmt.run(calendarId);
  return result.changes;
};

/**
 * Get event count by source
 */
export const getEventCount = (sourceId = null) => {
  const db = getDatabase();

  if (sourceId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM events WHERE source_id = ?').get(sourceId);
    return result.count;
  }

  const result = db.prepare('SELECT COUNT(*) as count FROM events').get();
  return result.count;
};
