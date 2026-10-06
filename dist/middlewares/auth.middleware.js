import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        req.user = payload;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
export function requireRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthenticated' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                error: `Forbidden: role '${req.user.role}' is not authorized to access this resource`,
            });
            return;
        }
        next();
    };
}
