/**
 * Timezone Utility Functions
 * Centralized timezone formatting for consistent display across the app
 */

/**
 * Format event time using display timezone from settings
 * This function converts event times to a unified display timezone for better UX
 * while preserving the original timezone data in storage.
 *
 * @param date - Event date/time (JavaScript Date object)
 * @param storedTimezone - Original timezone from event (preserved but not used for display)
 * @param displayTimezone - Timezone to display to user (from UISettings.displayTimezone)
 * @param allDay - Whether event is all-day (optional)
 * @returns Formatted time string with display timezone abbreviation (e.g., "9:30 AM CST")
 */
export function formatEventTime(
  date: Date,
  _storedTimezone: string | undefined,
  displayTimezone: string | undefined,
  allDay?: boolean
): string {
  // All-day events don't show time
  if (allDay) return '';

  // Use display timezone if set, otherwise fall back to browser's auto-detected timezone
  const targetTimezone = displayTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  try {
    // Format the time in the target timezone
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: targetTimezone
    });

    // Get the timezone abbreviation (e.g., "CST", "EST")
    const tzAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      timeZoneName: 'short'
    }).formatToParts(date).find(part => part.type === 'timeZoneName')?.value || '';

    return `${timeStr} ${tzAbbr}`.trim();
  } catch (error) {
    // Fallback to local time if timezone is invalid
    console.error('Error formatting time with timezone:', error);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}
