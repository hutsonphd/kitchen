# Frontend Source Documentation

## Directory Structure

```
src/
├── components/              # React UI components
│   ├── Calendar.tsx        # Main calendar display (FullCalendar)
│   ├── CalendarForm.tsx    # Event creation/editing form
│   ├── AdminPanel.tsx      # Admin control panel
│   ├── TodayEvents.tsx     # Today's events display
│   └── CalendarLegend.tsx  # Calendar color legend
│
├── services/               # Data services and API clients
│   ├── caldav.service.ts   # CalDAV protocol client (tsdav)
│   ├── indexeddb.service.ts# IndexedDB persistence
│   └── sync.service.ts     # Sync orchestration
│
├── contexts/               # React Context providers
│   └── CalendarContext.tsx # Global calendar state management
│
├── hooks/                  # Custom React hooks
│   └── useCalendarHeight.ts# Responsive calendar height
│
├── types/                  # TypeScript definitions
│   ├── calendar.types.ts   # Calendar events, VEVENT, recurrence
│   ├── indexeddb.types.ts  # Database schema
│   ├── settings.types.ts   # App settings and configuration
│   └── index.ts            # Type exports
│
├── utils/                  # Utility functions
│   └── storage.ts          # Local storage helpers
│
├── assets/                 # Static assets (currently empty)
│
├── App.tsx                 # Root component (kiosk/admin toggle)
├── main.tsx                # React entry point
├── App.css                 # App-level styles
├── index.css               # Global base styles
├── theme.css               # CSS variables and theme
└── fonts.css               # Font face declarations
```

---

## Component Guidelines

### Styling Rules
- **Never add borders** unless explicitly requested
- **Always use rem for sizes**, never px
- Use CSS variables from `theme.css`
- Primary font: Outfit (with custom font fallbacks)

### Component Patterns
```typescript
// Functional components with TypeScript
interface ComponentProps {
  propName: string;
}

export const Component: React.FC<ComponentProps> = ({ propName }) => {
  // Use hooks
  const { state } = useCalendarContext();

  return <div>{/* JSX */}</div>;
};
```

### Component Responsibilities

#### Calendar.tsx
- Renders FullCalendar with daygrid and timegrid views
- Handles event display and interaction
- Integrates with CalendarContext for state
- Responsive height via useCalendarHeight hook

#### CalendarForm.tsx
- Event creation and editing interface
- Form validation
- CalDAV event submission
- Recurrence rule (RRULE) configuration

#### AdminPanel.tsx
- Calendar selection and management
- Public/private calendar toggles
- Manual sync triggers
- UI settings (font size, event details)

#### TodayEvents.tsx
- Displays current day's events
- Real-time event filtering
- Timezone-aware display

#### CalendarLegend.tsx
- Color-coded calendar legend
- Public/private calendar indicators

---

## Services Layer

### caldav.service.ts
```typescript
// CalDAV operations via tsdav library
- fetchCalendars()      // Get available calendars
- fetchEvents()         // Get events from calendar
- createEvent()         // Create new calendar event
- updateEvent()         // Update existing event
- deleteEvent()         // Delete event
```

**Note:** All operations proxy through backend at `/api/*`

### indexeddb.service.ts
```typescript
// Browser-based persistence using idb
- initDB()              // Initialize database
- saveEvents()          // Cache events locally
- getEvents()           // Retrieve cached events
- deleteEvent()         // Remove cached event
- clearCalendar()       // Clear calendar data
```

**Database Schema:**
- Store: `events`
- Key: `id` (event UID)
- Indexed fields: `calendarId`, `startDate`, `endDate`

### sync.service.ts
```typescript
// Orchestrates CalDAV ↔ IndexedDB sync
- fullSync()            // Complete calendar sync
- manualSync()          // User-triggered sync
- syncCalendar()        // Single calendar sync
- handleSyncError()     // Error recovery
```

**Sync Strategy:**
1. Fetch from CalDAV server
2. Parse ICS data with ical.js
3. Store in IndexedDB
4. Update UI via CalendarContext

---

## State Management

### CalendarContext.tsx
Centralized state using React Context API:

```typescript
interface CalendarContextType {
  events: CalendarEvent[];
  calendars: Calendar[];
  syncStatus: SyncStatus;
  settings: CalendarSettings;

  // Actions
  addEvent: (event) => Promise<void>;
  updateEvent: (id, updates) => Promise<void>;
  deleteEvent: (id) => Promise<void>;
  syncCalendars: () => Promise<void>;
  updateSettings: (settings) => void;
}
```

**Usage in Components:**
```typescript
const { events, syncCalendars } = useCalendarContext();
```

---

## Custom Hooks

### useCalendarHeight.ts
Responsive calendar sizing based on viewport:

```typescript
const calendarHeight = useCalendarHeight();
// Returns calculated height in rem units
```

Factors considered:
- Window height
- Header/footer space
- Admin panel visibility
- Mobile vs desktop breakpoints

---

## Type System

### calendar.types.ts
Core calendar data structures:
- `CalendarEvent` - Event with metadata
- `VEvent` - iCalendar VEVENT format
- `RecurrenceRule` - RRULE configuration
- `Calendar` - Calendar metadata

### indexeddb.types.ts
Database types:
- `EventRecord` - Stored event format
- `DatabaseSchema` - IDB schema definition
- `QueryOptions` - Database query config

### settings.types.ts
Application settings:
- `CalendarSettings` - UI preferences
- `DisplayOptions` - View configuration
- `SyncConfig` - Sync behavior

---

## Utilities

### storage.ts
LocalStorage helpers for user preferences:
```typescript
- saveSettings(settings)    // Persist UI settings
- loadSettings()            // Restore settings
- clearSettings()           // Reset to defaults
```

**Stored Data:**
- Font size preferences
- Calendar visibility toggles
- View mode (kiosk/admin)
- Last sync timestamp

---

## Styling Architecture

### CSS Files Hierarchy
1. `index.css` - Global resets and base styles
2. `theme.css` - CSS variables (colors, spacing, fonts)
3. `fonts.css` - @font-face declarations
4. `App.css` - Component-specific styles

### Theme Variables (theme.css)
```css
:root {
  --font-primary: 'Outfit', sans-serif;
  --spacing-unit: 1rem;
  --color-primary: #...;
  --border-radius: 0.5rem;
  /* Never use border unless explicitly needed */
}
```

### Custom Fonts Available
- Outfit (10 weights) - Primary
- Hack (monospace)
- BearSans
- OpenDyslexic (accessibility)
- Filson Pro
- Jost
- Bookerly (serif)

---

## Recent Changes (Last 30 Days)

### New Features
- TodayEvents.tsx component added
- IndexedDB caching layer (indexeddb.service.ts)
- Full sync support (sync.service.ts)
- Timezone handling in Calendar.tsx
- Public/private calendar support

### Updated Files
- Calendar.tsx - Timezone preservation
- CalendarContext.tsx - Sync state management
- AdminPanel.tsx - UI settings controls
- caldav.service.ts - Improved error handling

### Styling Updates
- Converted px to rem throughout
- Removed unnecessary borders
- Theme consistency improvements

---

## Development Workflow

### Adding New Components
1. Create in `src/components/`
2. Define TypeScript interface for props
3. Use functional component pattern
4. Import and use CalendarContext if needed
5. Follow styling conventions (rem, no borders)
6. Export from component file

### Adding New Services
1. Create in `src/services/`
2. Define service interface
3. Implement error handling
4. Export functions
5. Update types if needed

### Modifying State
1. Update CalendarContext.tsx
2. Add action to context interface
3. Implement action in provider
4. Update components using the state

---

## Known Issues / Technical Debt

- Consider extracting calendar event parsing to separate utility
- Some component files are growing large (Calendar.tsx could be split)
- `src/assets/` directory is currently empty and could potentially be removed if not needed

---

**Last Updated:** 2025-11-02
**Frontend Version:** 1.0
