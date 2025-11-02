import React, { useState } from 'react';
import { useCalendar } from '../contexts/CalendarContext';
import { CalendarForm } from './CalendarForm';
import type { CalendarSource } from '../types';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { sources, addSource, updateSource, removeSource } = useCalendar();
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<CalendarSource | null>(null);

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

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Calendar Management</h1>
        <button onClick={onClose} className="btn btn-secondary">
          Back to Kiosk View
        </button>
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
                {sources.map(source => (
                  <div key={source.id} className={`calendar-item ${!source.enabled ? 'disabled' : ''}`}>
                    <div className="calendar-info">
                      <div className="calendar-details">
                        <h3>{source.name}</h3>
                        <p className="calendar-url">{source.url}</p>
                        <p className="calendar-username">Username: {source.username}</p>
                        {source.calendars.length > 0 && (
                          <div className="source-calendars-preview">
                            <p className="calendar-meta">
                              {source.calendars.filter(c => c.enabled).length} of {source.calendars.length} calendars enabled:
                            </p>
                            <div className="calendar-colors-preview">
                              {source.calendars.filter(c => c.enabled).slice(0, 5).map(cal => (
                                <span
                                  key={cal.id}
                                  className="color-dot"
                                  style={{ backgroundColor: cal.color }}
                                  title={cal.name}
                                />
                              ))}
                              {source.calendars.filter(c => c.enabled).length > 5 && (
                                <span className="more-calendars">+{source.calendars.filter(c => c.enabled).length - 5}</span>
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
