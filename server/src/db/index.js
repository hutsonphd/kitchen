/**
 * Database initialization and connection management
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { createTables } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database file location - use /app/data in production (Docker volume)
const DATA_DIR = process.env.DB_PATH || join(__dirname, '..', '..', 'data');
const DB_FILE = join(DATA_DIR, 'calendar.db');

let db = null;

/**
 * Initialize database connection and schema
 */
export const initializeDatabase = () => {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[DB] Created data directory: ${DATA_DIR}`);
  }

  // Create database connection
  db = new Database(DB_FILE, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Create tables if they don't exist
  createTables(db);

  console.log(`[DB] Database initialized at: ${DB_FILE}`);

  return db;
};

/**
 * Get database instance
 */
export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
};

/**
 * Close database connection
 */
export const closeDatabase = () => {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed');
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});
