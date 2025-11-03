/**
 * Data access layer for calendars
 */

import { getDatabase } from './index.js';
import { randomUUID } from 'crypto';

/**
 * Get all calendars for a source
 */
export const getCalendarsBySource = (sourceId) => {
  const db = getDatabase();
  const calendars = db.prepare('SELECT * FROM calendars WHERE source_id = ?').all(sourceId);

  return calendars.map(cal => ({
    id: cal.id,
    sourceId: cal.source_id,
    name: cal.name,
    calendarUrl: cal.calendar_url,
    color: cal.color,
    enabled: cal.enabled === 1,
    createdAt: new Date(cal.created_at),
    updatedAt: new Date(cal.updated_at)
  }));
};

/**
 * Get calendar by ID
 */
export const getCalendarById = (id) => {
  const db = getDatabase();
  const cal = db.prepare('SELECT * FROM calendars WHERE id = ?').get(id);

  if (!cal) return null;

  return {
    id: cal.id,
    sourceId: cal.source_id,
    name: cal.name,
    calendarUrl: cal.calendar_url,
    color: cal.color,
    enabled: cal.enabled === 1,
    createdAt: new Date(cal.created_at),
    updatedAt: new Date(cal.updated_at)
  };
};

/**
 * Create calendar
 */
export const createCalendar = (calendarData) => {
  const db = getDatabase();
  const id = calendarData.id || randomUUID();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO calendars (
      id, source_id, name, calendar_url, color, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    calendarData.sourceId,
    calendarData.name,
    calendarData.calendarUrl,
    calendarData.color || '#3788d8',
    calendarData.enabled ? 1 : 0,
    now,
    now
  );

  return getCalendarById(id);
};

/**
 * Update calendar
 */
export const updateCalendar = (id, updates) => {
  const db = getDatabase();
  const now = Date.now();

  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.calendarUrl !== undefined) {
    fields.push('calendar_url = ?');
    values.push(updates.calendarUrl);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(updates.color);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  if (fields.length === 0) {
    return getCalendarById(id);
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const stmt = db.prepare(`
    UPDATE calendars
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  return getCalendarById(id);
};

/**
 * Delete calendar
 */
export const deleteCalendar = (id) => {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM calendars WHERE id = ?');
  stmt.run(id);
};

/**
 * Delete all calendars for a source
 */
export const deleteCalendarsBySource = (sourceId) => {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM calendars WHERE source_id = ?');
  const result = stmt.run(sourceId);
  return result.changes;
};

/**
 * Get enabled calendars for a source
 */
export const getEnabledCalendarsBySource = (sourceId) => {
  const db = getDatabase();
  const calendars = db.prepare('SELECT * FROM calendars WHERE source_id = ? AND enabled = 1').all(sourceId);

  return calendars.map(cal => ({
    id: cal.id,
    sourceId: cal.source_id,
    name: cal.name,
    calendarUrl: cal.calendar_url,
    color: cal.color,
    enabled: true,
    createdAt: new Date(cal.created_at),
    updatedAt: new Date(cal.updated_at)
  }));
};
