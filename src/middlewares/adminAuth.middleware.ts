import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

export const requireRole = (role: 'SUPER_ADMIN' | 'BUSINESS_OWNER') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (req.session.user.role !== role) {
      return res.status(403).send('Forbidden - Unauthorized access');
    }
    next();
  };
};
