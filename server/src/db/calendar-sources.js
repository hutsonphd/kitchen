/**
 * Data access layer for calendar sources
 */

import { getDatabase } from './index.js';
import { encryptPassword, decryptPassword } from './crypto.js';
import { randomUUID } from 'crypto';
import { getCalendarsBySource, createCalendar, deleteCalendarsBySource } from './calendars.js';

/**
 * Get all calendar sources with their calendars
 */
export const getAllSources = () => {
  const db = getDatabase();
  const sources = db.prepare('SELECT * FROM calendar_sources WHERE is_active = 1').all();

  return sources.map(source => {
    const calendars = getCalendarsBySource(source.id);

    return {
      id: source.id,
      name: source.name,
      url: source.server_url,
      serverUrl: source.server_url, // For backwards compatibility
      username: source.username,
      password: decryptPassword(source.password_encrypted),
      sourceType: source.source_type || 'caldav',
      requiresAuth: source.requires_auth === 1,
      isPublic: source.is_public === 1,
      enabled: source.enabled === 1,
      calendars,
      createdAt: new Date(source.created_at),
      updatedAt: new Date(source.updated_at)
    };
  });
};

/**
 * Get calendar source by ID with calendars
 */
export const getSourceById = (id) => {
  const db = getDatabase();
  const source = db.prepare('SELECT * FROM calendar_sources WHERE id = ?').get(id);

  if (!source) return null;

  const calendars = getCalendarsBySource(id);

  return {
    id: source.id,
    name: source.name,
    url: source.server_url,
    serverUrl: source.server_url,
    username: source.username,
    password: decryptPassword(source.password_encrypted),
    sourceType: source.source_type || 'caldav',
    requiresAuth: source.requires_auth === 1,
    isPublic: source.is_public === 1,
    enabled: source.enabled === 1,
    calendars,
    createdAt: new Date(source.created_at),
    updatedAt: new Date(source.updated_at)
  };
};

/**
 * Create new calendar source with calendars
 */
export const createSource = (sourceData) => {
  const db = getDatabase();
  const id = sourceData.id || randomUUID();
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO calendar_sources (
      id, name, server_url, username, password_encrypted,
      source_type, requires_auth, is_public, is_active, enabled,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    sourceData.name,
    sourceData.url || sourceData.serverUrl, // Accept either url or serverUrl
    sourceData.username,
    encryptPassword(sourceData.password),
    sourceData.sourceType || 'caldav',
    sourceData.requiresAuth !== false ? 1 : 0,
    sourceData.isPublic ? 1 : 0,
    1, // is_active
    sourceData.enabled !== false ? 1 : 0,
    now,
    now
  );

  // Create calendars if provided
  if (sourceData.calendars && Array.isArray(sourceData.calendars)) {
    for (const calendar of sourceData.calendars) {
      createCalendar({
        ...calendar,
        sourceId: id
      });
    }
  }

  return getSourceById(id);
};

/**
 * Update calendar source
 */
export const updateSource = (id, updates) => {
  const db = getDatabase();
  const now = Date.now();

  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.url !== undefined || updates.serverUrl !== undefined) {
    fields.push('server_url = ?');
    values.push(updates.url || updates.serverUrl);
  }
  if (updates.username !== undefined) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.password !== undefined) {
    fields.push('password_encrypted = ?');
    values.push(encryptPassword(updates.password));
  }
  if (updates.sourceType !== undefined) {
    fields.push('source_type = ?');
    values.push(updates.sourceType);
  }
  if (updates.requiresAuth !== undefined) {
    fields.push('requires_auth = ?');
    values.push(updates.requiresAuth ? 1 : 0);
  }
  if (updates.isPublic !== undefined) {
    fields.push('is_public = ?');
    values.push(updates.isPublic ? 1 : 0);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = db.prepare(`
      UPDATE calendar_sources
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  // Update calendars if provided
  if (updates.calendars && Array.isArray(updates.calendars)) {
    // Delete existing calendars and recreate
    deleteCalendarsBySource(id);

    for (const calendar of updates.calendars) {
      createCalendar({
        ...calendar,
        sourceId: id
      });
    }
  }

  return getSourceById(id);
};

/**
 * Delete calendar source (soft delete)
 */
export const deleteSource = (id) => {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE calendar_sources
    SET is_active = 0, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(Date.now(), id);
};

/**
 * Hard delete calendar source (permanently remove)
 */
export const hardDeleteSource = (id) => {
  const db = getDatabase();

  // Delete will cascade to calendars, events and sync_metadata
  const stmt = db.prepare('DELETE FROM calendar_sources WHERE id = ?');
  stmt.run(id);
};
