import React, { useState } from 'react';
import type { CalendarSource } from '../types';
import { testConnection } from '../services/caldav.service';

interface CalendarFormProps {
  initialData?: CalendarSource;
  onSubmit: (data: Omit<CalendarSource, 'id'>) => void;
  onCancel: () => void;
}

export const CalendarForm: React.FC<CalendarFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    url: initialData?.url || '',
    username: initialData?.username || '',
    password: initialData?.password || '',
    color: initialData?.color || '#3788d8',
    enabled: initialData?.enabled ?? true,
    selectedCalendars: initialData?.selectedCalendars || [],
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableCalendars, setAvailableCalendars] = useState<{ displayName: string; url: string }[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setTestResult(null);
    setError(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const calendars = await testConnection(formData);
      if (calendars && calendars.length > 0) {
        setTestResult('success');
        setAvailableCalendars(calendars);
        // Auto-select all calendars by default
        setFormData(prev => ({
          ...prev,
          selectedCalendars: calendars.map(cal => cal.displayName)
        }));
      } else {
        setTestResult('error');
        setError('Connection test failed. Please check your credentials and URL.');
      }
    } catch (err) {
      setTestResult('error');
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleCalendarToggle = (calendarName: string) => {
    setFormData(prev => {
      const selected = prev.selectedCalendars || [];
      const newSelected = selected.includes(calendarName)
        ? selected.filter(name => name !== calendarName)
        : [...selected, calendarName];
      return { ...prev, selectedCalendars: newSelected };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.url || !formData.username || !formData.password) {
      setError('All fields are required');
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="calendar-form">
      <div className="form-group">
        <label htmlFor="name">Calendar Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="My Calendar"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="url">CalDAV URL</label>
        <input
          type="url"
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          placeholder="https://caldav.example.com/calendar"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="username">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          placeholder="username"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="color">Color</label>
        <div className="color-input-wrapper">
          <input
            type="color"
            id="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
          />
          <input
            type="text"
            value={formData.color}
            onChange={handleChange}
            name="color"
            placeholder="#3788d8"
            className="color-text"
          />
        </div>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            name="enabled"
            checked={formData.enabled}
            onChange={handleChange}
          />
          <span>Enable this calendar</span>
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}
      {testResult === 'success' && <div className="success-message">Connection successful!</div>}

      {availableCalendars.length > 0 && (
        <div className="form-group">
          <label>Select Calendars to Display</label>
          <div className="calendar-list">
            {availableCalendars.map((calendar) => (
              <label key={calendar.url} className="calendar-checkbox">
                <input
                  type="checkbox"
                  checked={formData.selectedCalendars?.includes(calendar.displayName)}
                  onChange={() => handleCalendarToggle(calendar.displayName)}
                />
                <span>{calendar.displayName}</span>
              </label>
            ))}
          </div>
          <div className="calendar-count">
            {formData.selectedCalendars?.length || 0} of {availableCalendars.length} calendars selected
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testing || !formData.url || !formData.username || !formData.password}
          className="btn btn-secondary"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <div className="button-group">
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {initialData ? 'Update' : 'Add'} Calendar
          </button>
        </div>
      </div>
    </form>
  );
};
