import React, { useMemo, useEffect, useState } from 'react';
import type { CalendarEvent } from '../types';
import { useCalendar } from '../contexts/CalendarContext';
import { formatEventTime } from '../utils/timezone';

interface TodayEventsProps {
  events: CalendarEvent[];
}

export const TodayEvents: React.FC<TodayEventsProps> = React.memo(({ events }) => {
  const { uiSettings } = useCalendar();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute to refresh the list
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const todayEvents = useMemo(() => {
    const now = currentTime;
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDay = now.getDate();

    return events
      .filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        // Filter out events that have already ended
        if (eventEnd < now) {
          return false;
        }

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
  }, [events, currentTime]);


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
                    {formatEventTime(event.start, event.originalTimezone || event.timezone, uiSettings.displayTimezone)} - {formatEventTime(event.end, event.originalTimezone || event.timezone, uiSettings.displayTimezone)}
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
});
