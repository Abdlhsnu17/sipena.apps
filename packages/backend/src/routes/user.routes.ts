import { Router } from 'express';
import { body, param, query } from 'express-validator';
import userController from '../controllers/user.controller';
import { requireRole } from '../middlewares/authMiddleware';

const router = Router();

const USER_ROLES = ['admin', 'leader', 'staff', 'teknisi', 'tekniksi', 'staff_pj', 'staff pj', 'user'];
const STAFF_ACCESS_TYPES = ['medis', 'non-medis', 'all'];
const ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'];

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1 }).toInt(),
    query('role').optional().isIn(USER_ROLES),
    query('search').optional().trim()
  ],
  requireRole(['admin', 'leader']),
  userController.getAll
);

router.get('/:id', [param('id').isInt({ min: 1 })], requireRole(['admin']), userController.getById);

router.post(
  '/',
  [
    body('nip').trim().notEmpty(),
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('phoneNumber').trim().notEmpty().isLength({ min: 10, max: 25 }),
    body('password').isLength({ min: 6 }),
    body('role').isIn(USER_ROLES),
    body('staffAccessType').optional().isIn(STAFF_ACCESS_TYPES),
    body('gender').optional({ checkFalsy: true }).trim().isIn(['Laki-laki', 'Perempuan']),
    body('workUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('subWorkUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('homeAddress').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('accountStatus').optional().isIn(ACCOUNT_STATUSES),
    body('mustChangePassword').optional().isBoolean()
  ],
  requireRole(['admin', 'leader']),
  userController.create
);

router.put(
  '/:id',
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().trim(),
    body('email').optional().isEmail(),
    body('phoneNumber').optional({ checkFalsy: true }).trim().isLength({ min: 10, max: 25 }),
    body('role').optional().isIn(USER_ROLES),
    body('staffAccessType').optional().isIn(STAFF_ACCESS_TYPES),
    body('gender').optional({ checkFalsy: true }).trim().isIn(['Laki-laki', 'Perempuan']),
    body('workUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('subWorkUnit').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
    body('homeAddress').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('accountStatus').optional().isIn(ACCOUNT_STATUSES),
    body('mustChangePassword').optional().isBoolean(),
    body('umlAccess').optional().isBoolean()
  ],
  requireRole(['admin', 'leader']),
  userController.update
);

router.delete('/:id', [param('id').isInt({ min: 1 })], requireRole(['admin']), userController.delete);

router.patch(
  '/:id/password/reset',
  [
    param('id').isInt({ min: 1 }),
    body('newPassword').isLength({ min: 6 })
  ],
  requireRole(['admin', 'leader']),
  userController.resetPassword
);

router.patch(
  '/:id/password',
  [
    param('id').isInt({ min: 1 }),
    body('currentPassword').trim().notEmpty(),
    body('newPassword').isLength({ min: 6 })
  ],
  userController.changePassword
);

export default router;
