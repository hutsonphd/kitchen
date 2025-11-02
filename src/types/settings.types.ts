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
}

export const DEFAULT_UI_SETTINGS: UISettings = {
  todayColumnBgColor: 'rgba(55, 136, 216, 0.15)',
  todayColumnTextColor: '#ffffff',
  defaultEventBgColor: '#3788d8',
  defaultEventTextColor: '#ffffff',
};
