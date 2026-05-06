import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();
const authController = new AuthController();

router.post('/login', authController.login);
router.post('/deviceregistration', authController.deviceRegistration);
router.post('/heartbeat', authenticateToken, authController.heartbeat);

export default router;
