/**
 * Data access layer for sync metadata
 */

import { getDatabase } from './index.js';

/**
 * Get sync metadata for a source
 */
export const getSyncMetadata = (sourceId) => {
  const db = getDatabase();
  const metadata = db.prepare('SELECT * FROM sync_metadata WHERE source_id = ?').get(sourceId);

  if (!metadata) return null;

  return {
    sourceId: metadata.source_id,
    lastSyncTime: metadata.last_sync_time ? new Date(metadata.last_sync_time) : null,
    lastSyncStatus: metadata.last_sync_status,
    lastError: metadata.last_error,
    retryCount: metadata.retry_count,
    nextRetryTime: metadata.next_retry_time ? new Date(metadata.next_retry_time) : null,
    syncToken: metadata.sync_token,
    ctag: metadata.ctag
  };
};

/**
 * Get all sync metadata
 */
export const getAllSyncMetadata = () => {
  const db = getDatabase();
  const metadatas = db.prepare('SELECT * FROM sync_metadata').all();

  return metadatas.map(metadata => ({
    sourceId: metadata.source_id,
    lastSyncTime: metadata.last_sync_time ? new Date(metadata.last_sync_time) : null,
    lastSyncStatus: metadata.last_sync_status,
    lastError: metadata.last_error,
    retryCount: metadata.retry_count,
    nextRetryTime: metadata.next_retry_time ? new Date(metadata.next_retry_time) : null,
    syncToken: metadata.sync_token,
    ctag: metadata.ctag
  }));
};

/**
 * Update sync metadata
 */
export const updateSyncMetadata = (sourceId, updates) => {
  const db = getDatabase();

  const fields = [];
  const values = [];

  if (updates.lastSyncTime !== undefined) {
    fields.push('last_sync_time = ?');
    const time = updates.lastSyncTime instanceof Date
      ? updates.lastSyncTime.getTime()
      : updates.lastSyncTime;
    values.push(time);
  }

  if (updates.lastSyncStatus !== undefined) {
    fields.push('last_sync_status = ?');
    values.push(updates.lastSyncStatus);
  }

  if (updates.lastError !== undefined) {
    fields.push('last_error = ?');
    values.push(updates.lastError);
  }

  if (updates.retryCount !== undefined) {
    fields.push('retry_count = ?');
    values.push(updates.retryCount);
  }

  if (updates.nextRetryTime !== undefined) {
    fields.push('next_retry_time = ?');
    const time = updates.nextRetryTime instanceof Date
      ? updates.nextRetryTime.getTime()
      : updates.nextRetryTime;
    values.push(time);
  }

  if (updates.syncToken !== undefined) {
    fields.push('sync_token = ?');
    values.push(updates.syncToken);
  }

  if (updates.ctag !== undefined) {
    fields.push('ctag = ?');
    values.push(updates.ctag);
  }

  if (fields.length === 0) {
    return getSyncMetadata(sourceId);
  }

  values.push(sourceId);

  // Use INSERT OR REPLACE to handle first-time creation
  const existingMetadata = getSyncMetadata(sourceId);

  if (!existingMetadata) {
    // Create new record
    const stmt = db.prepare(`
      INSERT INTO sync_metadata (
        source_id, last_sync_time, last_sync_status, last_error,
        retry_count, next_retry_time, sync_token, ctag
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sourceId,
      updates.lastSyncTime ? (updates.lastSyncTime instanceof Date ? updates.lastSyncTime.getTime() : updates.lastSyncTime) : null,
      updates.lastSyncStatus || null,
      updates.lastError || null,
      updates.retryCount || 0,
      updates.nextRetryTime ? (updates.nextRetryTime instanceof Date ? updates.nextRetryTime.getTime() : updates.nextRetryTime) : null,
      updates.syncToken || null,
      updates.ctag || null
    );
  } else {
    // Update existing record
    const stmt = db.prepare(`
      UPDATE sync_metadata
      SET ${fields.join(', ')}
      WHERE source_id = ?
    `);

    stmt.run(...values);
  }

  return getSyncMetadata(sourceId);
};

/**
 * Reset retry count for a source
 */
export const resetRetryCount = (sourceId) => {
  return updateSyncMetadata(sourceId, {
    retryCount: 0,
    nextRetryTime: null,
    lastError: null
  });
};

/**
 * Increment retry count with exponential backoff
 */
export const incrementRetryCount = (sourceId, error) => {
  const metadata = getSyncMetadata(sourceId) || { retryCount: 0 };
  const newRetryCount = metadata.retryCount + 1;

  // Exponential backoff: 1min, 5min, 15min
  const backoffMinutes = [1, 5, 15];
  const delayMinutes = backoffMinutes[Math.min(newRetryCount - 1, backoffMinutes.length - 1)];
  const nextRetryTime = Date.now() + (delayMinutes * 60 * 1000);

  return updateSyncMetadata(sourceId, {
    retryCount: newRetryCount,
    nextRetryTime,
    lastError: error,
    lastSyncStatus: 'error'
  });
};

/**
 * Delete sync metadata for a source
 */
export const deleteSyncMetadata = (sourceId) => {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM sync_metadata WHERE source_id = ?');
  stmt.run(sourceId);
};
