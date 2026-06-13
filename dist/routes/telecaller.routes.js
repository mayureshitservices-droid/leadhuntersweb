import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { TelecallerController } from '../controllers/telecaller.controller.js';
const router = Router();
const telecallerController = new TelecallerController();
router.post('/telecaller/status', authenticateToken, telecallerController.postStatus);
router.get('/telecaller/statuses', authenticateToken, telecallerController.getStatuses);
export default router;
