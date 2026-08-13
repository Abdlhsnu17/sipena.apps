import { Router } from 'express';
import { body, param, query } from 'express-validator';
import assetUsageController from '../controllers/asset-usage.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate-request.middleware';
import { isoDateTimeMessage } from '../utils/date-validation';

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
    query('dateFrom').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal awal filter')),
    query('dateTo').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    validateRequest
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
    validateRequest
  ],
  assetUsageController.getThresholdOverview
);

router.get('/:id', [param('id').isInt({ min: 1 }), validateRequest], assetUsageController.getById);

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
    body('startedAt').isISO8601().withMessage(isoDateTimeMessage('Waktu mulai')),
    body('endedAt').optional({ nullable: true }).isISO8601().withMessage(isoDateTimeMessage('Waktu selesai')),
    body('usageCount').optional().isInt({ min: 1 }).toInt(),
    body('conditionBefore').optional().trim(),
    body('conditionAfter').optional().trim(),
    body('notes').optional().trim(),
    validateRequest
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
    body('startedAt').optional().isISO8601().withMessage(isoDateTimeMessage('Waktu mulai')),
    body('endedAt').optional({ nullable: true }).isISO8601().withMessage(isoDateTimeMessage('Waktu selesai')),
    body('usageCount').optional().isInt({ min: 1 }).toInt(),
    body('conditionBefore').optional().trim(),
    body('conditionAfter').optional().trim(),
    body('notes').optional().trim(),
    validateRequest
  ],
  assetUsageController.update
);

router.delete(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('deleteReason').trim().notEmpty().withMessage('Alasan pengarsipan wajib diisi'),
    validateRequest
  ],
  requireRole(['admin', 'leader']),
  assetUsageController.delete
);

export default router;
