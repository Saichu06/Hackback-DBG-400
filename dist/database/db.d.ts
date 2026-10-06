import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
export declare function setDb(db: Database.Database): void;
export declare function initDb(dbPath?: string): Database.Database;
export declare function createInMemoryDb(): Database.Database;
/**
 * Unit of Work transaction wrapper.
 * Uses BEGIN IMMEDIATE for ACID isolation and pessimistic locking semantics.
 */
export declare function withTransaction<T>(callback: (db: Database.Database) => T, database?: Database.Database): T;
