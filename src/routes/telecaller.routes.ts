import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { TelecallerController } from '../controllers/telecaller.controller.js';

const router = Router();
const telecallerController = new TelecallerController();

// Accept JWT (mobile) or session (web dashboard)
function allowSessionOrJwt(req: Request, _res: Response, next: NextFunction) {
  if (req.session?.user) return next();
  authenticateToken(req as any, _res, next);
}

router.post('/telecaller/status', authenticateToken, telecallerController.postStatus);
router.get('/telecaller/statuses', allowSessionOrJwt, telecallerController.getStatuses);

export default router;
