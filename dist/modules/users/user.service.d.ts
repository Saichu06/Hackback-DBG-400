import Database from 'better-sqlite3';
import { User, UserRole } from '../../types/index.js';
export interface CreateUserInput {
    email: string;
    password: string;
    role: UserRole;
}
export declare class UserService {
    static createUser(input: CreateUserInput, dbInstance?: Database.Database): Omit<User, 'password_hash'>;
    static listUsers(dbInstance?: Database.Database): Omit<User, 'password_hash'>[];
}
