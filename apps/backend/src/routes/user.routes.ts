import { Router } from 'express';
import { body, param, query } from 'express-validator';
import userController from '../controllers/user.controller';
import { requireRole } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validate-request.middleware';

const router = Router();

const USER_ROLES = ['admin', 'leader', 'staff', 'teknisi', 'staff_pj', 'staff pj', 'user'];
const STAFF_ACCESS_TYPES = ['medis', 'non-medis', 'all'];
const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'];
const GENDERS = ['Laki-laki', 'Perempuan', 'Lainnya'];
const LEGACY_GENDER_MAP: Record<string, string> = {
  male: 'Laki-laki',
  female: 'Perempuan',
  other: 'Lainnya'
};
const normalizeGender = (value: string) => LEGACY_GENDER_MAP[value.toLowerCase()] ?? value;
const NIP_REGEX = /^[A-Za-z0-9.\-/\s]{3,30}$/;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_POLICY_MESSAGE = 'Password minimal 8 karakter dan harus mengandung huruf besar, huruf kecil, dan angka';

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1 }).toInt(),
    query('role').optional().isIn(USER_ROLES),
    query('search').optional().trim(),
    validateRequest
  ],
  requireRole(['admin', 'leader', 'staff', 'staff_pj']),
  userController.getAll
);

router.get('/:id', [param('id').isInt({ min: 1 }), validateRequest], requireRole(['admin']), userController.getById);

router.post(
  '/',
  [
    body('nip').trim().notEmpty().matches(NIP_REGEX).withMessage('Format NIP tidak valid'),
    body('name').trim().notEmpty().isLength({ min: 3, max: 255 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('phoneNumber').trim().notEmpty().isLength({ min: 10, max: 25 }),
    body('password').matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_POLICY_MESSAGE),
    body('role').isIn(USER_ROLES),
    body('staffAccessType').optional().isIn(STAFF_ACCESS_TYPES),
    body('gender').optional({ checkFalsy: true }).trim().customSanitizer(normalizeGender).isIn(GENDERS),
    body('workUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('subWorkUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('homeAddress').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('accountStatus').optional().isIn(ACCOUNT_STATUSES),
    body('mustChangePassword').optional().isBoolean(),
    validateRequest
  ],
  requireRole(['admin', 'leader']),
  userController.create
);

router.post(
  '/bulk-delete',
  [
    body('userIds').isArray({ min: 1, max: 5000 }).withMessage('Daftar pengguna wajib berisi 1 sampai 5000 ID'),
    body('userIds.*').isInt({ min: 1 }).toInt(),
    body('deleteReason').trim().isLength({ min: 5, max: 500 }).withMessage('Alasan penghapusan wajib diisi (5-500 karakter)'),
    validateRequest
  ],
  requireRole(['admin']),
  userController.bulkDelete,
);

router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim().isLength({ min: 3, max: 255 }),
    body('email').optional().trim().isEmail().normalizeEmail(),
    body('phoneNumber').optional({ checkFalsy: true }).trim().isLength({ min: 10, max: 25 }),
    body('role').optional().isIn(USER_ROLES),
    body('staffAccessType').optional().isIn(STAFF_ACCESS_TYPES),
    body('gender').optional({ checkFalsy: true }).trim().customSanitizer(normalizeGender).isIn(GENDERS),
    body('workUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('subWorkUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('homeAddress').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('accountStatus').optional().isIn(ACCOUNT_STATUSES),
    body('mustChangePassword').optional().isBoolean(),
    body('umlAccess').optional().isBoolean(),
    validateRequest
  ],
  requireRole(['admin', 'leader']),
  userController.update
);

router.delete('/:id', [param('id').isInt({ min: 1 }), validateRequest], requireRole(['admin']), userController.delete);

router.patch(
  '/:id/password/reset',
  [
    param('id').isInt({ min: 1 }),
    body('newPassword').matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_POLICY_MESSAGE),
    validateRequest
  ],
  requireRole(['admin', 'leader']),
  userController.resetPassword
);

router.patch(
  '/:id/password',
  [
    param('id').isInt({ min: 1 }),
    body('currentPassword').trim().notEmpty(),
    body('newPassword').matches(STRONG_PASSWORD_REGEX).withMessage(PASSWORD_POLICY_MESSAGE),
    validateRequest
  ],
  userController.changePassword
);

export default router;
