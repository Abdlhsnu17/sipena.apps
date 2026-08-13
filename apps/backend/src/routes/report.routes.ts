import { Router } from 'express';
import { query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import reportController from '../controllers/report.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { getReportUploadsDir } from '../utils/storage-paths';
import { buildStoredFileName } from '../utils/upload-filename';
import { validateRequest } from '../middlewares/validate-request.middleware';
import { isoDateTimeMessage } from '../utils/date-validation';

const router = Router();
const uploadDir = getReportUploadsDir();
const ALLOWED_REPORT_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_REPORT_MIME_TYPES_BY_EXTENSION: Record<string, Set<string>> = {
  '.pdf': new Set(['application/pdf']),
  '.doc': new Set(['application/msword']),
  '.docx': new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
  ]),
  '.xls': new Set(['application/vnd.ms-excel']),
  '.xlsx': new Set([
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
  ]),
  '.png': new Set(['image/png']),
  '.jpg': new Set(['image/jpeg', 'image/pjpeg']),
  '.jpeg': new Set(['image/jpeg', 'image/pjpeg']),
  '.webp': new Set(['image/webp']),
};

// Some browsers/folder uploads can send generic mime types for otherwise valid files.
const GENERIC_UPLOAD_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, buildStoredFileName(file.originalname))
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const mimeType = (file.mimetype || '').toLowerCase().trim();
    const allowedByExtension = ALLOWED_REPORT_MIME_TYPES_BY_EXTENSION[extension];

    if (
      !ALLOWED_REPORT_EXTENSIONS.has(extension) ||
      !allowedByExtension ||
      (!allowedByExtension.has(mimeType) && !GENERIC_UPLOAD_MIME_TYPES.has(mimeType))
    ) {
      cb(new Error('Jenis file laporan tidak diizinkan'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.get('/', reportController.getDashboard);
router.get('/notifications', reportController.getNotifications);

router.get(
  '/assets',
  [
    query('startDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal mulai filter')),
    query('endDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    query('category').optional().trim(),
    query('type').optional().trim(),
    validateRequest
  ],
  reportController.getAssetReport
);

router.get(
  '/borrowing',
  [
    query('startDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal mulai filter')),
    query('endDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    query('status').optional().trim(),
    validateRequest
  ],
  reportController.getBorrowingReport
);

router.get(
  '/maintenance',
  [
    query('startDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal mulai filter')),
    query('endDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    query('type').optional().trim(),
    validateRequest
  ],
  reportController.getMaintenanceReport
);

router.get(
  '/usage',
  [
    query('startDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal mulai filter')),
    query('endDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    query('type').optional().trim(),
    query('status').optional().trim(),
    validateRequest
  ],
  reportController.getUsageReport
);

router.get('/uploads', reportController.getUploads);
router.post('/uploads', upload.single('file'), reportController.uploadReport);
router.get('/uploads/:id/download', reportController.downloadUpload);
router.get('/uploads/:id/preview', reportController.previewUpload);
router.delete('/uploads/:id', requireRole(['admin']), reportController.deleteUpload);

router.get(
  '/export/pdf',
  [
    query('reportType').optional().trim(),
    query('startDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal mulai filter')),
    query('endDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    query('category').optional().trim(),
    query('type').optional().trim(),
    query('status').optional().trim(),
    query('userId').optional().isInt({ min: 1 }),
    validateRequest
  ],
  reportController.exportPdf
);

router.get(
  '/export/excel',
  [
    query('reportType').optional().trim(),
    query('startDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal mulai filter')),
    query('endDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    query('category').optional().trim(),
    query('type').optional().trim(),
    query('status').optional().trim(),
    query('userId').optional().isInt({ min: 1 }),
    validateRequest
  ],
  reportController.exportExcel
);

router.get(
  '/export/csv',
  [
    query('reportType').optional().trim(),
    query('startDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal mulai filter')),
    query('endDate').optional().isISO8601().withMessage(isoDateTimeMessage('Tanggal akhir filter')),
    query('category').optional().trim(),
    query('type').optional().trim(),
    query('status').optional().trim(),
    query('userId').optional().isInt({ min: 1 }),
    validateRequest
  ],
  reportController.exportCsv
);

export default router;
