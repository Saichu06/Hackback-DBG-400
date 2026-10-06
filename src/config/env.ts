import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production',
  // On Vercel the project directory is read-only at runtime — only /tmp is
  // writable, and it resets on cold start. Everything else (local dev, any
  // other host) keeps the original persistent-file behavior.
  dbPath: process.env.DB_PATH || (process.env.VERCEL ? '/tmp/ledger.sqlite' : path.resolve(process.cwd(), 'ledger.sqlite')),
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'securepassword123',
  },
  test: {
    seed: parseInt(process.env.TEST_SEED || '123456789', 10),
    opsCount: parseInt(process.env.TEST_OPS_COUNT || '20', 10),
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
};
