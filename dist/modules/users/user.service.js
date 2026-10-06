import bcrypt from 'bcryptjs';
import { getDb } from '../../database/db.js';
export class UserService {
    static createUser(input, dbInstance) {
        if (!input.email || !input.password || !input.role) {
            const err = new Error('email, password, and role are required');
            err.statusCode = 400;
            throw err;
        }
        if (!['Admin', 'Accountant', 'Staff'].includes(input.role)) {
            const err = new Error("role must be 'Admin', 'Accountant', or 'Staff'");
            err.statusCode = 400;
            throw err;
        }
        const db = dbInstance || getDb();
        // Check duplicate email
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
        if (existing) {
            const err = new Error(`User with email ${input.email} already exists`);
            err.statusCode = 409;
            throw err;
        }
        const passwordHash = bcrypt.hashSync(input.password, 10);
        const result = db
            .prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
            .run(input.email, passwordHash, input.role);
        return {
            id: Number(result.lastInsertRowid),
            email: input.email,
            role: input.role,
        };
    }
    static listUsers(dbInstance) {
        const db = dbInstance || getDb();
        return db
            .prepare('SELECT id, email, role, created_at FROM users ORDER BY id ASC')
            .all();
    }
}
