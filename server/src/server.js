import express from 'express';
import cors from 'cors';
import { createDAVClient } from 'tsdav';
import ICAL from 'ical.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CalDAV proxy server is running' });
});

// Test CalDAV connection
app.post('/api/caldav/test-connection', async (req, res) => {
  const { url, username, password } = req.body;

  if (!url || !username || !password) {
    return res.status(400).json({
      error: 'Missing required fields: url, username, password'
    });
  }

  try {
    console.log(`Testing connection to ${url} for user ${username}`);

    const client = await createDAVClient({
      serverUrl: url,
      credentials: {
        username,
        password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    const calendars = await client.fetchCalendars();

    console.log(`Successfully connected. Found ${calendars.length} calendar(s)`);

    // Map calendars to return just the display names
    const calendarList = calendars.map(cal => ({
      displayName: cal.displayName || 'Unnamed Calendar',
      url: cal.url
    }));

    res.json({
      success: true,
      calendars: calendarList,
      message: `Connected successfully. Found ${calendars.length} calendar(s).`
    });
  } catch (error) {
    console.error('CalDAV connection test failed:', error.message);
    res.status(500).json({
      error: `Failed to connect: ${error.message}`
    });
  }
});

// Fetch calendar events
app.post('/api/caldav/fetch-events', async (req, res) => {
  const { url, username, password, timeMin, timeMax, selectedCalendars } = req.body;

  if (!url || !username || !password) {
    return res.status(400).json({
      error: 'Missing required fields: url, username, password'
    });
  }

  try {
    console.log(`Fetching events from ${url} for user ${username}`);
    console.log(`Date range: ${timeMin} to ${timeMax}`);
    if (selectedCalendars && selectedCalendars.length > 0) {
      console.log(`Filtering to calendars: ${selectedCalendars.join(', ')}`);
    }

    const client = await createDAVClient({
      serverUrl: url,
      credentials: {
        username,
        password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    });

    const allCalendars = await client.fetchCalendars();

    if (allCalendars.length === 0) {
      console.log('No calendars found');
      return res.json({ events: [] });
    }

    // Filter calendars if selectedCalendars is provided
    const calendars = selectedCalendars && selectedCalendars.length > 0
      ? allCalendars.filter(cal => selectedCalendars.includes(cal.displayName || ''))
      : allCalendars;

    console.log(`Found ${allCalendars.length} calendar(s), using ${calendars.length} calendar(s)`);

    // Fetch events from selected/all calendars
    const events = [];

    for (const calendar of calendars) {
      try {
        console.log(`Fetching from calendar: ${calendar.displayName || 'Unnamed'}`);

        const calendarObjects = await client.fetchCalendarObjects({
          calendar,
          timeRange: timeMin && timeMax ? {
            start: timeMin,
            end: timeMax,
          } : undefined,
        });

        console.log(`  Found ${calendarObjects.length} calendar objects in "${calendar.displayName || 'Unnamed'}"`);

        // Parse iCalendar data
        for (const obj of calendarObjects) {
          try {
            if (!obj.data) continue;

            const jcalData = ICAL.parse(obj.data);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            for (const vevent of vevents) {
              const event = new ICAL.Event(vevent);

              // Check if this is a recurring event
              if (event.isRecurring()) {
                // Expand recurring events within the time range
                const startDate = timeMin ? ICAL.Time.fromJSDate(new Date(timeMin), true) : null;
                const endDate = timeMax ? ICAL.Time.fromJSDate(new Date(timeMax), true) : null;

                // Create an iterator to expand occurrences
                const expand = event.iterator(startDate);
                let next;
                let occurrenceCount = 0;
                const maxOccurrences = 1000; // Safety limit to prevent infinite loops

                while ((next = expand.next()) && occurrenceCount < maxOccurrences) {
                  // Stop if we've exceeded the end date
                  if (endDate && next.compare(endDate) > 0) {
                    break;
                  }

                  const occurrence = event.getOccurrenceDetails(next);

                  events.push({
                    id: `${event.uid}_${next.toUnixTime()}`,
                    title: event.summary || 'Untitled Event',
                    start: occurrence.startDate?.toJSDate(),
                    end: occurrence.endDate?.toJSDate(),
                    allDay: occurrence.startDate?.isDate || false,
                    description: event.description || '',
                    location: event.location || '',
                    calendarUrl: calendar.url,
                    calendarName: calendar.displayName || 'Unnamed Calendar',
                    isRecurring: true,
                  });

                  occurrenceCount++;
                }
              } else {
                // Non-recurring event - add as before
                events.push({
                  id: event.uid,
                  title: event.summary || 'Untitled Event',
                  start: event.startDate?.toJSDate(),
                  end: event.endDate?.toJSDate(),
                  allDay: event.startDate?.isDate || false,
                  description: event.description || '',
                  location: event.location || '',
                  calendarUrl: calendar.url,
                  calendarName: calendar.displayName || 'Unnamed Calendar',
                  isRecurring: false,
                });
              }
            }
          } catch (parseError) {
            console.error('Error parsing calendar object:', parseError.message);
          }
        }
      } catch (calendarError) {
        console.error(`Error fetching from calendar "${calendar.displayName || 'Unnamed'}":`, calendarError.message);
        // Continue with other calendars even if one fails
      }
    }

    console.log(`Successfully parsed ${events.length} total events from ${calendars.length} calendar(s)`);

    res.json({ events });
  } catch (error) {
    console.error('CalDAV fetch events failed:', error.message);
    res.status(500).json({
      error: `Failed to fetch events: ${error.message}`
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`CalDAV proxy server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
