import React from 'react';
import type { CalendarSource, Calendar } from '../types';

interface CalendarLegendProps {
  sources: CalendarSource[];
}

export const CalendarLegend: React.FC<CalendarLegendProps> = ({ sources }) => {
  // Collect all enabled calendars from all enabled sources
  const activeCalendars: Array<Calendar & { sourceName: string; sourceError?: string }> = [];

  sources.forEach(source => {
    if (source.enabled) {
      source.calendars.forEach(calendar => {
        if (calendar.enabled) {
          activeCalendars.push({
            ...calendar,
            sourceName: source.name,
            sourceError: source.fetchError,
          });
        }
      });
    }
  });

  if (activeCalendars.length === 0) {
    return null;
  }

  return (
    <div className="calendar-legend">
      {activeCalendars.map((calendar) => (
        <div key={calendar.id} className="legend-item">
          <span
            className="legend-color"
            style={{ backgroundColor: calendar.color }}
          />
          <span className="legend-name">{calendar.name}</span>
          <span className="legend-source">({calendar.sourceName})</span>
          {calendar.sourceError && (
            <span className="legend-error" title={calendar.sourceError}>⚠</span>
          )}
        </div>
      ))}
    </div>
  );
};
