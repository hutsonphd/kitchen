import React, { useMemo } from 'react';
import type { CalendarEvent } from '../types';

interface TodayEventsProps {
  events: CalendarEvent[];
}

export const TodayEvents: React.FC<TodayEventsProps> = ({ events }) => {
  const todayEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return events
      .filter(event => {
        const eventStart = new Date(event.start);
        eventStart.setHours(0, 0, 0, 0);
        return eventStart.getTime() === today.getTime();
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events]);

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(date));
  };

  const isElapsed = (event: CalendarEvent) => {
    return new Date(event.end) < new Date();
  };

  return (
    <div className="today-events-panel">
      <h2 className="today-events-title">
        <strong>Today's</strong> Events
      </h2>
      <div className="today-events-list">
        {todayEvents.length === 0 ? (
          <div className="no-events-message">No events scheduled for today</div>
        ) : (
          todayEvents.map(event => (
            <div
              key={event.id}
              className={`today-event-card ${isElapsed(event) ? 'elapsed' : ''}`}
              style={{ borderLeftColor: event.color }}
            >
              <div className="event-time">
                {event.allDay ? (
                  <span className="all-day-badge">All Day</span>
                ) : (
                  <>
                    {formatTime(event.start)} - {formatTime(event.end)}
                  </>
                )}
              </div>
              <div className="event-title">{event.title}</div>
              {event.location && (
                <div className="event-location">
                  <span className="event-label">Location:</span> {event.location}
                </div>
              )}
              {event.description && (
                <div className="event-description">
                  <span className="event-label">Description:</span> {event.description}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
