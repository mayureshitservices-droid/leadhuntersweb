import jwt from 'jsonwebtoken';
import { env } from '../lib/env.js';
const JWT_SECRET = env('JWT_SECRET');
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token)
        return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err)
            return res.sendStatus(403);
        req.user = decoded;
        next();
    });
};
