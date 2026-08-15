import { NextFunction, Request, Response, Router } from 'express';
import { validationResult } from 'express-validator';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import notificationController, { notificationValidators } from '../controllers/notification.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate-request.middleware';
import { getAnnouncementUploadsDir } from '../utils/storage-paths';
import { buildStoredFileName } from '../utils/upload-filename';

const uploadDir = getAnnouncementUploadsDir();

/**
 * Lampiran siaran sengaja dibatasi gambar saja: berkas dokumen sebaiknya lewat
 * modul Unggah Dokumen yang berada di balik rute terproteksi, sedangkan folder
 * ini disajikan statis tanpa autentikasi agar bisa dimuat lewat `<img>`.
 */
const announcementUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, buildStoredFileName(file.originalname, 'announcement')),
  }),
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    if (!allowed.has(extension)) {
      // `statusCode` dipasang agar error handler membalas 400, bukan 500:
      // cabang khusus upload di sana hanya mengenali MulterError.
      const error = new Error('Gambar pemberitahuan harus berformat PNG, JPG, atau WEBP') as Error & {
        statusCode?: number;
      };
      error.statusCode = 400;
      cb(error);
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, mengikuti batas foto profil
});

/**
 * Multer sudah menulis file ke disk sebelum validator body dijalankan, sehingga
 * permintaan yang ditolak validasi meninggalkan file yatim. Middleware ini
 * membuangnya lebih dulu, lalu membiarkan `validateRequest` yang membalas.
 */
const discardUploadOnInvalidRequest = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.file && !validationResult(req).isEmpty()) {
    await fs.unlink(req.file.path).catch(() => undefined);
  }
  next();
};

const router = Router();

router.get('/', notificationValidators.getMine, notificationController.getMine);

router.get('/broadcasts', requireRole(['admin']), notificationController.getBroadcastHistory);

router.post(
  '/broadcast',
  requireRole(['admin']),
  announcementUpload.single('image'),
  notificationValidators.broadcast,
  discardUploadOnInvalidRequest,
  validateRequest,
  notificationController.broadcast
);

router.get('/delivery-status', notificationController.getDeliveryStatus);
router.post('/stream-ticket', notificationController.createStreamTicket);

router.get('/unread-count', notificationController.getUnreadCount);

router.patch('/read-all', notificationController.markAllAsRead);

router.patch('/:id/read', notificationValidators.id, notificationController.markAsRead);

router.delete('/:id', notificationValidators.id, notificationController.remove);

export default router;
