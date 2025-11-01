import React, { useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useCalendar } from '../contexts/CalendarContext';
import { CalendarLegend } from './CalendarLegend';

interface CalendarProps {
  onAdminClick: () => void;
}

export const Calendar: React.FC<CalendarProps> = ({ onAdminClick }) => {
  const { sources, events, loading, error, fetchAllEvents } = useCalendar();
  const calendarRef = useRef<FullCalendar>(null);

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
      <div className="calendar-header">
        <h1>Calendar</h1>
        <div className="header-actions">
          <CalendarLegend sources={sources} />
          <button
            onClick={onAdminClick}
            className="btn btn-secondary admin-button"
            title="Open settings (or press Ctrl+Shift+A)"
          >
            Settings
          </button>
        </div>
      </div>

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

      <div className="calendar-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          firstDay={0} // Sunday
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={true}
          expandRows={true}
          height="auto"
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
    </div>
  );
};
