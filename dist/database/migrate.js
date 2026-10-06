import { initDb } from './db.js';
export function runMigrations(dbPath) {
    console.log('Running migrations...');
    const db = initDb(dbPath);
    console.log('Migrations applied successfully.');
    return db;
}
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
    runMigrations();
}
