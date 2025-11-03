# Backend Server Documentation

## Overview
Express.js proxy server for CalDAV protocol communication, ICS processing, and recurring event handling.

**Port:** 3001
**Technology:** Node.js + Express (ES modules)
**Primary Role:** CalDAV proxy and ICS data processor

---

## Directory Structure

```
server/
├── src/
│   ├── server.js                    # Main Express application
│   └── __tests__/
│       └── recurring-events.test.js # Jest tests for RRULE expansion
│
├── package.json                      # Dependencies and scripts
├── jest.config.js                    # Jest configuration
└── Dockerfile                        # Backend container config
```

---

## Development Commands

```bash
npm run start           # Production server (node src/server.js)
npm run dev             # Development with --watch flag
npm run test            # Run Jest test suite
```

---

## API Endpoints

### GET /api/calendars
**Description:** Fetch available calendars from CalDAV server

**Query Parameters:**
- `serverUrl` (required) - CalDAV server URL
- `username` (required) - CalDAV username
- `password` (required) - CalDAV password

**Response:**
```json
[
  {
    "url": "https://...",
    "displayName": "Personal Calendar",
    "ctag": "...",
    "syncToken": "..."
  }
]
```

**Error Handling:**
- 500: CalDAV server connection failed
- 400: Missing required parameters

---

### GET /api/events
**Description:** Fetch events from specific calendar with recurring event expansion

**Query Parameters:**
- `serverUrl` (required) - CalDAV server URL
- `username` (required) - CalDAV username
- `password` (required) - CalDAV password
- `calendarUrl` (required) - Specific calendar URL
- `start` (optional) - ISO date string for range start
- `end` (optional) - ISO date string for range end

**Response:**
```json
[
  {
    "id": "event-uid",
    "title": "Event Title",
    "start": "2025-11-02T10:00:00Z",
    "end": "2025-11-02T11:00:00Z",
    "description": "...",
    "location": "...",
    "calendarId": "...",
    "recurrenceRule": "FREQ=DAILY;COUNT=5",
    "timezone": "America/New_York"
  }
]
```

**Features:**
- Expands recurring events (RRULE) into individual occurrences
- Preserves timezone information
- Handles EXDATE (excluded dates)
- Processes VTIMEZONE definitions

---

### POST /api/events
**Description:** Create new calendar event

**Request Body:**
```json
{
  "serverUrl": "https://...",
  "username": "...",
  "password": "...",
  "calendarUrl": "...",
  "event": {
    "title": "New Event",
    "start": "2025-11-02T10:00:00Z",
    "end": "2025-11-02T11:00:00Z",
    "description": "...",
    "location": "...",
    "timezone": "America/New_York",
    "recurrenceRule": "FREQ=WEEKLY;BYDAY=MO,WE,FR"
  }
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "generated-uid"
}
```

**Features:**
- Generates proper VEVENT structure
- Handles RRULE formatting
- Creates VTIMEZONE components
- Validates event data

---

### DELETE /api/events/:eventId
**Description:** Delete calendar event

**URL Parameters:**
- `eventId` - UID of event to delete

**Query Parameters:**
- `serverUrl` (required)
- `username` (required)
- `password` (required)
- `calendarUrl` (required)

**Response:**
```json
{
  "success": true
}
```

---

## Core Functionality

### CalDAV Client (tsdav)
```javascript
import { createDAVClient } from 'tsdav';

const client = await createDAVClient({
  serverUrl,
  credentials: {
    username,
    password
  },
  authMethod: 'Basic',
  defaultAccountType: 'caldav'
});
```

**Operations:**
- Fetch calendar home set
- Query calendar collections
- Retrieve calendar objects (ICS data)
- Create/update/delete events

---

### ICS Processing (ical.js)
```javascript
import ICAL from 'ical.js';

// Parse ICS data
const jcalData = ICAL.parse(icsString);
const comp = new ICAL.Component(jcalData);
const vevent = comp.getFirstSubcomponent('vevent');

// Extract event data
const event = new ICAL.Event(vevent);
const summary = event.summary;
const startDate = event.startDate;
const endDate = event.endDate;
```

**Capabilities:**
- Parse VCALENDAR/VEVENT structures
- Handle RRULE (recurrence rules)
- Process VTIMEZONE definitions
- Extract event properties
- Format dates with timezone awareness

---

### Recurring Event Expansion

**Algorithm:**
1. Parse RRULE from VEVENT
2. Get EXDATE (excluded occurrences)
3. Expand recurrence within date range
4. Filter out excluded dates
5. Create individual event objects for each occurrence

**Example RRULE Handling:**
```javascript
// Daily for 5 days
RRULE:FREQ=DAILY;COUNT=5

// Weekly on Monday, Wednesday, Friday
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR

// Monthly on the 15th
RRULE:FREQ=MONTHLY;BYMONTHDAY=15
```

**Testing:**
- Test suite: `server/src/__tests__/recurring-events.test.js`
- Covers: Daily, weekly, monthly recurrence
- Edge cases: EXDATE handling, timezone conversions

---

### Timezone Handling

**Preservation Strategy:**
1. Extract VTIMEZONE from ICS data
2. Parse timezone identifier (TZID)
3. Store with event data
4. Return timezone to frontend for display

**Supported Operations:**
- Parse IANA timezone identifiers (e.g., "America/New_York")
- Handle UTC offset calculations
- Preserve DST (daylight saving time) rules
- Convert between timezone representations

---

## Dependencies

### Core Dependencies
```json
{
  "express": "4.18.2",         // Web framework
  "tsdav": "2.1.6",            // CalDAV client
  "ical.js": "2.2.1",          // ICS parser
  "cors": "2.8.5",             // CORS middleware
  "node-fetch": "3.3.2"        // HTTP client
}
```

### Development Dependencies
```json
{
  "jest": "29.7.0",            // Testing framework
  "nodemon": "3.1.9"           // Dev file watcher
}
```

---

## Configuration

### CORS Configuration
```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
```

**Production:** Configure via environment variable
**Development:** Allows frontend at port 5173

---

### Environment Variables
```bash
PORT=3001                     # Server port
CORS_ORIGIN=http://...        # Allowed origin for CORS
NODE_ENV=production|development
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

### Error Types
- **400 Bad Request** - Missing or invalid parameters
- **401 Unauthorized** - CalDAV authentication failed
- **404 Not Found** - Calendar or event not found
- **500 Internal Server Error** - Server or CalDAV errors

### Error Logging
```javascript
console.error('[API Error]', error.message);
// Includes stack trace in development mode
```

---

## Testing

### Jest Configuration
```javascript
// jest.config.js
export default {
  testEnvironment: 'node',
  transform: {},
  testMatch: ['**/__tests__/**/*.test.js']
};
```

### Running Tests
```bash
npm run test                  # Run all tests
npm run test -- --watch      # Watch mode
npm run test -- --coverage   # Coverage report
```

### Test Coverage
- Recurring event expansion
- RRULE parsing
- Timezone handling
- EXDATE filtering
- Date range queries

---

## Recent Changes (Last 30 Days)

### New Features
- Full timezone support for events
- Recurring event expansion on server side
- Jest test suite added
- EXDATE handling for recurring events
- Improved error handling for CalDAV operations

### Updated Files
- `server.js` - Added timezone preservation, recurring event logic
- `package.json` - Added Jest dependency
- `jest.config.js` - Created test configuration
- `recurring-events.test.js` - Comprehensive test suite

### Bug Fixes
- CORS configuration for production
- CalDAV authentication error handling
- ICS parsing edge cases
- Timezone offset calculations

---

## Architecture Patterns

### Proxy Pattern
Server acts as intermediary between frontend and CalDAV server:
- Hides CalDAV credentials from frontend
- Simplifies CORS handling
- Enables server-side processing (RRULE expansion)
- Centralizes error handling

### Request Flow
```
Frontend (port 5173)
    ↓
    HTTP Request to /api/*
    ↓
Express Server (port 3001)
    ↓
    tsdav client
    ↓
CalDAV Server (external)
    ↓
    ICS data
    ↓
ical.js processing
    ↓
JSON response to frontend
```

---

## Security Considerations

### Credential Handling
- Credentials passed via query/body parameters
- Never logged or persisted on server
- Use HTTPS in production
- Consider implementing token-based auth

### Input Validation
- Sanitize all user inputs
- Validate date ranges
- Check URL formats
- Limit request sizes

### CORS Policy
- Restrict to specific origins in production
- Avoid wildcard (*) origins
- Use credentials: true only when necessary

---

## Deployment

### Docker Configuration
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3001
CMD ["npm", "start"]
```

### Docker Compose Integration
```yaml
backend:
  build: ./server
  ports:
    - "3001:3001"
  environment:
    - NODE_ENV=production
    - CORS_ORIGIN=http://frontend:80
```

---

## Performance Considerations

### Optimization Strategies
- Cache calendar metadata when possible
- Limit recurring event expansion range
- Use streaming for large ICS files
- Implement request rate limiting
- Consider implementing a caching layer

### Monitoring
- Log response times for CalDAV requests
- Track RRULE expansion performance
- Monitor memory usage for large events
- Alert on authentication failures

---

## Future Enhancements

### Potential Improvements
- Implement calendar caching with Redis
- Add WebSocket support for real-time sync
- Batch event operations
- Support for additional CalDAV features (invitations, attachments)
- Rate limiting and request throttling
- API documentation with Swagger/OpenAPI

---

**Last Updated:** 2025-11-02
**Backend Version:** 1.0
