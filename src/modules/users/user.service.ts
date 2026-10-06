import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';
import { User, UserRole } from '../../types/index.js';

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
}

export class UserService {
  public static createUser(input: CreateUserInput, dbInstance?: Database.Database): Omit<User, 'password_hash'> {
    if (!input.email || !input.password || !input.role) {
      const err = new Error('email, password, and role are required');
      (err as any).statusCode = 400;
      throw err;
    }

    if (!['Admin', 'Accountant', 'Staff'].includes(input.role)) {
      const err = new Error("role must be 'Admin', 'Accountant', or 'Staff'");
      (err as any).statusCode = 400;
      throw err;
    }

    const db = dbInstance || getDb();

    // Check duplicate email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
    if (existing) {
      const err = new Error(`User with email ${input.email} already exists`);
      (err as any).statusCode = 409;
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

  public static listUsers(dbInstance?: Database.Database): Omit<User, 'password_hash'>[] {
    const db = dbInstance || getDb();
    return db
      .prepare('SELECT id, email, role, created_at FROM users ORDER BY id ASC')
      .all() as Omit<User, 'password_hash'>[];
  }
}
