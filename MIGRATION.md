# Migration Guide: Browser Storage → SQLite Backend

## Overview

This migration moves all calendar data persistence from browser storage (localStorage + IndexedDB) to a SQLite database on the backend server with Docker volume persistence.

**Status:** ✅ **COMPLETE**

---

## What Changed

### Before (Browser Storage)
- **Calendar Sources**: Stored in browser localStorage
- **Events**: Cached in browser IndexedDB
- **Sync Logic**: Frontend JavaScript
- **Persistence**: Per-browser, lost on cache clear
- **Issue**: Fresh Docker instances had no calendar config

### After (SQLite Backend)
- **Calendar Sources**: Stored in SQLite database
- **Events**: Stored in SQLite database
- **Sync Logic**: Backend Node.js service (auto-syncs every 5 minutes)
- **Persistence**: Docker volume, survives container restarts
- **Fix**: Zero-touch deployment, calendars auto-sync

---

## Database Schema

### Tables Created

1. **`calendar_sources`**
   - Stores calendar configuration
   - Passwords encrypted with AES
   - Fields: id, name, server_url, calendar_url, username, password_encrypted, color, is_public, is_active

2. **`events`**
   - Stores all calendar events
   - Fields: id, source_id, calendar_id, title, description, location, start_time, end_time, timezone, recurrence_rule, is_all_day

3. **`sync_metadata`**
   - Tracks sync status and retry logic
   - Fields: source_id, last_sync_time, last_sync_status, last_error, retry_count, next_retry_time, sync_token, ctag

4. **`schema_version`**
   - Tracks database schema version for future migrations

---

## New Backend Features

### Automatic Background Sync
- Runs every 5 minutes automatically
- Fetches events from all configured CalDAV sources
- Stores events in SQLite database
- Handles errors with exponential backoff (1min, 5min, 15min)

### New API Endpoints

**Configuration:**
- `GET /api/config/sources` - Get all calendar sources
- `POST /api/config/sources` - Create calendar source
- `PUT /api/config/sources/:id` - Update calendar source
- `DELETE /api/config/sources/:id` - Delete calendar source
- `POST /api/config/sources/batch` - Batch import

**Events:**
- `GET /api/events?start=...&end=...` - Get events with date filtering
- `GET /api/events/count` - Get event count
- `POST /api/events` - Save events (batch)
- `DELETE /api/events/:id` - Delete event
- `DELETE /api/events/source/:sourceId` - Delete all events for source

**Sync:**
- `POST /api/sync/trigger` - Manual sync trigger
- `GET /api/sync/status` - Get sync status
- `POST /api/sync/reset-retry/:sourceId` - Reset retry counter

---

## Frontend Changes

### Updated Files

1. **`src/services/api.service.ts`** ✅ NEW
   - New service for backend API communication
   - Replaces direct localStorage/IndexedDB access

2. **`src/contexts/CalendarContext.tsx`** ✅ UPDATED
   - Now uses `api.service.ts` instead of `storage` and `indexeddb`
   - `addSource()` → calls backend API
   - `updateSource()` → calls backend API
   - `removeSource()` → calls backend API
   - `fetchAllEvents()` → fetches from backend

3. **`src/utils/storage.ts`** ✅ SIMPLIFIED
   - Removed: `saveSources()`, `loadSources()`, `clearSources()`
   - Kept: `saveUISettings()`, `loadUISettings()` (UI preferences stay client-side)

### Deleted/Unused Files
- `src/services/sync.service.ts` - Logic moved to backend
- `src/services/indexeddb.service.ts` - No longer needed

---

## Docker Configuration

### Updated `docker-compose.yml`

```yaml
backend:
  environment:
    - DB_PATH=/app/data
  volumes:
    - ./data:/app/data  # ← NEW: Persistent volume
```

### Database Location
- **Development**: `/Users/admin/repos/kitchen/server/data/calendar.db`
- **Production (Docker)**: `/app/data/calendar.db` (mounted to `./data` on host)

---

## Migration Steps for Existing Deployments

### Option 1: Fresh Start (Recommended for Kiosk)

1. Deploy updated Docker containers:
   ```bash
   docker-compose down
   docker-compose build
   docker-compose up -d
   ```

2. Access admin panel (Ctrl+Shift+A)

3. Add calendar sources via admin UI

4. Backend will automatically sync events every 5 minutes

### Option 2: Migrate Existing Browser Data

If you have critical calendar configurations in browser localStorage:

1. **Export from Browser Console:**
   ```javascript
   console.log(JSON.stringify(localStorage.getItem('calendar_sources')));
   ```

2. **Import via API:**
   ```bash
   curl -X POST http://localhost:3001/api/config/sources/batch \
     -H "Content-Type: application/json" \
     -d '{"sources": [...]}'  # Paste exported data
   ```

3. **Trigger manual sync:**
   ```bash
   curl -X POST http://localhost:3001/api/sync/trigger
   ```

---

## Verification

### Check Database Exists
```bash
ls -lh server/data/calendar.db
```

### Query Database
```bash
sqlite3 server/data/calendar.db "SELECT * FROM calendar_sources;"
sqlite3 server/data/calendar.db "SELECT COUNT(*) FROM events;"
```

### Check Backend Logs
```bash
docker-compose logs backend | grep -i sync
```

Expected output:
```
[Sync] Starting background sync (every 5 minutes)
[Sync] Starting sync for all sources...
[Sync] Successfully synced 123 events for Calendar Name
```

### Test Container Restart
```bash
# Add a calendar via admin panel, then:
docker-compose restart backend

# Calendar should still be configured
curl http://localhost:3001/api/config/sources
```

---

## Troubleshooting

### Events Not Appearing

1. **Check if sources are configured:**
   ```bash
   curl http://localhost:3001/api/config/sources
   ```

2. **Check sync status:**
   ```bash
   curl http://localhost:3001/api/sync/status
   ```

3. **Check backend logs:**
   ```bash
   docker-compose logs backend --tail=50
   ```

4. **Trigger manual sync:**
   ```bash
   curl -X POST http://localhost:3001/api/sync/trigger
   ```

### Database Lock Errors

SQLite uses WAL mode for better concurrency. If you see lock errors:

```bash
sqlite3 server/data/calendar.db "PRAGMA journal_mode=WAL;"
```

### Reset Everything

**Warning: This deletes all calendar data!**

```bash
rm -f server/data/calendar.db*
docker-compose restart backend
```

---

## Performance Notes

### Database Size
- 1 source, 5000 events: ~2 MB
- 10 sources, 50,000 events: ~20 MB
- Indexes on start_time, end_time for fast queries

### Sync Performance
- Initial sync: 60 second timeout
- Background sync: 45 second timeout
- Handles up to 500 recurring event occurrences per event

### Memory Usage
- Backend: ~50 MB baseline
- Per sync: +10-20 MB temporary (garbage collected)

---

## Security Notes

### Credential Encryption
- Passwords encrypted with AES-256-CBC
- Encryption key: `process.env.ENCRYPTION_KEY` (defaults to hardcoded key)
- **Recommendation**: Set `ENCRYPTION_KEY` env variable in production

### API Access
- No authentication on API endpoints (designed for single-kiosk use)
- Use reverse proxy (nginx) for external access
- CORS restricted to `CORS_ORIGIN` env variable

---

## Rollback Plan

If you need to revert to browser storage:

1. **Restore old code:**
   ```bash
   git revert HEAD  # or restore specific commit
   ```

2. **Rebuild and redeploy:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

3. **Reimport calendar sources** via admin panel

---

## Testing Checklist

✅ Database initializes on server start
✅ Calendar sources can be added via admin panel
✅ Backend syncs events automatically
✅ Events display on calendar
✅ Container restart preserves data
✅ Multiple sources sync correctly
✅ Error retry logic works (exponential backoff)
✅ Production build succeeds
✅ Existing tests pass

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  React App                                           │  │
│  │  • CalendarContext (state)                          │  │
│  │  • api.service.ts (API calls)                       │  │
│  │  • localStorage (UI settings only)                  │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         │ HTTP API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend (Node.js + Express)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Routes                                          │  │
│  │  • /api/config/* (calendar CRUD)                    │  │
│  │  • /api/events/* (event queries)                    │  │
│  │  • /api/sync/* (sync control)                       │  │
│  └────────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Sync Service                                        │  │
│  │  • Automatic sync every 5 minutes                   │  │
│  │  • CalDAV client (tsdav)                            │  │
│  │  • ICS parser (ical.js)                             │  │
│  └────────────────────┬─────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Database Layer                                      │  │
│  │  • calendar_sources.js (CRUD)                       │  │
│  │  • events.js (storage)                              │  │
│  │  • sync_metadata.js (status)                        │  │
│  │  • crypto.js (encryption)                           │  │
│  └────────────────────┬─────────────────────────────────┘  │
└────────────────────────┼────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          SQLite Database (Docker Volume)                    │
│  📁 /app/data/calendar.db                                  │
│  • calendar_sources (config + encrypted credentials)       │
│  • events (all calendar events)                            │
│  • sync_metadata (sync status, retries)                    │
│  • schema_version (migrations)                             │
└─────────────────────────────────────────────────────────────┘
```

---

**Migration completed:** 2025-11-03
**Status:** Production Ready ✅
**Next steps:** Deploy, configure calendars, monitor sync logs
