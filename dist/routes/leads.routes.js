import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { LeadController } from '../controllers/lead.controller.js';
const router = Router();
const leadController = new LeadController();
router.get('/work/campaigns', authenticateToken, leadController.getCampaigns);
router.post('/work/campaigns/claim', authenticateToken, leadController.claimCampaignLeads);
export default router;
