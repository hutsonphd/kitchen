import React, { useState } from 'react';
import type { CalendarSource, Calendar } from '../types';
import { testConnection } from '../services/caldav.service';

interface CalendarFormProps {
  initialData?: CalendarSource;
  onSubmit: (data: Omit<CalendarSource, 'id'>) => void;
  onCancel: () => void;
}

// Generate a random color
const generateRandomColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
};

export const CalendarForm: React.FC<CalendarFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    url: initialData?.url || '',
    username: initialData?.username || '',
    password: initialData?.password || '',
    enabled: initialData?.enabled ?? true,
    requiresAuth: initialData?.requiresAuth ?? true,
    sourceType: (initialData?.sourceType || 'caldav') as 'caldav' | 'ics',
  });

  const [calendars, setCalendars] = useState<Calendar[]>(initialData?.calendars || []);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const checked = 'checked' in e.target ? e.target.checked : undefined;
    const type = 'type' in e.target ? e.target.type : 'select';

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
      const availableCalendars = await testConnection(formData);
      if (availableCalendars && availableCalendars.length > 0) {
        setTestResult('success');

        // Create Calendar objects from available calendars
        // Preserve existing calendars if editing, otherwise create new ones
        const newCalendars: Calendar[] = availableCalendars.map((cal) => {
          // Check if we already have this calendar (when editing)
          const existing = calendars.find(c => c.calendarUrl === cal.url);

          return existing || {
            id: crypto.randomUUID(),
            name: cal.displayName,
            calendarUrl: cal.url,
            color: generateRandomColor(),
            enabled: true,
            sourceId: initialData?.id || '', // Will be set properly when saved
          };
        });

        setCalendars(newCalendars);
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

  const handleCalendarToggle = (calendarId: string) => {
    setCalendars(prev => prev.map(cal =>
      cal.id === calendarId ? { ...cal, enabled: !cal.enabled } : cal
    ));
  };

  const handleCalendarNameChange = (calendarId: string, newName: string) => {
    setCalendars(prev => prev.map(cal =>
      cal.id === calendarId ? { ...cal, name: newName } : cal
    ));
  };

  const handleCalendarColorChange = (calendarId: string, newColor: string) => {
    setCalendars(prev => prev.map(cal =>
      cal.id === calendarId ? { ...cal, color: newColor } : cal
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.url) {
      setError('Name and URL are required');
      return;
    }

    if (formData.requiresAuth && (!formData.username || !formData.password)) {
      setError('Username and password are required for authenticated sources');
      return;
    }

    if (calendars.length === 0) {
      setError('Please test the connection and select at least one calendar');
      return;
    }

    onSubmit({
      ...formData,
      calendars,
    });
  };

  const enabledCount = calendars.filter(cal => cal.enabled).length;

  return (
    <form onSubmit={handleSubmit} className="calendar-form">
      <div className="form-group">
        <label htmlFor="name">Source Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="My iCloud Calendar"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="sourceType">Source Type</label>
        <select
          id="sourceType"
          name="sourceType"
          value={formData.sourceType}
          onChange={handleChange}
        >
          <option value="caldav">CalDAV Server</option>
          <option value="ics">ICS/iCal URL</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="url">
          {formData.sourceType === 'ics' ? 'ICS URL' : 'CalDAV URL'}
        </label>
        <input
          type="url"
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          placeholder={
            formData.sourceType === 'ics'
              ? 'https://example.com/calendar.ics'
              : 'https://caldav.example.com/calendar'
          }
          required
        />
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            name="requiresAuth"
            checked={formData.requiresAuth}
            onChange={handleChange}
          />
          <span>Requires Authentication</span>
        </label>
      </div>

      {formData.requiresAuth && (
        <>
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
        </>
      )}

      <div className="form-group checkbox-group">
        <label>
          <input
            type="checkbox"
            name="enabled"
            checked={formData.enabled}
            onChange={handleChange}
          />
          <span>Enable this source</span>
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}
      {testResult === 'success' && <div className="success-message">Connection successful!</div>}

      {calendars.length > 0 && (
        <div className="form-group">
          <label>Individual Calendars ({enabledCount} of {calendars.length} enabled)</label>
          <div className="individual-calendars-list">
            {calendars.map((calendar) => (
              <div key={calendar.id} className="individual-calendar-item">
                <div className="calendar-item-controls">
                  <input
                    type="checkbox"
                    checked={calendar.enabled}
                    onChange={() => handleCalendarToggle(calendar.id)}
                    title="Enable/disable this calendar"
                  />
                  <input
                    type="color"
                    value={calendar.color}
                    onChange={(e) => handleCalendarColorChange(calendar.id, e.target.value)}
                    className="calendar-color-picker"
                    title="Calendar color"
                  />
                  <input
                    type="text"
                    value={calendar.name}
                    onChange={(e) => handleCalendarNameChange(calendar.id, e.target.value)}
                    className="calendar-name-input"
                    placeholder="Calendar name"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={
            testing ||
            !formData.url ||
            (formData.requiresAuth && (!formData.username || !formData.password))
          }
          className="btn btn-secondary"
        >
          {testing ? 'Testing...' : calendars.length > 0 ? 'Refresh Calendars' : 'Test Connection'}
        </button>
        <div className="button-group">
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {initialData ? 'Update' : 'Add'} Source
          </button>
        </div>
      </div>
    </form>
  );
};
