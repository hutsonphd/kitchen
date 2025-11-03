import type { CalendarSource, CalendarEvent, FetchEventsOptions } from '../types';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || '';
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Delay for exponential backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error.name === 'TypeError' || error.message.includes('fetch failed')) {
    return true;
  }
  // Timeout errors
  if (error.message.includes('timeout')) {
    return true;
  }
  // HTTP 5xx errors are retryable, 4xx are not
  if (error.message.includes('HTTP 5')) {
    return true;
  }
  return false;
}

/**
 * Make a request to the CalDAV proxy server with retry logic and timeout
 */
async function proxyRequest<T>(
  endpoint: string,
  data: any,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT);

      // Combine timeout signal with optional cancellation signal
      const combinedSignal = signal
        ? combineAbortSignals([signal, timeoutController.signal])
        : timeoutController.signal;

      const response = await fetch(`${PROXY_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry if request was cancelled
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }

      // Check if we should retry
      const shouldRetry = attempt < MAX_RETRIES && isRetryableError(error);

      if (!shouldRetry) {
        console.error('Proxy request failed (not retryable):', error);
        throw new Error(
          `Proxy request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Calculate exponential backoff delay
      const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
      console.warn(
        `Proxy request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delayMs}ms...`,
        error
      );

      await delay(delayMs);
    }
  }

  // All retries exhausted
  throw new Error(
    `Proxy request failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Combine multiple AbortSignals into one
 */
function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}

/**
 * Fetch calendar events from a CalDAV source via proxy
 */
export async function fetchCalendarEvents(
  source: CalendarSource,
  options: FetchEventsOptions,
  fullSync: boolean = false
): Promise<CalendarEvent[]> {
  try {
    // Only fetch from enabled calendars
    const enabledCalendars = source.calendars.filter(cal => cal.enabled);

    if (enabledCalendars.length === 0) {
      console.warn(`No enabled calendars for source "${source.name}". Total calendars: ${source.calendars.length}`);
      source.calendars.forEach(cal => {
        console.log(`  - ${cal.name}: enabled=${cal.enabled}`);
      });
      return [];
    }

    console.log(`Fetching from ${enabledCalendars.length}/${source.calendars.length} enabled calendars in source "${source.name}"`);
    enabledCalendars.forEach(cal => {
      console.log(`  - ${cal.name} (${cal.calendarUrl})`);
    });

    // Get calendar names for filtering on the backend
    const selectedCalendarNames = enabledCalendars.map(cal => cal.name);

    const requestBody: any = {
      url: source.url,
      username: source.username,
      password: source.password,
      selectedCalendars: selectedCalendarNames,
      sourceType: source.sourceType,
      requiresAuth: source.requiresAuth,
      fullSync: fullSync,
    };

    // Only add time range if not doing full sync
    if (!fullSync) {
      requestBody.timeMin = options.startDate.toISOString();
      requestBody.timeMax = options.endDate.toISOString();
    }

    const response = await proxyRequest<{ events: any[] }>('/api/caldav/fetch-events', requestBody);

    // Create a lookup map for calendar colors by URL and by name
    const calendarByUrlMap = new Map(
      enabledCalendars.map(cal => [cal.calendarUrl, cal])
    );
    const calendarByNameMap = new Map(
      enabledCalendars.map(cal => [cal.name, cal])
    );

    // Transform events from proxy to match CalendarEvent format
    const events: CalendarEvent[] = response.events.map((event: any) => {
      // Find the calendar this event belongs to - try URL first, then name
      let calendar = calendarByUrlMap.get(event.calendarUrl);

      if (!calendar && event.calendarName) {
        calendar = calendarByNameMap.get(event.calendarName);
      }

      if (!calendar) {
        console.warn(`Could not match event "${event.title}" (calendarUrl: ${event.calendarUrl}, calendarName: ${event.calendarName}) to any enabled calendar. Using fallback.`);
      }

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
