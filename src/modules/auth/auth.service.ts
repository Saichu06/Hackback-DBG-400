import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';
import { config } from '../../config/env.js';
import { User, UserRole } from '../../types/index.js';

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    role: UserRole;
  };
}

export class AuthService {
  public static login(email: string, password: string, dbInstance?: Database.Database): AuthResponse {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const db = dbInstance || getDb();
    const user = db
      .prepare('SELECT id, email, password_hash, role FROM users WHERE email = ?')
      .get(email) as User | undefined;

    if (!user) {
      const err = new Error('Invalid email or password');
      (err as any).statusCode = 401;
      throw err;
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      (err as any).statusCode = 401;
      throw err;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

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
