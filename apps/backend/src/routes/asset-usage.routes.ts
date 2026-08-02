import { Router } from 'express';
import { body, param, query } from 'express-validator';
import assetUsageController from '../controllers/asset-usage.controller';
import { requireRole } from '../middlewares/auth.middleware';

const router = Router();

const ASSET_TYPES = ['medical', 'non_medical'];
const USAGE_CONTEXTS = ['own_room', 'same_unit_cross_room', 'cross_room', 'emergency', 'procedure', 'rounding', 'other'];
const MANAGE_ROLES = ['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'user'];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1 }).toInt(),
    query('assetId').optional().isInt({ min: 1 }).toInt(),
    query('assetType').optional().isIn(ASSET_TYPES),
    query('roomName').optional().trim(),
    query('usageContext').optional().isIn(USAGE_CONTEXTS),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
  ],
  assetUsageController.getAll
);

router.get(
  '/threshold-overview',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1 }).toInt(),
    query('assetType').optional().isIn(ASSET_TYPES),
    query('state').optional().isIn(['all', 'warning', 'mandatory_check']),
    query('keyword').optional().trim(),
  ],
  assetUsageController.getThresholdOverview
);

router.get('/:id', [param('id').isInt({ min: 1 })], assetUsageController.getById);

router.post(
  '/',
  requireRole(MANAGE_ROLES),
  [
    body('assetId').isInt({ min: 1 }),
    body('assetType').optional().isIn(ASSET_TYPES),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('assetLocation').optional().trim(),
    body('roomName').trim().notEmpty().withMessage('Ruangan penggunaan wajib diisi'),
    body('operatorUserId').optional().isInt({ min: 1 }).toInt(),
    body('usageContext').optional().isIn(USAGE_CONTEXTS),
    body('startedAt').isISO8601().withMessage('Waktu mulai harus format ISO 8601'),
    body('endedAt').optional({ nullable: true }).isISO8601(),
    body('usageCount').optional().isInt({ min: 1 }).toInt(),
    body('conditionBefore').optional().trim(),
    body('conditionAfter').optional().trim(),
    body('notes').optional().trim()
  ],
  assetUsageController.create
);

router.patch(
  '/:id',
  requireRole(MANAGE_ROLES),
  [
    param('id').isInt({ min: 1 }),
    body('roomName').optional().trim(),
    body('operatorUserId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('usageContext').optional().isIn(USAGE_CONTEXTS),
    body('startedAt').optional().isISO8601(),
    body('endedAt').optional({ nullable: true }).isISO8601(),
    body('usageCount').optional().isInt({ min: 1 }).toInt(),
    body('conditionBefore').optional().trim(),
    body('conditionAfter').optional().trim(),
    body('notes').optional().trim()
  ],
  assetUsageController.update
);

router.delete(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('deleteReason').trim().notEmpty().withMessage('Alasan pengarsipan wajib diisi')
  ],
  requireRole(['admin', 'leader']),
  assetUsageController.delete
);

export default router;
