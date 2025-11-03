/**
 * API service for communicating with backend
 * Replaces browser storage (localStorage/IndexedDB) with server persistence
 */

import type { CalendarSource, CalendarEvent } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Calendar Sources API
 */

export async function fetchSources(): Promise<CalendarSource[]> {
  const response = await fetch(`${API_BASE}/config/sources`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sources: ${response.statusText}`);
  }
  return response.json();
}

export async function createSource(source: Omit<CalendarSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarSource> {
  console.log('[API] createSource:', source.name);

  const response = await fetch(`${API_BASE}/config/sources`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(source),
  });

  if (!response.ok) {
    console.error('[API] createSource failed:', response.status, response.statusText);
    // Try to parse error details from response
    try {
      const errorData = await response.json();
      const errorMsg = errorData.details || errorData.error || response.statusText;
      throw new Error(errorMsg);
    } catch (parseErr) {
      throw new Error(`Failed to create source: ${response.statusText}`);
    }
  }

  const newSource = await response.json();
  console.log('[API] createSource success:', newSource.id);
  return newSource;
}

export async function updateSource(id: string, updates: Partial<CalendarSource>): Promise<CalendarSource> {
  const response = await fetch(`${API_BASE}/config/sources/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update source: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteSource(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/config/sources/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete source: ${response.statusText}`);
  }
}

export async function batchCreateSources(sources: CalendarSource[]): Promise<void> {
  const response = await fetch(`${API_BASE}/config/sources/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sources }),
  });

  if (!response.ok) {
    throw new Error(`Failed to batch create sources: ${response.statusText}`);
  }
}

/**
 * Events API
 */

export async function fetchEvents(options: {
  sourceId?: string;
  calendarId?: string;
  start?: string;
  end?: string;
} = {}): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (options.sourceId) params.append('sourceId', options.sourceId);
  if (options.calendarId) params.append('calendarId', options.calendarId);
  if (options.start) params.append('start', options.start);
  if (options.end) params.append('end', options.end);

  const url = `${API_BASE}/events?${params}`;
  console.log('[API] fetchEvents:', url);

  const response = await fetch(url);
  if (!response.ok) {
    console.error('[API] fetchEvents failed:', response.status, response.statusText);
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  const events = await response.json();
  console.log('[API] fetchEvents success:', events.length, 'events returned');

  // Transform ISO string dates to Date objects for frontend
  return events.map((event: any) => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
  }));
}

export async function getEventCount(sourceId?: string): Promise<number> {
  const params = sourceId ? `?sourceId=${sourceId}` : '';
  const response = await fetch(`${API_BASE}/events/count${params}`);

  if (!response.ok) {
    throw new Error(`Failed to get event count: ${response.statusText}`);
  }

  const data = await response.json();
  return data.count;
}

/**
 * Sync API
 */

export async function triggerSync(sourceId?: string): Promise<{ success: boolean; results?: any }> {
  console.log('[API] triggerSync:', sourceId || 'all sources');

  const response = await fetch(`${API_BASE}/sync/trigger`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sourceId }),
  });

  if (!response.ok) {
    console.error('[API] triggerSync failed:', response.status, response.statusText);
    throw new Error(`Failed to trigger sync: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('[API] triggerSync success:', result);
  return result;
}

export async function getSyncStatus(sourceId?: string): Promise<any> {
  const params = sourceId ? `?sourceId=${sourceId}` : '';
  const response = await fetch(`${API_BASE}/sync/status${params}`);

  if (!response.ok) {
    throw new Error(`Failed to get sync status: ${response.statusText}`);
  }

  return response.json();
}

export async function resetRetryCount(sourceId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/sync/reset-retry/${sourceId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to reset retry count: ${response.statusText}`);
  }
}
