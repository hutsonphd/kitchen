import React, { useMemo } from 'react';
import type { CalendarEvent } from '../types';

interface TodayEventsProps {
  events: CalendarEvent[];
}

export const TodayEvents: React.FC<TodayEventsProps> = ({ events }) => {
  const todayEvents = useMemo(() => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    return events
      .filter(event => {
        const eventStart = new Date(event.start);

        // For all-day events, use date-only comparison to avoid timezone issues
        if (event.allDay) {
          const eventYear = eventStart.getFullYear();
          const eventMonth = eventStart.getMonth();
          const eventDay = eventStart.getDate();

          return eventYear === todayYear && eventMonth === todayMonth && eventDay === todayDay;
        }

        // For timed events, use standard midnight comparison
        const eventStartMidnight = new Date(eventStart);
        eventStartMidnight.setHours(0, 0, 0, 0);
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);

        return eventStartMidnight.getTime() === todayMidnight.getTime();
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events]);

  const formatTime = (date: Date, timezone?: string) => {
    if (!timezone) {
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date(date));
    }

    try {
      // Format time in the original timezone
      const timeStr = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
      }).format(new Date(date));

      // Get timezone abbreviation
      const tzAbbr = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      }).formatToParts(new Date(date)).find(part => part.type === 'timeZoneName')?.value || '';

      return `${timeStr} ${tzAbbr}`;
    } catch (error) {
      // If timezone is invalid, fall back to local time
      return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(new Date(date));
    }
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
              style={{
                borderLeftColor: event.color,
                background: `color-mix(in srgb, ${event.color} 20%, transparent)`
              }}
            >
              <div className="event-time">
                {event.allDay ? (
                  <span className="all-day-badge">All Day</span>
                ) : (
                  <>
                    {formatTime(event.start, event.originalTimezone || event.timezone)} - {formatTime(event.end, event.originalTimezone || event.timezone)}
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
