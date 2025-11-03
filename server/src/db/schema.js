/**
 * Database schema for Kitchen Calendar Kiosk
 * SQLite database for persistent storage of calendar config and events
 */

export const SCHEMA_VERSION = 2;

export const createTables = (db) => {
  // Calendar sources configuration table (CalDAV servers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      server_url TEXT NOT NULL,
      username TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      source_type TEXT DEFAULT 'caldav',
      requires_auth INTEGER DEFAULT 1,
      is_public INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Individual calendars table (each source can have multiple calendars)
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      calendar_url TEXT NOT NULL,
      color TEXT DEFAULT '#3788d8',
      enabled INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE
    )
  `);

  // Calendar events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      title TEXT,
      description TEXT,
      location TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      timezone TEXT,
      recurrence_rule TEXT,
      is_all_day INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE,
      FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
    )
  `);

  // Sync metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      source_id TEXT PRIMARY KEY,
      last_sync_time INTEGER,
      last_sync_status TEXT,
      last_error TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry_time INTEGER,
      sync_token TEXT,
      ctag TEXT,
      FOREIGN KEY (source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE
    )
  `);

  // Schema version tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `);

  // Check current schema version and run migrations if needed
  const currentVersion = db.prepare('SELECT MAX(version) as version FROM schema_version').get();

  if (!currentVersion || currentVersion.version === null) {
    // First time setup
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(SCHEMA_VERSION, Date.now());
  } else if (currentVersion.version < SCHEMA_VERSION) {
    // Run migrations
    runMigrations(db, currentVersion.version, SCHEMA_VERSION);
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(SCHEMA_VERSION, Date.now());
  }

  // Create indexes for efficient queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_calendars_source_id ON calendars(source_id);
    CREATE INDEX IF NOT EXISTS idx_events_source_id ON events(source_id);
    CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
    CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
    CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);
    CREATE INDEX IF NOT EXISTS idx_events_time_range ON events(start_time, end_time);
  `);
};

/**
 * Run database migrations between versions
 */
function runMigrations(db, fromVersion, toVersion) {
  console.log(`[DB] Running migrations from version ${fromVersion} to ${toVersion}`);

  // Migration from version 1 to version 2
  if (fromVersion < 2 && toVersion >= 2) {
    console.log('[DB] Migrating to version 2: Adding calendars table and updating schema');

    // Create new calendars table (already created above if not exists)

    // Migrate existing data from calendar_sources to calendars table
    const oldSources = db.prepare(`
      SELECT id, calendar_url, color FROM calendar_sources
      WHERE calendar_url IS NOT NULL
    `).all();

    if (oldSources.length > 0) {
      const now = Date.now();
      const insertCalendar = db.prepare(`
        INSERT INTO calendars (id, source_id, name, calendar_url, color, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `);

      for (const source of oldSources) {
        const calendarId = `${source.id}_default`;
        insertCalendar.run(
          calendarId,
          source.id,
          'Default Calendar',
          source.calendar_url,
          source.color || '#3788d8',
          now,
          now
        );

        // Update events to reference the new calendar_id
        db.prepare(`
          UPDATE events
          SET calendar_id = ?
          WHERE source_id = ? AND calendar_id = ?
        `).run(calendarId, source.id, source.calendar_url);
      }

      console.log(`[DB] Migrated ${oldSources.length} calendar(s) to new schema`);
    }

    // Drop old columns from calendar_sources (SQLite requires recreate)
    db.exec(`
      CREATE TABLE calendar_sources_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        server_url TEXT NOT NULL,
        username TEXT NOT NULL,
        password_encrypted TEXT NOT NULL,
        source_type TEXT DEFAULT 'caldav',
        requires_auth INTEGER DEFAULT 1,
        is_public INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO calendar_sources_new
        (id, name, server_url, username, password_encrypted, is_public, is_active, created_at, updated_at)
      SELECT id, name, server_url, username, password_encrypted, is_public, is_active, created_at, updated_at
      FROM calendar_sources;

      DROP TABLE calendar_sources;
      ALTER TABLE calendar_sources_new RENAME TO calendar_sources;
    `);

    console.log('[DB] Migration to version 2 complete');
  }
}
