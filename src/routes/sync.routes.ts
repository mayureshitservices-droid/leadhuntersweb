import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { SyncController } from '../controllers/sync.controller.js';

const router = Router();
const syncController = new SyncController();

// IMPORTANT: Do NOT use standard multer middleware here for recordings, 
// because we stream directly in the controller using a custom Multer config
router.post('/sync/call-log', authenticateToken, syncController.syncCallLog);
router.post('/sync/recording', authenticateToken, syncController.syncRecording);

export default router;
