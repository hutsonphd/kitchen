import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { IconSettings, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useCalendar } from '../contexts/CalendarContext';
import { useCalendarHeight } from '../hooks/useCalendarHeight';
import { TodayEvents } from './TodayEvents';
import { formatEventTime } from '../utils/timezone';

interface CalendarProps {
  onAdminClick: () => void;
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}


export const Calendar: React.FC<CalendarProps> = React.memo(({ onAdminClick }) => {
  const { sources, events, loading, lastSyncTime, isCacheData, fetchAllEvents, uiSettings, syncMetadata } = useCalendar();
  const calendarRef = useRef<FullCalendar>(null);
  const { calendarHeight, slotDuration, slotHeight } = useCalendarHeight();
  const [monthYear, setMonthYear] = useState('');

  // Track previous source IDs to detect when sources actually change (not just metadata updates)
  const prevSourceIdsRef = useRef<string>('');

  // Apply UI settings to CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty('--color-today-bg', uiSettings.todayColumnBgColor);
    document.documentElement.style.setProperty('--color-today-text', uiSettings.todayColumnTextColor);
  }, [uiSettings]);

  // Update month/year display (memoized to prevent recreation)
  const updateMonthYear = useCallback(() => {
    if (calendarRef.current) {
      const currentDate = calendarRef.current.getApi().view.currentStart;
      const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentDate);
      const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(currentDate);
      setMonthYear(`${month}|${year}`); // Using | as separator for later splitting
    }
  }, []);

  // Fetch events on mount and when sources change (by ID, not metadata)
  useEffect(() => {
    const currentSourceIds = sources.map(s => s.id).sort().join(',');

    // Only fetch if source IDs actually changed, not just lastFetched or other metadata
    if (currentSourceIds !== prevSourceIdsRef.current) {
      fetchAllEvents();
      prevSourceIdsRef.current = currentSourceIds;
    }
  }, [sources, fetchAllEvents]);

  // Navigate to current week and set initial month/year
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
      updateMonthYear();
    }
  }, [updateMonthYear]);

  // Navigation handlers
  const handlePrevWeek = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().prev();
      updateMonthYear();
    }
  };

  const handleNextWeek = () => {
    if (calendarRef.current) {
      calendarRef.current.getApi().next();
      updateMonthYear();
    }
  };

  const handleEventClick = (info: any) => {
    const event = info.event;
    const details = `
Title: ${event.title}
Start: ${event.start?.toLocaleString()}
End: ${event.end?.toLocaleString()}
${event.extendedProps.description ? `\nDescription: ${event.extendedProps.description}` : ''}
${event.extendedProps.location ? `\nLocation: ${event.extendedProps.location}` : ''}
    `.trim();

    alert(details);
  };

  // Convert CalendarEvent to FullCalendar event format
  // Memoized to prevent recreating event objects on every render
  const fullCalendarEvents = useMemo(() =>
    events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      backgroundColor: event.color || uiSettings.defaultEventBgColor,
      borderColor: event.color, // Use calendar color for border
      textColor: uiSettings.defaultEventTextColor,
      extendedProps: {
        description: event.description,
        location: event.location,
        calendarId: event.calendarId,
        timezone: event.originalTimezone || event.timezone, // Store timezone for display
        originalStart: event.start, // Keep original dates for timezone conversion
      },
    })),
    [events, uiSettings.defaultEventBgColor, uiSettings.defaultEventTextColor]
  );

  return (
    <div className="calendar-layout">
      {/* Custom Header - shared across both columns */}
      <div className="custom-calendar-header">
        <h1 className="month-year-title">
          {monthYear.split('|').map((part, i) =>
            i === 0 ? <strong key={i}>{part}</strong> : <span key={i}> {part}</span>
          )}
        </h1>
        <div className="header-controls">
          {/* Sync status and loading indicator */}
          {(() => {
            // Show loading state when syncing
            if (loading) {
              // Check if any source is retrying
              const retryingSource = syncMetadata.find(m =>
                !m.lastSyncSuccess && m.retryCount > 0 && m.retryCount < m.maxRetries
              );

              if (retryingSource) {
                return (
                  <div className="header-status">
                    <div className="loading-spinner-small"></div>
                    <span>Syncing... (Attempt {retryingSource.retryCount}/{retryingSource.maxRetries})</span>
                  </div>
                );
              }

              return (
                <div className="header-status">
                  <div className="loading-spinner-small"></div>
                  <span>{isCacheData ? 'Updating...' : 'Loading...'}</span>
                </div>
              );
            }

            // Check for failed syncs that have exceeded retry limit
            const failedSource = syncMetadata.find(m =>
              !m.lastSyncSuccess && m.retryCount >= m.maxRetries
            );

            if (failedSource) {
              return (
                <div className="header-status error">
                  Sync failed after {failedSource.maxRetries} attempts
                </div>
              );
            }

            // Always show sync status when not loading
            if (lastSyncTime) {
              return (
                <div className="header-status">
                  Last synced: {formatTimeAgo(lastSyncTime)}
                </div>
              );
            }

            // Show if never synced
            return (
              <div className="header-status">
                Never synced
              </div>
            );
          })()}

          <button
            onClick={handlePrevWeek}
            className="nav-button"
            title="Previous week"
            aria-label="Previous week"
          >
            <IconChevronLeft size={24} />
          </button>
          <button
            onClick={handleNextWeek}
            className="nav-button"
            title="Next week"
            aria-label="Next week"
          >
            <IconChevronRight size={24} />
          </button>
          <button
            onClick={onAdminClick}
            className="nav-button"
            title="Open settings (or press Ctrl+Shift+A)"
            aria-label="Settings"
          >
            <IconSettings size={24} />
          </button>
        </div>
      </div>

      <div className="calendar-main-content">
        <TodayEvents events={events} />

        <div className="calendar-container">
          <style>
            {`.fc .fc-timegrid-slot { height: ${slotHeight}px !important; }`}
          </style>

          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={false}
            firstDay={0} // Sunday
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            slotDuration={slotDuration}
            allDaySlot={true}
            expandRows={false}
            height={calendarHeight}
            eventMinHeight={slotHeight} // Minimum event height = 60 minutes
            events={fullCalendarEvents}
            eventClick={handleEventClick}
            nowIndicator={true}
            weekNumbers={false}
            dayMaxEvents={true}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              meridiem: 'short'
            }}
            dayHeaderContent={(args) => {
              const dayName = args.date.toLocaleDateString('en-US', { weekday: 'short' });
              const dayNum = args.date.getDate();
              const today = new Date();
              const isToday = args.date.toDateString() === today.toDateString();

              return {
                html: `<div class="day-header-content">
              <strong>${dayName}</strong> <span class="${isToday ? 'today-number-highlight' : ''}">${dayNum}</span>
            </div>`
              };
            }}
            eventDidMount={(info) => {
              const now = new Date();
              if (info.event.end && new Date(info.event.end) < now) {
                info.el.classList.add('elapsed-calendar-event');
              }
            }}
            eventContent={(eventInfo) => {
              const { event } = eventInfo;
              const timezone = event.extendedProps.timezone;
              const originalStart = event.extendedProps.originalStart;

              // For all-day events, just show the title
              if (event.allDay) {
                return {
                  html: `<div class="fc-event-title">${event.title}</div>`
                };
              }

              // For timed events, show time in display timezone
              if (timezone && originalStart) {
                const timeStr = formatEventTime(new Date(originalStart), timezone, uiSettings.displayTimezone, false);
                return {
                  html: `
                    <div class="fc-event-time">${timeStr}</div>
                    <div class="fc-event-title">${event.title}</div>
                  `
                };
              }

              // Fallback to default rendering
              return null;
            }}
          />
        </div>
      </div>
    </div>
  );
});
