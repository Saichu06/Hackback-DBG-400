import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = initDb(config.dbPath);
  }
  return dbInstance;
}

export function setDb(db: Database.Database): void {
  if (dbInstance && dbInstance !== db) {
    dbInstance.close();
  }
  dbInstance = db;
}

/**
 * Adds a column to an existing table only if it isn't already there. SQLite's ALTER TABLE has
 * no "ADD COLUMN IF NOT EXISTS", and initDb() re-runs schema.sql on every process start, so a
 * plain ALTER TABLE would succeed once and then crash the server on every restart after that.
 * This is the guarded alternative used for the additive GST Filing Pack columns (see
 * docs/DATA_MODEL.md §3): check `PRAGMA table_info`, add the column only when it's missing.
 */
function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  columnDefSql: string
): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDefSql}`);
  }
}

function applyColumnMigrations(db: Database.Database): void {
  addColumnIfMissing(db, 'contacts', 'gstin', 'gstin TEXT');
  addColumnIfMissing(db, 'contacts', 'state_code', 'state_code TEXT');
  addColumnIfMissing(db, 'items_entries', 'hsn_code', 'hsn_code TEXT');
  addColumnIfMissing(db, 'items_entries', 'cgst_paise', 'cgst_paise INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'items_entries', 'sgst_paise', 'sgst_paise INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'items_entries', 'igst_paise', 'igst_paise INTEGER NOT NULL DEFAULT 0');
}

export function initDb(dbPath: string = config.dbPath): Database.Database {
  const db = new Database(dbPath);
  // Enforce foreign keys and WAL mode
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  // Load and execute schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  applyColumnMigrations(db);

  return db;
}

export function createInMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
  applyColumnMigrations(db);
  return db;
}

/**
 * Unit of Work transaction wrapper.
 * Uses BEGIN IMMEDIATE for ACID isolation and pessimistic locking semantics.
 */
export function withTransaction<T>(
  callback: (db: Database.Database) => T,
  database?: Database.Database
): T {
  const db = database || getDb();
  const tx = db.transaction(() => callback(db));
  return tx.immediate();
}
