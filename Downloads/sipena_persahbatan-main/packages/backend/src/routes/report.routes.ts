import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { query } from 'express-validator';
import multer from 'multer';
import reportController from '../controllers/report.controller';

const router = Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.get('/', reportController.getDashboard);

router.get(
  '/assets',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('category').optional().trim(),
    query('type').optional().trim()
  ],
  reportController.getAssetReport
);

router.get(
  '/borrowing',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('status').optional().trim()
  ],
  reportController.getBorrowingReport
);

router.get(
  '/maintenance',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('type').optional().trim()
  ],
  reportController.getMaintenanceReport
);

router.get('/uploads', reportController.getUploads);
router.post('/uploads', upload.single('file'), reportController.uploadReport);
router.get('/uploads/:id/download', reportController.downloadUpload);
router.get('/uploads/:id/preview', reportController.previewUpload);
router.delete('/uploads/:id', reportController.deleteUpload);

router.get(
  '/export/pdf',
  [
    query('reportType').optional().trim(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  reportController.exportPdf
);

router.get(
  '/export/excel',
  [
    query('reportType').optional().trim(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  reportController.exportExcel
);

export default router;
