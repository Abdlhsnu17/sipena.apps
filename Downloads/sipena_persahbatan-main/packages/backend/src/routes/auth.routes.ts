import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import authController from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const USER_ROLES = ['admin', 'leader', 'staff'];
const profileUploadDir = path.join(process.cwd(), 'uploads', 'profiles');
fs.mkdirSync(profileUploadDir, { recursive: true });

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, profileUploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.post(
  '/login',
  [
    body('nip').trim().notEmpty(),
    body('password').notEmpty()
  ],
  authController.login
);

router.post(
  '/register',
  [
    body('nip').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
    body('role').optional().isIn(USER_ROLES)
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
    body('userId').isInt({ min: 1 }),
    body('newPassword').isLength({ min: 6 })
  ],
  authController.resetPassword
);

router.post('/logout', authController.logout);

router.get('/me', authMiddleware, authController.getProfile);

router.patch('/me', authMiddleware, profileUpload.single('photo'), authController.updateProfile);

export default router;
