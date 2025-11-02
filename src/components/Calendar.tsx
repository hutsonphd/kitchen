import React, { useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCalendar } from '../contexts/CalendarContext';
import { useCalendarHeight } from '../hooks/useCalendarHeight';

interface CalendarProps {
  onAdminClick: () => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onAdminClick }) => {
  const { sources, events, loading, error, fetchAllEvents } = useCalendar();
  const calendarRef = useRef<FullCalendar>(null);
  const { calendarHeight, slotDuration, slotHeight } = useCalendarHeight();

  // Fetch events on mount and when sources change
  useEffect(() => {
    fetchAllEvents();
  }, [sources]);

  // Navigate to current week
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.today();
    }
  }, []);

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
  const fullCalendarEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    backgroundColor: event.backgroundColor,
    borderColor: event.borderColor,
    extendedProps: {
      description: event.description,
      location: event.location,
      calendarId: event.calendarId,
    },
  }));

  return (
    <div className="calendar-container">
      {/* Floating settings button */}
      <button
        onClick={onAdminClick}
        className="floating-settings-button"
        title="Open settings (or press Ctrl+Shift+A)"
      >
        ⚙️
      </button>

      {error && (
        <div className="error-banner">
          Error: {error}
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading calendar data...</div>
        </div>
      )}

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
      />
    </div>
  );
};
