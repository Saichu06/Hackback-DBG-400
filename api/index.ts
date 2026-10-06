import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { initDb } from '../src/database/db.js';
import { seedDatabase, seedGstDemoData } from '../src/database/seed.js';

console.log('Initializing database for serverless function...');
const db = initDb(config.dbPath);
seedDatabase(db);
seedGstDemoData(db);

const app = createApp();
export default app;
