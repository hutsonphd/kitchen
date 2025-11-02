import CryptoJS from 'crypto-js';
import type { CalendarSource } from '../types';
import type { UISettings } from '../types/settings.types';
import { DEFAULT_UI_SETTINGS } from '../types/settings.types';

const STORAGE_KEY = 'calendar_sources';
const UI_SETTINGS_KEY = 'ui_settings';
const ENCRYPTION_KEY = 'kitchen-kiosk-calendar-key'; // In production, use env variable

export const storage = {
  // Save calendar sources to localStorage with encrypted credentials
  saveSources: (sources: CalendarSource[]): void => {
    try {
      const encrypted = sources.map(source => ({
        ...source,
        password: CryptoJS.AES.encrypt(source.password, ENCRYPTION_KEY).toString()
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encrypted));
    } catch (error) {
      console.error('Failed to save calendar sources:', error);
      throw new Error('Failed to save calendar configuration');
    }
  },

  // Load calendar sources from localStorage and decrypt credentials
  loadSources: (): CalendarSource[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const encrypted = JSON.parse(stored);
      return encrypted.map((source: any) => ({
        ...source,
        password: CryptoJS.AES.decrypt(source.password, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8),
        lastFetched: source.lastFetched ? new Date(source.lastFetched) : undefined
      }));
    } catch (error) {
      console.error('Failed to load calendar sources:', error);
      return [];
    }
  },

  // Clear all stored calendar sources
  clearSources: (): void => {
    localStorage.removeItem(STORAGE_KEY);
  },

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
