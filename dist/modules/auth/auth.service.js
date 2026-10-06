import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../../database/db.js';
import { config } from '../../config/env.js';
export class AuthService {
    static login(email, password, dbInstance) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        const db = dbInstance || getDb();
        const user = db
            .prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?')
            .get(email);
        if (!user) {
            const err = new Error('Invalid email or password');
            err.statusCode = 401;
            throw err;
        }
        const isMatch = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) {
            const err = new Error('Invalid email or password');
            err.statusCode = 401;
            throw err;
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '24h' });
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
        };
    }
}
