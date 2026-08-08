import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import maintenanceController from '../controllers/maintenance.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { getMaintenanceUploadsDir } from '../utils/storage-paths';
import { buildStoredFileName } from '../utils/upload-filename';
import { validateRequest } from '../middlewares/validate-request.middleware';

const router = Router();
const uploadDir = getMaintenanceUploadsDir();

const MAINTENANCE_TYPES = ['preventive', 'corrective', 'calibration', 'inspection'];
const MAINTENANCE_STATUSES = ['requested', 'scheduled', 'in_progress', 'completed', 'validated', 'cancelled'];
const MAINTENANCE_PRIORITIES = ['low', 'normal', 'high', 'critical'];
const MAINTENANCE_RECURRENCE = ['none', 'monthly', 'quarterly', 'yearly'];
const MAINTENANCE_APPROVAL = ['not_required', 'pending', 'approved', 'rejected'];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, buildStoredFileName(file.originalname, 'maintenance'))
  }),
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = new Set(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.webp']);
    if (!allowed.has(extension)) {
      cb(new Error('Jenis file lampiran pemeliharaan tidak diizinkan'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024 }
});

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('view').optional().isIn(['active', 'history']),
    query('status').optional().isIn(MAINTENANCE_STATUSES),
    query('assetId').optional().isInt({ min: 1 }).toInt(),
    query('assetType').optional().isIn(['medical', 'non_medical']),
    query('type').optional().isIn(MAINTENANCE_TYPES),
    query('automationSource').optional().isIn(['usage_threshold', 'manual']),
    query('search').optional().trim().isLength({ max: 200 }),
    validateRequest
  ],
  maintenanceController.getAll
);

router.get(
  '/technician-candidates',
  [
    query('search').optional().trim().isLength({ max: 100 }),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    validateRequest
  ],
  maintenanceController.getTechnicianCandidates
);

router.get('/analytics', maintenanceController.getAnalytics);
router.post('/dispatch-reminders', requireRole(['admin', 'leader']), maintenanceController.dispatchReminders);

router.get('/:id/attachments', [param('id').isInt({ min: 1 }), validateRequest], maintenanceController.getAttachments);
router.post(
  '/:id/attachments',
  [param('id').isInt({ min: 1 }), validateRequest],
  requireRole(['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'teknisi']),
  upload.single('file'),
  maintenanceController.uploadAttachment
);

router.get('/:id', [param('id').isInt({ min: 1 }), validateRequest], maintenanceController.getById);

router.post(
  '/',
  [
    body('assetId').isInt({ min: 1 }),
    body('assetType').optional().isIn(['medical', 'non_medical']),
    body('assetDetailId').optional().trim(),
    body('assetDetailName').optional().trim(),
    body('assetDetailCode').optional().trim(),
    body('type').isIn(MAINTENANCE_TYPES),
    body('priority').optional().isIn(MAINTENANCE_PRIORITIES),
    body('status').optional().isIn(MAINTENANCE_STATUSES),
    body('scheduledDate').isISO8601(),
    body('description').optional().trim(),
    body('technician').optional().trim(),
    body('technicianUserId').optional().isInt({ min: 1 }).toInt(),
    body('dueAt').optional().isISO8601(),
    body('startedAt').optional().isISO8601(),
    body('completedDate').optional().isISO8601(),
    body('actualStartAt').optional().isISO8601(),
    body('actualEndAt').optional().isISO8601(),
    body('vendorName').optional().trim(),
    body('vendorReference').optional().trim(),
    body('warrantyUntil').optional().isISO8601(),
    body('estimatedDurationMinutes').optional().isInt({ min: 0 }).toInt(),
    body('estimatedCost').optional().isFloat({ min: 0 }),
    body('damagePhotoUrl').optional().trim(),
    body('beforePhotoUrl').optional().trim(),
    body('afterPhotoUrl').optional().trim(),
    body('diagnosis').optional().trim(),
    body('actionTaken').optional().trim(),
    body('checklist').optional().trim(),
    body('spareParts').optional().trim(),
    body('verificationResult').optional().trim(),
    body('finalCondition').optional().trim(),
    body('verificationNotes').optional().trim(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('recurrenceInterval').optional().isIn(MAINTENANCE_RECURRENCE),
    body('recurrenceEnabled').optional().isBoolean().toBoolean(),
    body('approvalStatus').optional().isIn(MAINTENANCE_APPROVAL),
    body('approvalNotes').optional().trim(),
    body('cost').optional().isFloat({ min: 0 }),
    body('notes').optional().trim(),
    body('cancellationReason').optional().trim(),
    validateRequest
  ],
  requireRole(['admin', 'leader', 'staff', 'staff_pj', 'staff pj']),
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
    body('priority').optional().isIn(MAINTENANCE_PRIORITIES),
    body('scheduledDate').optional().isISO8601(),
    body('description').optional().trim(),
    body('technician').optional().trim(),
    body('technicianUserId').optional().isInt({ min: 1 }).toInt(),
    body('dueAt').optional().isISO8601(),
    body('startedAt').optional().isISO8601(),
    body('completedDate').optional().isISO8601(),
    body('actualStartAt').optional().isISO8601(),
    body('actualEndAt').optional().isISO8601(),
    body('vendorName').optional().trim(),
    body('vendorReference').optional().trim(),
    body('warrantyUntil').optional().isISO8601(),
    body('estimatedDurationMinutes').optional().isInt({ min: 0 }).toInt(),
    body('estimatedCost').optional().isFloat({ min: 0 }),
    body('damagePhotoUrl').optional().trim(),
    body('beforePhotoUrl').optional().trim(),
    body('afterPhotoUrl').optional().trim(),
    body('diagnosis').optional().trim(),
    body('actionTaken').optional().trim(),
    body('checklist').optional().trim(),
    body('spareParts').optional().trim(),
    body('verificationResult').optional().trim(),
    body('finalCondition').optional().trim(),
    body('verificationNotes').optional().trim(),
    body('nextMaintenanceDate').optional().isISO8601(),
    body('recurrenceInterval').optional().isIn(MAINTENANCE_RECURRENCE),
    body('recurrenceEnabled').optional().isBoolean().toBoolean(),
    body('approvalStatus').optional().isIn(MAINTENANCE_APPROVAL),
    body('approvalNotes').optional().trim(),
    body('cost').optional().isFloat({ min: 0 }),
    body('notes').optional().trim(),
    body('cancellationReason').optional().trim(),
    validateRequest
  ],
  requireRole(['admin', 'leader', 'staff', 'staff_pj', 'staff pj', 'teknisi']),
  maintenanceController.update
);

router.patch(
  '/:id/complete',
  [
    param('id').isInt({ min: 1 }),
    body('notes').optional().trim(),
    body('cost').optional().isFloat({ min: 0 }),
    validateRequest
  ],
  requireRole(['admin', 'leader', 'teknisi']),
  maintenanceController.complete
);

router.delete('/:id', [param('id').isInt({ min: 1 }), validateRequest], requireRole(['admin']), maintenanceController.delete);

export default router;
