export const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};
export const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        if (req.session.user.role !== role) {
            return res.status(403).send('Forbidden - Unauthorized access');
        }
        next();
    };
};
