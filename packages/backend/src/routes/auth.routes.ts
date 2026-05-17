import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import authController from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getProfileUploadsDir } from '../utils/storage-paths';

const router = Router();
const profileUploadDir = getProfileUploadsDir();
const ALLOWED_PROFILE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_PROFILE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const sanitizeFileName = (filename: string): string => {
  const parsed = path.parse(path.basename(filename));
  const baseName = parsed.name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const extension = parsed.ext.toLowerCase().replace(/[^a-z0-9.]/g, '');
  return `${baseName || 'file'}${extension}`;
};

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profileUploadDir),
  filename: (_req, file, cb) => {
    const safeName = sanitizeFileName(file.originalname);
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PROFILE_EXTENSIONS.has(extension) || !ALLOWED_PROFILE_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Jenis file foto profil tidak diizinkan'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.post(
  '/login',
  [
    body('nip').trim().notEmpty().withMessage('Username atau email wajib diisi'),
    body('password').notEmpty().withMessage('Password wajib diisi')
  ],
  authController.login
);

router.post(
  '/register',
  [
    body('nip').trim().notEmpty().isLength({ min: 8, max: 20 }),
    body('name').trim().notEmpty(),
    body('email').trim().isEmail(),
    body('phoneNumber').trim().notEmpty().withMessage('Nomor WhatsApp/SMS wajib diisi'),
    body('password').isLength({ min: 6 }),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
  ],
  authController.register
);

router.post(
  '/reset-password/verify',
  [body('nip').trim().notEmpty()],
  authController.verifyResetNip
);

router.post(
  '/reset-password',
  [
    body('nip').trim().notEmpty(),
    body('verificationCode').trim().isLength({ min: 6, max: 6 }).isNumeric(),
    body('newPassword').isLength({ min: 6 }),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
  ],
  authController.resetPassword
);

router.post('/logout', authMiddleware, authController.logout);

router.get('/me', authMiddleware, authController.getProfile);

router.patch(
  '/me',
  authMiddleware,
  (req, res, next) => {
    profileUpload.single('photo')(req, res, (err) => {
      if (err) {
        console.error('[Multer Error]', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  },
  authController.updateProfile
);

export default router;
