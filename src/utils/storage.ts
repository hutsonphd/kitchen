import type { UISettings } from '../types/settings.types';
import { DEFAULT_UI_SETTINGS } from '../types/settings.types';

const UI_SETTINGS_KEY = 'ui_settings';

export const storage = {
  // Save UI settings to localStorage
  saveUISettings: (settings: UISettings): void => {
    try {
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save UI settings:', error);
      throw new Error('Failed to save UI settings');
    }
  },

  // Load UI settings from localStorage
  loadUISettings: (): UISettings => {
    try {
      const stored = localStorage.getItem(UI_SETTINGS_KEY);
      if (!stored) return DEFAULT_UI_SETTINGS;

      const settings = JSON.parse(stored);
      // Merge with defaults to ensure all properties exist
      return { ...DEFAULT_UI_SETTINGS, ...settings };
    } catch (error) {
      console.error('Failed to load UI settings:', error);
      return DEFAULT_UI_SETTINGS;
    }
  }
};
