import { Router } from 'express';
import { body, param, query } from 'express-validator';
import multer from 'multer';
import assetController from '../controllers/asset.controller';
import { requireRole } from '../middlewares/auth.middleware';

const router = Router();
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/zip',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file Excel (.xlsx, .xls) yang diizinkan'));
    }
  },
});

const ASSET_TYPES = ['medical', 'non_medical'];
const ASSET_STATUSES = ['available', 'borrowed', 'maintenance', 'disposed'];
const ASSET_CONDITIONS = ['good', 'fair', 'poor', 'damaged'];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1 }).toInt(),
    query('status').optional().isIn(ASSET_STATUSES),
    query('type').optional().isIn(ASSET_TYPES)
  ],
  assetController.getAll
);

router.get('/import/template', assetController.downloadTemplate);

router.get('/:id', [param('id').isInt({ min: 1 })], assetController.getById);

router.post(
  '/',
  [
    body('assetCode').optional().trim(),
    body('name').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('type').isIn(ASSET_TYPES),
    body('status').optional().isIn(ASSET_STATUSES),
    body('condition').optional().isIn(ASSET_CONDITIONS)
  ],
  requireRole(['admin', 'leader', 'staff_pj', 'staff pj']),
  assetController.create
);

router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('status').optional().isIn(ASSET_STATUSES),
    body('condition').optional().isIn(ASSET_CONDITIONS),
    body('type').optional().isIn(ASSET_TYPES)
  ],
  requireRole(['admin', 'leader', 'staff_pj', 'staff pj']),
  assetController.update
);

router.delete('/reset/all', requireRole(['admin']), assetController.resetInventory);
router.delete('/:id', [param('id').isInt({ min: 1 })], requireRole(['admin']), assetController.delete);

router.post(
  '/import',
  requireRole(['admin', 'leader', 'staff_pj', 'staff pj']),
  importUpload.single('file'),
  assetController.importFromFile
);

export default router;
