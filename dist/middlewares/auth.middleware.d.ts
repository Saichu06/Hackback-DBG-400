import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/index.js';
export interface AuthUserPayload {
    id: number;
    email: string;
    role: UserRole;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthUserPayload;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
export declare function requireRoles(...allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
