import { createApp } from '../src/app.js';
import { config } from '../src/config/env.js';
import { initDb } from '../src/database/db.js';
import { seedDatabase, seedGstDemoData } from '../src/database/seed.js';

/**
 * Vercel serverless entry point. Everything under /api/* is rewritten to this
 * single function (see vercel.json); the Express app's own internal routing
 * (src/app.ts) then handles the specific path.
 *
 * Caveat (accepted deployment trade-off, see KILLER_TESTS_GAPS_AND_DIFFERENTIATORS
 * discussion): the SQLite file lives on /tmp, which is ephemeral per cold start
 * and not shared across concurrent serverless instances. The app re-seeds
 * itself fresh on every cold start so it's always immediately usable, but data
 * does not persist long-term and the ACID row-locking guarantees only hold
 * within a single warm instance, not across Vercel's horizontal scaling.
 */
const db = initDb(config.dbPath);
seedDatabase(db);
seedGstDemoData(db);

const app = createApp();

export default app;
