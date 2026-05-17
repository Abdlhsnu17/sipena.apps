import { Router } from 'express';
import { query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import reportController from '../controllers/report.controller';
import { getReportUploadsDir } from '../utils/storage-paths';

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

const sanitizeFileName = (filename: string): string => {
  const parsed = path.parse(path.basename(filename));
  const baseName = parsed.name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const extension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${baseName || 'file'}${extension}`;
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = sanitizeFileName(file.originalname);
    cb(null, `${Date.now()}-${safeName}`);
  }
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
