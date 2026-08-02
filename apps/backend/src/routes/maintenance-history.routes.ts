import { Router } from 'express';
import * as MaintenanceHistoryController from '../controllers/maintenance-history.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authMiddleware, MaintenanceHistoryController.getAllMaintenanceHistory);
router.get('/:id', authMiddleware, MaintenanceHistoryController.getMaintenanceHistoryById);
router.post('/', authMiddleware, requireRole(['admin']), MaintenanceHistoryController.createMaintenanceHistory);
router.patch('/:id/validate', authMiddleware, requireRole(['admin']), MaintenanceHistoryController.validateMaintenanceHistory);
router.patch('/:id/complete', authMiddleware, requireRole(['admin']), MaintenanceHistoryController.completeMaintenanceHistory);
router.delete('/:id', authMiddleware, requireRole(['admin']), MaintenanceHistoryController.deleteMaintenanceHistory);

export default router;
