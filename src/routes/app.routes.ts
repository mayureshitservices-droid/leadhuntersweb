import { Router } from 'express';
import { AppController } from '../controllers/app.controller.js';

const router = Router();
const appController = new AppController();

router.get('/version', appController.getVersion);

export default router;
