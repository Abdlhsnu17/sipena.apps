import { Router } from 'express';
import { body, param, query } from 'express-validator';
import userController from '../controllers/user.controller';
import { requireRole } from '../middlewares/authMiddleware';

const router = Router();

const USER_ROLES = ['admin', 'leader', 'staff', 'teknisi', 'tekniksi', 'staff_pj', 'staff pj', 'user'];
const STAFF_ACCESS_TYPES = ['medis', 'non-medis', 'all'];

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
    body('password').isLength({ min: 6 }),
    body('role').isIn(USER_ROLES),
    body('staffAccessType').optional().isIn(STAFF_ACCESS_TYPES)
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
    body('role').optional().isIn(USER_ROLES),
    body('staffAccessType').optional().isIn(STAFF_ACCESS_TYPES),
    body('umlAccess').optional().isBoolean()
  ],
  requireRole(['admin', 'leader']),
  userController.update
);

router.delete('/:id', [param('id').isInt({ min: 1 })], requireRole(['admin', 'leader']), userController.delete);

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
