import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { LeadController } from '../controllers/lead.controller.js';

const router = Router();
const leadController = new LeadController();

router.get('/work/leads', authenticateToken, leadController.getLeads);

export default router;
