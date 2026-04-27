import { Router } from 'express';
import { body, param, query } from 'express-validator';
import maintenanceController from '../controllers/maintenance.controller';
import { requireRole } from '../middlewares/authMiddleware';

const router = Router();

const MAINTENANCE_TYPES = ['preventive', 'corrective', 'calibration', 'inspection'];
const MAINTENANCE_STATUSES = ['requested', 'scheduled', 'in_progress', 'completed', 'validated', 'cancelled'];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1 }).toInt(),
    query('view').optional().isIn(['active', 'history']),
    query('status').optional().isIn(MAINTENANCE_STATUSES),
    query('assetId').optional().isInt({ min: 1 }).toInt(),
    query('assetType').optional().isIn(['medical', 'non_medical']),
    query('type').optional().isIn(MAINTENANCE_TYPES)
  ],
  maintenanceController.getAll
);

router.get('/:id', [param('id').isInt({ min: 1 })], maintenanceController.getById);

router.post(
  '/',
  [
    body('assetId').isInt({ min: 1 }),
    body('assetType').optional().isIn(['medical', 'non_medical']),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('type').isIn(MAINTENANCE_TYPES),
    body('status').optional().isIn(MAINTENANCE_STATUSES),
    body('scheduledDate').isISO8601(),
    body('description').optional().trim(),
    body('technician').optional().trim(),
    body('cost').optional().isFloat({ min: 0 }),
    body('notes').optional().trim(),
    body('cancellationReason').optional().trim()
  ],
  requireRole(['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'user']),
  maintenanceController.create
);

router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('assetId').optional().isInt({ min: 1 }),
    body('assetType').optional().isIn(['medical', 'non_medical']),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('status').optional().isIn(MAINTENANCE_STATUSES),
    body('type').optional().isIn(MAINTENANCE_TYPES),
    body('scheduledDate').optional().isISO8601(),
    body('description').optional().trim(),
    body('technician').optional().trim(),
    body('cost').optional().isFloat({ min: 0 }),
    body('notes').optional().trim(),
    body('cancellationReason').optional().trim()
  ],
  requireRole(['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'teknisi', 'tekniksi']),
  maintenanceController.update
);

router.patch(
  '/:id/complete',
  [
    param('id').isInt({ min: 1 }),
    body('notes').optional().trim(),
    body('cost').optional().isFloat({ min: 0 })
  ],
  requireRole(['admin', 'leader', 'teknisi', 'tekniksi']),
  maintenanceController.complete
);

router.delete('/:id', [param('id').isInt({ min: 1 })], requireRole(['admin']), maintenanceController.delete);

export default router;
