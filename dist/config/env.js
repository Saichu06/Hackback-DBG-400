import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_change_in_production',
    dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'ledger.sqlite'),
    seedAdmin: {
        email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
        password: process.env.SEED_ADMIN_PASSWORD || 'securepassword123',
    },
    test: {
        seed: parseInt(process.env.TEST_SEED || '123456789', 10),
        opsCount: parseInt(process.env.TEST_OPS_COUNT || '20', 10),
    }
};
