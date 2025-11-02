import { useState, useEffect } from 'react';

interface CalendarDimensions {
  calendarHeight: number;
  slotDuration: string;
  slotHeight: number;
}

// Constants for height calculations
const HEADER_HEIGHT = 96; // Custom header height (includes padding)
const MIN_SLOT_HEIGHT = 40; // Minimum height per time slot in pixels
const FC_CHROME_HEIGHT = 80; // FullCalendar internal chrome (headers, all-day slot, scrollbars, etc.)

// Time range: 6am to 10pm = 16 hours = 960 minutes
const TOTAL_MINUTES = 16 * 60;

// Available slot durations in minutes (largest to smallest for best fit)
const SLOT_OPTIONS = [120, 60, 30, 15];

/**
 * Custom hook to calculate optimal calendar height and slot duration
 * based on available viewport space
 */
export const useCalendarHeight = (): CalendarDimensions => {
  const [dimensions, setDimensions] = useState<CalendarDimensions>({
    calendarHeight: 600,
    slotDuration: '00:30:00',
    slotHeight: 40,
  });

  useEffect(() => {
    const calculateDimensions = () => {
      // Calculate available height for the calendar (subtract custom header)
      const viewportHeight = window.innerHeight;
      const availableHeight = viewportHeight - HEADER_HEIGHT;

      // Find the largest slot duration that fits without overflow
      let optimalSlotMinutes = 15; // Default to smallest

      for (const slotMinutes of SLOT_OPTIONS) {
        const slotsNeeded = TOTAL_MINUTES / slotMinutes;
        const estimatedHeight = slotsNeeded * MIN_SLOT_HEIGHT;

        if (estimatedHeight <= availableHeight) {
          optimalSlotMinutes = slotMinutes;
          break;
        }
      }

      // Calculate dynamic slot height based on available space
      // Subtract FullCalendar chrome to ensure all slots fit with equal height
      const numberOfSlots = TOTAL_MINUTES / optimalSlotMinutes;
      const heightForSlots = availableHeight - FC_CHROME_HEIGHT;
      const calculatedSlotHeight = Math.floor(heightForSlots / numberOfSlots);

      // Convert minutes to FullCalendar time format (HH:MM:SS)
      const hours = Math.floor(optimalSlotMinutes / 60);
      const minutes = optimalSlotMinutes % 60;
      const slotDuration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

      setDimensions({
        calendarHeight: Math.max(400, availableHeight), // Minimum 400px
        slotDuration,
        slotHeight: Math.max(MIN_SLOT_HEIGHT, calculatedSlotHeight), // Ensure minimum height
      });
    };

    // Calculate on mount
    calculateDimensions();

    // Debounced resize handler
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(calculateDimensions, 300);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return dimensions;
};
