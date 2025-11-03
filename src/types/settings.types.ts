/**
 * UI Settings Types
 * User-configurable display preferences for the calendar
 */

export interface UISettings {
  // Today column colors
  todayColumnBgColor: string;
  todayColumnTextColor: string;

  // Default event colors (used when calendar doesn't specify)
  defaultEventBgColor: string;
  defaultEventTextColor: string;

  // Timezone settings
  displayTimezone?: string; // IANA timezone (e.g., 'America/New_York'), auto-detected if not set

  // Slideshow settings
  slideshowEnabled: boolean; // Whether slideshow is enabled
  slideshowDuration: number; // Duration in milliseconds (default: 60000)
  slideshowTransitionSpeed: number; // Transition speed in milliseconds (default: 1000)
  calendarIdleDuration: number; // Time to wait on calendar before starting slideshow in milliseconds (default: 300000)
}

export const DEFAULT_UI_SETTINGS: UISettings = {
  todayColumnBgColor: 'rgba(55, 136, 216, 0.15)',
  todayColumnTextColor: '#ffffff',
  defaultEventBgColor: '#3788d8',
  defaultEventTextColor: '#ffffff',
  slideshowEnabled: true,
  slideshowDuration: 60000, // 60 seconds
  slideshowTransitionSpeed: 1000, // 1 second
  calendarIdleDuration: 300000, // 300 seconds (5 minutes)
};
