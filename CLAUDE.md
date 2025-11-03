# Kitchen Calendar Kiosk - Project Documentation

## Project Overview
Full-stack calendar kiosk application with CalDAV sync, public/private calendar management, and timezone handling.

**Tech Stack:**
- Frontend: React 19 + TypeScript + Vite
- Backend: Express.js (CalDAV proxy)
- Database: IndexedDB (browser persistence)
- Calendar: FullCalendar + tsdav + ical.js
- Deployment: Docker + Nginx

---

## Development Commands

### Root Directory
```bash
npm run dev              # Run frontend + backend concurrently (ports 5173 + 3001)
npm run build           # TypeScript compilation + Vite production build
npm run lint            # ESLint check
```

### Server Directory
```bash
cd server
npm run start           # Production server
npm run dev             # Development with --watch
npm run test            # Jest tests
```

---

## Project Structure

```
kitchen/
├── src/                    # Frontend React TypeScript source
│   ├── components/         # React components (Calendar, AdminPanel, etc.)
│   ├── services/          # API services (caldav, indexeddb, sync)
│   ├── contexts/          # React Context (CalendarContext)
│   ├── hooks/             # Custom hooks (useCalendarHeight)
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions (storage)
│
├── server/                 # Backend Express.js server
│   └── src/
│       ├── server.js      # Main Express app (CalDAV proxy)
│       └── __tests__/     # Jest test suite
│
├── public/                 # Static assets
│   └── fonts/custom/      # Custom font families (8 total)
│
└── dist/                   # Production build output (generated)
```

---

## Code Conventions

### Styling Guidelines
- **Never add borders** to any UI element unless explicitly requested
- **Always use rem for sizes**, not px
- Follow the existing theme.css variable structure
- Font family: Outfit (primary), with fallbacks available

### React Patterns
- Use functional components with hooks
- Centralize state in CalendarContext
- Keep components focused and single-purpose
- Use TypeScript interfaces for all props

### API Architecture
- Frontend calls backend proxy at `/api/*` (proxied to port 3001)
- Backend handles CalDAV protocol communication
- Server processes ICS data and handles RRULE expansion
- Timezone preservation is critical for calendar events

---

## Recent Updates (Last 30 Days)

### Major Features Added
- Full sync support with CalDAV servers
- Timezone handling for calendar events
- Public/private calendar support
- IndexedDB caching layer
- Manual sync functionality
- Docker deployment configuration
- Jest testing framework

### Files Modified
- CalDAV service improvements (caldav.service.ts)
- Sync orchestration (sync.service.ts)
- Calendar context enhancements (CalendarContext.tsx)
- Server proxy updates (server/src/server.js)
- UI styling refinements (App.css, theme.css)

---

## Data Flow Architecture

```
Frontend Components
    ↓
CalendarContext (state management)
    ↓
Services Layer
    ├─→ caldav.service.ts (CalDAV API)
    ├─→ sync.service.ts (sync orchestration)
    └─→ indexeddb.service.ts (local persistence)
    ↓
Backend Proxy (port 3001)
    ↓
CalDAV Server (external)
```

---

## Build & Deployment

### Docker Deployment
```bash
docker-compose up --build    # Build and run containerized app
```

Configuration files:
- `docker-compose.yml` - Multi-container orchestration
- `Dockerfile` - Frontend container
- `server/Dockerfile` - Backend container
- `nginx.conf` - Reverse proxy configuration
- `DOCKER.md` - Deployment documentation

### Production Build
```bash
npm run build               # Creates optimized dist/ folder
```

---

## Testing

### Backend Tests
```bash
cd server && npm run test   # Run Jest test suite
```

Test coverage:
- Recurring event expansion
- RRULE handling
- Timezone conversions

---

## Git Workflow

**Current Branch:** main
**Status:** Clean (no uncommitted changes)

Recent commits focus on:
1. Calendar sync and timezone improvements
2. Styling refinements (rem-based, no borders)
3. Docker deployment setup
4. Public/private calendar features

---

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Frontend dependencies and scripts |
| `tsconfig.json` | TypeScript monorepo configuration |
| `vite.config.ts` | Vite bundler + API proxy config |
| `eslint.config.js` | Linting rules |
| `.gitignore` | Git exclusions (node_modules, dist, .env) |

---

## Security Notes

- CalDAV credentials handled by backend proxy only
- Frontend never directly exposes server credentials
- CORS properly configured for production
- Environment variables for sensitive data (.env excluded from git)

---

**Last Updated:** 2025-11-02
**Documentation Version:** 1.0
