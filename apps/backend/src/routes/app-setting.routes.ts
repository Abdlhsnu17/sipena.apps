import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import appSettingController, { appSettingValidators } from '../controllers/app-setting.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { getBrandingUploadsDir } from '../utils/storage-paths';
import { buildStoredFileName } from '../utils/upload-filename';

const router = Router();

const brandingUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, getBrandingUploadsDir()),
    filename: (_req, file, callback) => callback(null, buildStoredFileName(file.originalname, 'brand-logo')),
  }),
  fileFilter: (_req, file, callback) => {
    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
    const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase()) || !allowedMimeTypes.has(file.mimetype)) {
      const error = new Error('Logo harus berformat PNG, JPG, atau WEBP') as Error & { statusCode?: number };
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.post(
  '/branding',
  requireRole(['admin']),
  brandingUpload.single('logo'),
  appSettingController.updateBranding
);

router.delete('/branding', requireRole(['admin']), appSettingController.resetBranding);

router.get('/announcement', appSettingController.getAnnouncement);

router.put(
  '/announcement',
  requireRole(['admin']),
  appSettingValidators.updateAnnouncement,
  appSettingController.updateAnnouncement
);

export default router;
