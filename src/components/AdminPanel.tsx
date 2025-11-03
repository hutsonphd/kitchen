import React, { useState } from 'react';
import { useCalendar } from '../contexts/CalendarContext';
import { CalendarForm } from './CalendarForm';
import { SlideshowAdmin } from './SlideshowAdmin';
import type { CalendarSource } from '../types';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { sources, addSource, updateSource, removeSource, uiSettings, updateUISettings, fetchAllEvents, lastSyncTime, loading, clearAllEvents, resetEverything } = useCalendar();
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<CalendarSource | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleAddNew = () => {
    setEditingSource(null);
    setShowForm(true);
  };

  const handleEdit = (source: CalendarSource) => {
    setEditingSource(source);
    setShowForm(true);
  };

  const handleFormSubmit = (data: Omit<CalendarSource, 'id'>) => {
    if (editingSource) {
      updateSource(editingSource.id, data);
    } else {
      addSource(data);
    }
    setShowForm(false);
    setEditingSource(null);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingSource(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this calendar source?')) {
      removeSource(id);
    }
  };

  const handleToggleEnabled = (source: CalendarSource) => {
    updateSource(source.id, { enabled: !source.enabled });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await fetchAllEvents(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAllEvents = () => {
    if (confirm('Are you sure you want to clear all cached events? Calendar sources will be kept, and events will re-sync on next refresh.')) {
      clearAllEvents();
    }
  };

  const handleResetEverything = () => {
    if (confirm('Are you sure you want to reset everything? This will delete all calendar sources and events. This action cannot be undone.')) {
      resetEverything();
      setShowForm(false);
      setEditingSource(null);
    }
  };

  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';
    const now = new Date();
    const diff = now.getTime() - new Date(lastSyncTime).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return new Date(lastSyncTime).toLocaleString();
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Calendar Management</h1>
        <div className="header-controls">
          <div className="sync-status">
            <span className="sync-label">Last sync:</span>
            <span className="sync-time">{formatLastSyncTime()}</span>
            {(loading || isSyncing) && <span className="sync-indicator">Syncing...</span>}
          </div>
          <button
            onClick={handleManualSync}
            className="btn btn-primary"
            disabled={isSyncing || loading}
          >
            {isSyncing || loading ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Back to Kiosk View
          </button>
        </div>
      </div>

      <div className="admin-content">
        {showForm ? (
          <div className="form-section">
            <h2>{editingSource ? 'Edit Calendar' : 'Add New Calendar'}</h2>
            <CalendarForm
              initialData={editingSource || undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleFormCancel}
            />
          </div>
        ) : (
          <>
            <div className="calendars-header">
              <h2>Calendar Sources</h2>
              <button onClick={handleAddNew} className="btn btn-primary">
                Add Calendar
              </button>
            </div>

            {sources.length === 0 ? (
              <div className="empty-state">
                <p>No calendars configured yet.</p>
                <button onClick={handleAddNew} className="btn btn-primary">
                  Add Your First Calendar
                </button>
              </div>
            ) : (
              <div className="calendars-list">
                {sources.map(source => {
                  // Filter enabled calendars once to avoid redundant filtering
                  const enabledCalendars = source.calendars.filter(c => c.enabled);

                  return (
                    <div key={source.id} className={`calendar-item ${!source.enabled ? 'disabled' : ''}`}>
                      <div className="calendar-info">
                        <div className="calendar-details">
                          <h3>{source.name}</h3>
                          <p className="calendar-url">{source.url}</p>
                          <p className="calendar-username">Username: {source.username}</p>
                          {source.calendars.length > 0 && (
                            <div className="source-calendars-preview">
                              <p className="calendar-meta">
                                {enabledCalendars.length} of {source.calendars.length} calendars enabled:
                              </p>
                              <div className="calendar-colors-preview">
                                {enabledCalendars.slice(0, 5).map(cal => (
                                  <span
                                    key={cal.id}
                                    className="color-dot"
                                    style={{ backgroundColor: cal.color }}
                                    title={cal.name}
                                  />
                                ))}
                                {enabledCalendars.length > 5 && (
                                  <span className="more-calendars">+{enabledCalendars.length - 5}</span>
                                )}
                              </div>
                            </div>
                          )}
                        {source.lastFetched && (
                          <p className="calendar-meta">
                            Last updated: {new Date(source.lastFetched).toLocaleString()}
                          </p>
                        )}
                        {source.fetchError && (
                          <p className="calendar-error">Error: {source.fetchError}</p>
                        )}
                      </div>
                    </div>
                    <div className="calendar-actions">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={source.enabled}
                          onChange={() => handleToggleEnabled(source)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      <button
                        onClick={() => handleEdit(source)}
                        className="btn btn-small btn-secondary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="btn btn-small btn-danger"
                      >
                        Delete
                      </button>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Display Settings Section */}
            {!showForm && (
              <div className="settings-section">
                <h2>Display Settings</h2>
                <div className="settings-grid">
                  <div className="setting-item">
                    <label htmlFor="displayTimezone">Display Timezone</label>
                    <select
                      id="displayTimezone"
                      value={uiSettings.displayTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
                      onChange={(e) => updateUISettings({
                        ...uiSettings,
                        displayTimezone: e.target.value
                      })}
                      style={{ minWidth: '15rem' }}
                    >
                      <option value="">Auto-detect ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
                      <option value="America/New_York">Eastern Time (US)</option>
                      <option value="America/Chicago">Central Time (US)</option>
                      <option value="America/Denver">Mountain Time (US)</option>
                      <option value="America/Los_Angeles">Pacific Time (US)</option>
                      <option value="America/Phoenix">Arizona</option>
                      <option value="America/Anchorage">Alaska</option>
                      <option value="Pacific/Honolulu">Hawaii</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Europe/Berlin">Berlin</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                      <option value="Asia/Shanghai">Shanghai</option>
                      <option value="Asia/Dubai">Dubai</option>
                      <option value="Australia/Sydney">Sydney</option>
                    </select>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="todayColumnBg">Today Column Background</label>
                    <input
                      type="color"
                      id="todayColumnBg"
                      value={rgbaToHex(uiSettings.todayColumnBgColor)}
                      onChange={(e) => updateUISettings({
                        ...uiSettings,
                        todayColumnBgColor: hexToRgba(e.target.value, 0.15)
                      })}
                    />
                    <span className="color-value">{uiSettings.todayColumnBgColor}</span>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="todayColumnText">Today Column Text Color</label>
                    <input
                      type="color"
                      id="todayColumnText"
                      value={uiSettings.todayColumnTextColor}
                      onChange={(e) => updateUISettings({
                        ...uiSettings,
                        todayColumnTextColor: e.target.value
                      })}
                    />
                    <span className="color-value">{uiSettings.todayColumnTextColor}</span>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="defaultEventBg">Default Event Background</label>
                    <input
                      type="color"
                      id="defaultEventBg"
                      value={uiSettings.defaultEventBgColor}
                      onChange={(e) => updateUISettings({
                        ...uiSettings,
                        defaultEventBgColor: e.target.value
                      })}
                    />
                    <span className="color-value">{uiSettings.defaultEventBgColor}</span>
                  </div>

                  <div className="setting-item">
                    <label htmlFor="defaultEventText">Default Event Text Color</label>
                    <input
                      type="color"
                      id="defaultEventText"
                      value={uiSettings.defaultEventTextColor}
                      onChange={(e) => updateUISettings({
                        ...uiSettings,
                        defaultEventTextColor: e.target.value
                      })}
                    />
                    <span className="color-value">{uiSettings.defaultEventTextColor}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Slideshow Settings Section */}
            {!showForm && (
              <SlideshowAdmin />
            )}

            {/* Data Management Section */}
            {!showForm && (
              <div className="settings-section">
                <h2>Data Management</h2>
                <div className="data-management-actions">
                  <div className="action-item">
                    <div className="action-description">
                      <h3>Clear All Events</h3>
                      <p>Remove all cached events but keep calendar sources. Events will re-sync on next refresh.</p>
                    </div>
                    <button
                      onClick={handleClearAllEvents}
                      className="btn btn-secondary"
                    >
                      Clear Events
                    </button>
                  </div>
                  <div className="action-item">
                    <div className="action-description">
                      <h3>Reset Everything</h3>
                      <p>Delete all calendar sources and events. This will return the app to its initial state.</p>
                    </div>
                    <button
                      onClick={handleResetEverything}
                      className="btn btn-danger"
                    >
                      Reset Everything
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Helper functions to convert between rgba and hex
function rgbaToHex(rgba: string): string {
  // Extract RGB values from rgba string
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#3788d8'; // Default color

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
