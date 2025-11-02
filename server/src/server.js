import express from 'express';
import cors from 'cors';
import { createDAVClient } from 'tsdav';
import ICAL from 'ical.js';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Helper function to extract timezone from ICAL.Time
function extractTimezone(icalTime) {
  if (!icalTime) return null;
  // If it's a date-only (all-day event), no timezone
  if (icalTime.isDate) return null;
  // Get the timezone from the ICAL.Time object
  const zone = icalTime.zone;
  if (!zone) return null;
  // Return IANA timezone ID if available
  return zone.tzid || null;
}

// Helper function to parse ICS data and return events
async function parseICSData(icsData, calendarName, calendarUrl, timeMin, timeMax) {
  const events = [];

  try {
    const jcalData = ICAL.parse(icsData);
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
          const startTz = extractTimezone(occurrence.startDate);
          const endTz = extractTimezone(occurrence.endDate);

          events.push({
            id: `${event.uid}_${next.toUnixTime()}`,
            title: event.summary || 'Untitled Event',
            start: occurrence.startDate?.toJSDate(),
            end: occurrence.endDate?.toJSDate(),
            allDay: occurrence.startDate?.isDate || false,
            description: event.description || '',
            location: event.location || '',
            calendarUrl: calendarUrl,
            calendarName: calendarName,
            isRecurring: true,
            timezone: startTz,
            originalTimezone: startTz,
          });

          occurrenceCount++;
        }
      } else {
        // Non-recurring event
        const startTz = extractTimezone(event.startDate);
        const endTz = extractTimezone(event.endDate);

        events.push({
          id: event.uid,
          title: event.summary || 'Untitled Event',
          start: event.startDate?.toJSDate(),
          end: event.endDate?.toJSDate(),
          allDay: event.startDate?.isDate || false,
          description: event.description || '',
          location: event.location || '',
          calendarUrl: calendarUrl,
          calendarName: calendarName,
          isRecurring: false,
          timezone: startTz,
          originalTimezone: startTz,
        });
      }
    }
  } catch (parseError) {
    console.error('Error parsing ICS data:', parseError.message);
    throw parseError;
  }

  return events;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CalDAV proxy server is running' });
});

// Test CalDAV connection
app.post('/api/caldav/test-connection', async (req, res) => {
  const { url, username, password, sourceType, requiresAuth } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Missing required field: url'
    });
  }

  // Validate auth requirements
  if (requiresAuth && (!username || !password)) {
    return res.status(400).json({
      error: 'Missing required fields: username, password (required for authenticated sources)'
    });
  }

  try {
    // Handle .ics URL type
    if (sourceType === 'ics') {
      console.log(`Testing .ics URL: ${url}`);

      const response = await fetch(url, {
        headers: requiresAuth ? {
          'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
        } : {}
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const icsData = await response.text();

      // Validate it's valid ICS data
      try {
        ICAL.parse(icsData);
      } catch (parseError) {
        throw new Error('Invalid ICS data format');
      }

      console.log('Successfully validated .ics URL');

      return res.json({
        success: true,
        calendars: [{
          displayName: 'Calendar',
          url: url
        }],
        message: 'Connected successfully to .ics URL'
      });
    }

    // Handle CalDAV type
    console.log(`Testing CalDAV connection to ${url}${requiresAuth ? ` for user ${username}` : ' (public)'}`);

    const clientConfig = {
      serverUrl: url,
      defaultAccountType: 'caldav',
    };

    // Add auth if required
    if (requiresAuth) {
      clientConfig.credentials = {
        username,
        password,
      };
      clientConfig.authMethod = 'Basic';
    }

    const client = await createDAVClient(clientConfig);

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
    console.error('Connection test failed:', error.message);
    res.status(500).json({
      error: `Failed to connect: ${error.message}`
    });
  }
});

// Fetch calendar events
app.post('/api/caldav/fetch-events', async (req, res) => {
  const { url, username, password, timeMin, timeMax, selectedCalendars, sourceType, requiresAuth } = req.body;

  if (!url) {
    return res.status(400).json({
      error: 'Missing required field: url'
    });
  }

  // Validate auth requirements
  if (requiresAuth && (!username || !password)) {
    return res.status(400).json({
      error: 'Missing required fields: username, password (required for authenticated sources)'
    });
  }

  try {
    const events = [];

    // Handle .ics URL type
    if (sourceType === 'ics') {
      console.log(`Fetching events from .ics URL: ${url}`);
      console.log(`Date range: ${timeMin} to ${timeMax}`);

      const response = await fetch(url, {
        headers: requiresAuth ? {
          'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
        } : {}
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const icsData = await response.text();
      const parsedEvents = await parseICSData(icsData, 'Calendar', url, timeMin, timeMax);
      events.push(...parsedEvents);

      console.log(`Successfully parsed ${events.length} events from .ics URL`);

      return res.json({ events });
    }

    // Handle CalDAV type
    console.log(`Fetching events from CalDAV: ${url}${requiresAuth ? ` for user ${username}` : ' (public)'}`);
    console.log(`Date range: ${timeMin} to ${timeMax}`);
    if (selectedCalendars && selectedCalendars.length > 0) {
      console.log(`Filtering to calendars: ${selectedCalendars.join(', ')}`);
    }

    const clientConfig = {
      serverUrl: url,
      defaultAccountType: 'caldav',
    };

    // Add auth if required
    if (requiresAuth) {
      clientConfig.credentials = {
        username,
        password,
      };
      clientConfig.authMethod = 'Basic';
    }

    const client = await createDAVClient(clientConfig);

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

        // Parse iCalendar data using helper function
        for (const obj of calendarObjects) {
          try {
            if (!obj.data) continue;

            const parsedEvents = await parseICSData(
              obj.data,
              calendar.displayName || 'Unnamed Calendar',
              calendar.url,
              timeMin,
              timeMax
            );
            events.push(...parsedEvents);
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
    console.error('Fetch events failed:', error.message);
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
