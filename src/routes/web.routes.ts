import { Router } from 'express';
import { WebController } from '../controllers/web.controller.js';

import multer from 'multer';

const router = Router();
const webController = new WebController();
const upload = multer({ dest: 'temp_uploads/' });

router.get('/login', webController.getLogin);
router.post('/login', webController.postLogin);
router.get('/logout', webController.logout);

// To protect these routes, we need an auth middleware
router.get('/', webController.dashboardRedirect);
router.get('/admin', webController.getSuperAdminDashboard);
router.post('/admin/update-device-alias', webController.updateDeviceAlias);
router.post('/admin/create-customer', webController.createCustomer);
router.post('/admin/update-customer', webController.updateCustomer);
router.post('/admin/update-customer-status', webController.updateCustomerStatus);
router.post('/admin/delete-customer', webController.deleteCustomer);
router.get('/owner', webController.getOwnerDashboard);
router.post('/owner/upload-leads', upload.single('leads_file'), webController.postUploadLeads);

// Assignments
router.get('/admin/telecaller-assignments/:id', webController.getTelecallerAssignments);
router.post('/admin/update-telecaller-assignments', webController.updateTelecallerAssignments);

export default router;
