import { Router } from 'express';
import { WebController } from '../controllers/web.controller.js';
import multer from 'multer';
import { requireRole } from '../middlewares/adminAuth.middleware.js';
const router = Router();
const webController = new WebController();
const upload = multer({ dest: 'temp_uploads/' });
router.get('/login', webController.getLogin);
router.post('/login', webController.postLogin);
router.get('/logout', webController.logout);
router.get('/', webController.dashboardRedirect);
// Admin Routes
router.get('/admin', requireRole('SUPER_ADMIN'), webController.getSuperAdminDashboard);
router.post('/admin/update-device-alias', requireRole('SUPER_ADMIN'), webController.updateDeviceAlias);
router.post('/admin/create-customer', requireRole('SUPER_ADMIN'), webController.createCustomer);
router.post('/admin/update-customer', requireRole('SUPER_ADMIN'), webController.updateCustomer);
router.post('/admin/update-customer-status', requireRole('SUPER_ADMIN'), webController.updateCustomerStatus);
router.post('/admin/delete-customer', requireRole('SUPER_ADMIN'), webController.deleteCustomer);
// Owner Routes
router.get('/owner', requireRole('BUSINESS_OWNER'), webController.getOwnerDashboard);
router.post('/owner/upload-leads', requireRole('BUSINESS_OWNER'), upload.single('leads_file'), webController.postUploadLeads);
router.post('/owner/assign-leads', requireRole('BUSINESS_OWNER'), webController.postAssignLeads);
// Assignments
router.get('/admin/telecaller-assignments/:id', requireRole('SUPER_ADMIN'), webController.getTelecallerAssignments);
router.post('/admin/update-telecaller-assignments', requireRole('SUPER_ADMIN'), webController.updateTelecallerAssignments);
export default router;
