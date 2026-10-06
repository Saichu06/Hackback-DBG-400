import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let dbInstance = null;
export function getDb() {
    if (!dbInstance) {
        dbInstance = initDb(config.dbPath);
    }
    return dbInstance;
}
export function setDb(db) {
    if (dbInstance && dbInstance !== db) {
        dbInstance.close();
    }
    dbInstance = db;
}
export function initDb(dbPath = config.dbPath) {
    const db = new Database(dbPath);
    // Enforce foreign keys and WAL mode
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    // Load and execute schema
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    return db;
}
export function createInMemoryDb() {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    return db;
}
/**
 * Unit of Work transaction wrapper.
 * Uses BEGIN IMMEDIATE for ACID isolation and pessimistic locking semantics.
 */
export function withTransaction(callback, database) {
    const db = database || getDb();
    const tx = db.transaction(() => callback(db));
    return tx.immediate();
}
