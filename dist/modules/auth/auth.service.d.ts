import Database from 'better-sqlite3';
import { UserRole } from '../../types/index.js';
export interface AuthResponse {
    token: string;
    user: {
        id: number;
        email: string;
        role: UserRole;
    };
}
export declare class AuthService {
    static login(email: string, password: string, dbInstance?: Database.Database): AuthResponse;
}
