import { Router } from 'express';
import * as MaintenanceHistoryController from '../controllers/maintenance_history.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, MaintenanceHistoryController.getAllMaintenanceHistory);
router.get('/:id', authMiddleware, MaintenanceHistoryController.getMaintenanceHistoryById);
router.post('/', authMiddleware, MaintenanceHistoryController.createMaintenanceHistory);
router.patch('/:id/validate', authMiddleware, MaintenanceHistoryController.validateMaintenanceHistory);
router.patch('/:id/complete', authMiddleware, MaintenanceHistoryController.completeMaintenanceHistory);
router.delete('/:id', authMiddleware, MaintenanceHistoryController.deleteMaintenanceHistory);

export default router;
