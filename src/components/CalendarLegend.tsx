import React from 'react';
import type { CalendarSource } from '../types';

interface CalendarLegendProps {
  sources: CalendarSource[];
}

export const CalendarLegend: React.FC<CalendarLegendProps> = ({ sources }) => {
  const enabledSources = sources.filter(s => s.enabled);

  if (enabledSources.length === 0) {
    return null;
  }

  return (
    <div className="calendar-legend">
      {enabledSources.map(source => (
        <div key={source.id} className="legend-item">
          <span
            className="legend-color"
            style={{ backgroundColor: source.color }}
          />
          <span className="legend-name">{source.name}</span>
          {source.fetchError && (
            <span className="legend-error" title={source.fetchError}>⚠</span>
          )}
        </div>
      ))}
    </div>
  );
};
