import { Router } from 'express';
import { body, param } from 'express-validator';
import * as MaintenanceHistoryController from '../controllers/maintenance-history.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate-request.middleware';
import { isoDateTimeMessage } from '../utils/date-validation';

const router = Router();

// `id` selalu diteruskan ke service sebagai Number(), jadi harus dipastikan
// integer di lapisan route agar NaN tidak pernah sampai ke query.
const recordId = [param('id').isInt({ min: 1 }).toInt(), validateRequest];

router.get('/', authMiddleware, MaintenanceHistoryController.getAllMaintenanceHistory);
router.get('/:id', authMiddleware, recordId, MaintenanceHistoryController.getMaintenanceHistoryById);

router.post(
  '/',
  authMiddleware,
  requireRole(['admin']),
  [
    body('maintenanceId').optional().isInt({ min: 1 }).toInt(),
    body('assetId').optional().isInt({ min: 1 }).toInt(),
    body('assetType').optional().isIn(['medical', 'non_medical']),
    body('maintenanceDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal maintenance')),
    body('completedAt').optional().isISO8601().withMessage(isoDateTimeMessage('Waktu selesai')),
    body('cost').optional().isFloat({ min: 0 }).toFloat(),
    body('notes').optional().trim(),
    validateRequest,
  ],
  MaintenanceHistoryController.createMaintenanceHistory
);

router.patch(
  '/:id/validate',
  authMiddleware,
  requireRole(['admin']),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('validatedBy').optional().isInt({ min: 1 }).toInt(),
    body('validatedAt').optional().isISO8601().withMessage(isoDateTimeMessage('Waktu validasi')),
    validateRequest,
  ],
  MaintenanceHistoryController.validateMaintenanceHistory
);

router.patch(
  '/:id/complete',
  authMiddleware,
  requireRole(['admin']),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('completedAt').optional().isISO8601().withMessage(isoDateTimeMessage('Waktu selesai')),
    body('cost').optional().isFloat({ min: 0 }).toFloat(),
    body('notes').optional().trim(),
    validateRequest,
  ],
  MaintenanceHistoryController.completeMaintenanceHistory
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole(['admin']),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('deleteReason').trim().notEmpty().withMessage('Alasan penghapusan wajib diisi'),
    validateRequest,
  ],
  MaintenanceHistoryController.deleteMaintenanceHistory
);

export default router;
