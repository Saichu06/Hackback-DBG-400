import { createApp } from './app.js';
import { config } from './config/env.js';
import { initDb } from './database/db.js';
import { seedDatabase } from './database/seed.js';
function bootstrap() {
    console.log('Initializing database...');
    const db = initDb(config.dbPath);
    seedDatabase(db);
    const app = createApp();
    const server = app.listen(config.port, () => {
        console.log(`GST-Ready Accounting Ledger API running at http://localhost:${config.port}`);
    });
    process.on('SIGTERM', () => {
        console.log('SIGTERM signal received. Closing HTTP server...');
        server.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
    });
}
bootstrap();
